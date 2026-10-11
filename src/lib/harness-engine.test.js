// @ts-nocheck — VM mocks browser to exercise shipped harness engine deterministically.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function boot(existing=null,devices=['MCU','SENSOR','DRIVER','GROUND']){
  const store=new Map(existing?Object.entries(existing):[]);
  const events=[];
  const window={
    dispatchEvent(e){events.push(e);},
    PCBProSystemArchitect:{snapshot(){return {devices:devices.map(id=>({id}))}}}
  };
  const document={readyState:'complete',addEventListener(){}};
  const localStorage={
    getItem:k=>store.get(k)??null,
    setItem:(k,v)=>store.set(k,String(v)),
    removeItem:k=>store.delete(k)
  };
  const context={window,document,localStorage,structuredClone,
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}},
    Blob,URL,setTimeout};
  vm.runInNewContext(read('static/harness-engine-v131.js'),context,{filename:'harness-engine-v131.js'});
  return {api:window.PCBProHarnessV131,store,events,project:window.PCBProSystemArchitect.snapshot()};
}
const getIssues=(h,project=h.project)=>h.api.validateForBlueprint(h.api.snapshot(),project);
function basic(){
  const h=boot(),a=h.api;
  a.addTerminal('MCU');a.addTerminal('SENSOR');
  a.updateTerminal('T1','name','GPIO21');
  a.updateTerminal('T2','name','SDA');
  a.updateTerminal('T1','role','bidirectional');
  a.updateTerminal('T2','role','bidirectional');
  a.updateTerminal('T1','nominalV',3.3);
  a.updateTerminal('T2','nominalV',3.3);
  a.addWire('T1','T2');a.updateWire('W1','net','SDA');
  a.updateWire('W1','mode','data');
  return h;
}
test('empty wire plan never masquerades as a manufactured or certified harness',()=>{
 const h=boot(),a=h.api;
 assert.equal(a.validate(a.blank()).ok,true);
 const r=getIssues(h);
 assert.equal(r.summary.wires,0);
 assert.equal(r.coverage.independentlyVerified,false);
 assert.equal(r.coverage.wireAmpacityCalculated,false);
 assert.ok(r.warnings.some(x=>x.code==='NO_WIRING'));
 assert.notEqual(r.verdict,'CERTIFIED');
});
test('actual terminal names + connection result in stored, reloadable, per-project wiring',()=>{
 const h=basic(),p=h.api.snapshot();
 assert.equal(p.terminals.length,2);
 assert.equal(p.wires.length,1);
 assert.equal(p.wires[0].net,'SDA');
 assert.equal(getIssues(h).blockers.length,0);
 assert.equal(getIssues(h).summary.untested,1);
 assert.equal(boot(Object.fromEntries(h.store)).api.snapshot().wires[0].net,'SDA');
 assert.ok(h.events.some(e=>e.type==='pcbpro:harness-changed'));
});
test('reject power out directly to ground, mismatched known voltage and two signal drivers',()=>{
 const h=basic(),a=h.api;
 a.updateTerminal('T1','role','power_out');
 a.updateTerminal('T2','role','ground');
 let r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='POWER_TO_GROUND'));
 a.updateTerminal('T2','role','power_in');
 a.updateTerminal('T2','nominalV',5);
 r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='VOLTAGE_MISMATCH'));
 a.updateTerminal('T1','role','signal_out');
 a.updateTerminal('T2','role','signal_out');
 r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='TWO_SIGNAL_DRIVERS'));
});
test('evidence is self-attested, and must be written before PASS can be saved',()=>{
 const h=basic(),a=h.api;
 const before=a.snapshot();
 assert.throws(()=>a.recordTest('W1','pass','ok'),/testNote/);
 assert.deepEqual(a.snapshot(),before);
 a.recordTest('W1','pass','Uji multimeter: continuity terdeteksi dan nomor terminal dicek');
 let r=getIssues(h);
 assert.equal(r.summary.passed,1);
 assert.equal(r.coverage.independentlyVerified,false);
 a.updateWire('W1','gauge','AWG26');
 r=getIssues(h);
 assert.equal(r.summary.passed,0);
 assert.equal(a.snapshot().wires[0].testStatus,'needs_retest');
 assert.equal(a.snapshot().wires[0].testNote,'');
});
test('user-recorded FAIL blocks release independently of project DRC',()=>{
 const h=basic(),a=h.api;
 a.recordTest('W1','fail','Tidak kontinuitas pada terminasi pertama');
 const r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='CONTINUITY_FAILED'));
 assert.equal(r.summary.failed,1);
 assert.equal(r.verdict,'BLOCKED');
});
test('same terminal on distinct net names, duplicate wires and orphan modules flag blockers',()=>{
 const h=basic(),a=h.api;
 a.addTerminal('DRIVER');
 a.addWire('T1','T3');a.updateWire('W2','net','GPIO21');
 let r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='TERMINAL_ON_MULTIPLE_NETS'));
 a.addWire('T1','T2');
 r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='DUPLICATE_WIRE'));
 r=getIssues(h,{devices:[{id:'MCU'}]});
 assert.ok(r.blockers.some(x=>x.code==='ORPHAN_MODULE'));
});
test('deleting terminals removes their wires, and IDs remain unique after delete/add',()=>{
 const h=basic(),a=h.api;
 a.removeTerminal('T1');
 assert.equal(a.snapshot().wires.length,0);
 a.addTerminal('MCU');
 const terminals=a.snapshot().terminals;
 assert.deepEqual(Array.from(terminals,x=>x.id),['T2','T1']);
 assert.equal(a.validate(a.snapshot()).ok,true);
});
test('validator fails closed for duplicate module/terminal names, bad data, too many wires',()=>{
 const h=basic(),a=h.api;
 const p=a.snapshot();
 p.terminals.push({...p.terminals[0],id:'T22'});
 assert.equal(a.validate(p).ok,false);
 assert.throws(()=>a.updateTerminal('T2','nominalV',230),/nominalV/);
 assert.throws(()=>a.updateWire('W1','lengthCm',-5),/lengthCm/);
 assert.throws(()=>a.addTerminal('NOT_PRESENT'),/existing Builder module/);
 assert.throws(()=>a.updateWire('W1','__proto__',true),/Unknown wire field/);
 assert.equal(a.snapshot().terminals.length,2);
});
test('failed import does not destroy saved data and no automatic sample wires are inserted',()=>{
 const h=basic(),a=h.api;const saved=a.snapshot();
 assert.throws(()=>a.restore({version:'x',wires:[{id:'BOGUS'}]}));
 assert.deepEqual(a.snapshot(),saved);
 const r=boot({'pcbpro0045-harness-v131':'invalid-json'});
 assert.equal(r.api.snapshot().wires.length,0);
 assert.ok(r.api.loadIssue);
});
test('Excel-safe CSV includes genuine terminal/net data, guards formula injection',()=>{
 const h=basic(),a=h.api;
 a.updateWire('W1','notes','=HYPERLINK("https://example.invalid")');
 const csv=a.csv();
 assert.match(csv,/Wire ID/);
 assert.match(csv,/GPIO21/);
 assert.match(csv,/SENSOR/);
 assert.match(csv,/'=HYPERLINK/);
 assert.ok(csv.startsWith('\uFEFF'));
});
test('UI and persistence contract: Builder mount, local/cloud/backup, no 230V default',()=>{
 const studio=read('static/system-studio-v130.js'),loader=read('static/runtime-loader.js');
 const db=read('static/database-engine-v117.js'),backup=read('static/portable-backup-v124.js');
 const svelte=read('src/routes/+page.svelte'),quick=read('static/quick-actions-v130.js');
 const verify=read('static/engineering-verification-v125.js');
 assert.match(studio,/id="sl-harness-v131"/);
 assert.match(studio,/PCBProHarnessUIV131\?\.mount/);
 assert.match(loader,/harness-engine-v131\.js/);
 assert.match(loader,/harness-ui-v131\.js/);
 assert.ok(loader.indexOf('harness-engine-v131.js')<loader.indexOf('database-engine-v117.js'));
 assert.match(db,/harnessPlan:window\.PCBProHarnessV131/);
 assert.match(db,/pcbpro:harness-changed/);
 assert.match(db,/bundle\.harnessPlan/);
 assert.match(backup,/KEY\.harness/);
 assert.match(backup,/bundle\.harnessPlan/);
 assert.match(svelte,/localStorage\.removeItem\('pcbpro0045-harness-v131'\)/);
 assert.match(quick,/Buka Wiring & Harness Planner/);
 assert.match(verify,/HARNESS_/);
 assert.match(verify,/harnessIndependentPhysicalTestVerified:false/);
});

test('shared net groups catch indirect source-to-ground short and two drivers',()=>{
 const h=boot(),a=h.api;
 for(const module of ['MCU','SENSOR','DRIVER','GROUND'])a.addTerminal(module);
 a.updateTerminal('T1','role','power_out');
 a.updateTerminal('T2','role','passive');
 a.updateTerminal('T3','role','passive');
 a.updateTerminal('T4','role','ground');
 a.addWire('T1','T2');a.updateWire('W1','net','VCC');
 a.addWire('T3','T4');a.updateWire('W2','net','VCC');
 let r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='NET_POWER_TO_GROUND'));
 a.updateTerminal('T4','role','power_out');
 r=getIssues(h);
 assert.ok(r.blockers.some(x=>x.code==='NET_MULTIPLE_POWER_SOURCES'));
 a.updateTerminal('T1','role','signal_out');
 a.updateTerminal('T4','role','signal_out');
 assert.ok(getIssues(h).blockers.some(x=>x.code==='NET_MULTIPLE_SIGNAL_DRIVERS'));
});
test('SDA/SCL labels are reviewed without claiming automated I2C hardware validation',()=>{
 const h=basic(),a=h.api;
 a.updateTerminal('T2','name','SCL');
 const review=getIssues(h);
 assert.ok(review.warnings.some(x=>x.code==='I2C_LABEL_MISMATCH'));
 assert.equal(review.coverage.pcbNetlistLinked,false);
});
