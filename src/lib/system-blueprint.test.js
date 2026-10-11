// @ts-nocheck -- Deliberate minimal browser VM to test real shipped client engine.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../../static/'+name,import.meta.url),'utf8');
function boot(previous=null){
 const store=new Map(previous?Object.entries(previous):[]);
 const events=[];
 const window={dispatchEvent(e){events.push(e)}};
 const document={readyState:'complete',addEventListener(){}};
 const localStorage={
  getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
 };
 const context={window,document,localStorage,structuredClone,
  CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},
  Blob,URL,setTimeout};
 vm.runInNewContext(file('system-architect-v130.js'),context,{filename:'system-architect-v130.js'});
 return {api:window.PCBProSystemArchitect,store,events};
}
const near=(x,y)=>assert.ok(Math.abs(x-y)<1e-9, x+' is not '+y);
function configured(){
 const h=boot(),a=h.api;a.addDevice();
 a.configure('voltageV',5);a.configure('continuousA',1);a.configure('peakA',2);
 for(const [k,v] of Object.entries({railV:5,nominalA:.2,peakA:.6,hoursPerDay:4})){
  a.updateDevice('MOD1',k,v);
 }
 return h;
}
test('four grounded blueprint templates contain conceptual unpriced modules and missing measured ratings',()=>{
 const h=boot(),a=h.api;
 assert.deepEqual(Array.from(a.templates,x=>x.id),['robot','smart','hydro','tracker']);
 for(const template of a.templates){
  const blueprint=a.newBlueprint(template.id);
  assert.equal(a.validate(blueprint).ok,true,template.id);
  assert.ok(blueprint.devices.length>=6);
  assert.ok(blueprint.devices.every(d=>d.railV===null&&d.nominalA===null&&d.peakA===null));
  const r=a.analyze(blueprint);
  assert.equal(r.status,'INPUTS_INCOMPLETE_OR_BLOCKED');
  assert.equal(r.power.nominalLoadW,null);
  assert.equal(r.power.peakLoadW,null);
  assert.ok(r.issues.some(i=>i.code==='INPUT_MISSING'));
 }
});
test('new projects with zero devices and missing supply are blocked rather than estimated at zero power',()=>{
 const h=boot(),report=h.api.analyze();
 assert.equal(report.power.nominalLoadW,null);
 assert.equal(report.power.sourcePeakW,null);
 assert.ok(report.issues.some(x=>x.code==='NO_MODULES'));
 assert.ok(report.coverage.required>0);
 assert.ok(!JSON.stringify(report).includes('SAFE_TO_INSTALL'));
});
test('multi-rail source estimate is based on user values and never promises energy conversion efficiency',()=>{
 const h=configured(),report=h.api.analyze();
 near(report.power.nominalLoadW,1);
 near(report.power.peakLoadW,3);
 near(report.power.dailyWh,4);
 near(report.power.sourceContinuousW,5);
 near(report.power.sourcePeakW,10);
 assert.equal(report.power.conversionLossIncluded,false);
 assert.equal(report.power.currentSummingAcrossDifferentRails,false);
 assert.equal(report.status,'PRELIMINARY_REVIEW_ONLY');
 assert.ok(report.issues.some(x=>x.code==='CONVERSION_LOSSES_UNKNOWN'));
 assert.ok(report.issues.some(x=>x.code==='PHYSICAL_SIGNOFF_PENDING'));
});
test('inadequate continuous and peak supplies are blocked by measured/user input',()=>{
 const h=configured(),a=h.api;
 a.configure('continuousA',.1);
 a.configure('peakA',.4);
 const r=a.analyze();
 assert.ok(r.issues.some(x=>x.code==='CONTINUOUS_BUDGET_EXCEEDED'));
 assert.ok(r.issues.some(x=>x.code==='PEAK_BUDGET_EXCEEDED'));
 assert.equal(r.status,'INPUTS_INCOMPLETE_OR_BLOCKED');
});
test('duplicate controller GPIO pins block GPIO/PWM collisions, but permit shared I²C bus with unique address',()=>{
 const h=boot(),a=h.api;
 a.addDevice();a.addDevice();
 a.updateDevice('MOD1','interface','gpio');a.updateDevice('MOD1','pins',['GPIO21']);
 a.updateDevice('MOD2','interface','pwm');a.updateDevice('MOD2','pins',['GPIO21']);
 let r=a.analyze();assert.ok(r.issues.some(x=>x.code==='PIN_COLLISION'));
 a.updateDevice('MOD1','interface','i2c');a.updateDevice('MOD2','interface','i2c');
 a.updateDevice('MOD1','pins',['GPIO21','GPIO22']);
 a.updateDevice('MOD2','pins',['GPIO21','GPIO22']);
 a.updateDevice('MOD1','i2cAddress','0x40');a.updateDevice('MOD2','i2cAddress','0x41');
 r=a.analyze();
 assert.ok(!r.issues.some(x=>x.code==='PIN_COLLISION'));
 assert.ok(!r.issues.some(x=>x.code==='I2C_ADDRESS_COLLISION'));
 a.updateDevice('MOD2','i2cAddress','0x40');
 assert.ok(a.analyze().issues.some(x=>x.code==='I2C_ADDRESS_COLLISION'));
});
test('missing or malformed I²C pin assignment is flagged rather than inventing actual controller pinout',()=>{
 const h=boot(),a=h.api;
 a.addDevice();a.updateDevice('MOD1','interface','i2c');
 assert.ok(a.analyze().issues.some(x=>x.code==='GPIO_UNASSIGNED'));
 a.updateDevice('MOD1','pins',['GPIO21']);
 assert.ok(a.analyze().issues.some(x=>x.code==='I2C_PIN_COUNT'));
 a.updateDevice('MOD1','pins',['GPIO21','GPIO22']);
 assert.ok(a.analyze().issues.some(x=>x.code==='I2C_ADDRESS_MISSING'));
 assert.equal(a.analyze().io.validatedControllerPinout,false);
});
test('invalid numeric ranges, duplicates and prototype-unsafe field names never mutate saved blueprint',()=>{
 const h=configured(),a=h.api,before=a.snapshot();
 assert.throws(()=>a.updateDevice('MOD1','peakA',.1),/peakA/);
 assert.throws(()=>a.configure('peakA',.2),/peakA/);
 assert.throws(()=>a.configure('voltageV',0),/voltageV/);
 assert.throws(()=>a.updateDevice('MOD1','pins',['<script>']),/pins/);
 assert.throws(()=>a.updateDevice('MOD1','__proto__',{}),/Unknown module field/);
 assert.deepEqual(a.snapshot(),before);
});
test('project state is locally persistent, loading corrupt state is fail-closed',()=>{
 const h=boot(),a=h.api;
 a.useTemplate('hydro');a.configure('name','Demo hydroponik');
 const storage=Object.fromEntries(h.store);
 assert.equal(boot(storage).api.snapshot().name,'Demo hydroponik');
 const damaged=boot({'pcbpro0045-system-blueprint-v130':'{"devices":[]}'}).api;
 assert.equal(damaged.snapshot().devices.length,0);
 assert.match(damaged.loadIssue,/tidak valid/);
});
test('schema validates project size, device category, address and unsafe IDs',()=>{
 const h=boot(),a=h.api;
 const obj=a.newBlueprint('smart');
 obj.devices[0].id='__proto__';
 assert.equal(a.validate(obj).ok,false);
 obj.devices[0].id='MCU';
 obj.devices[1].id='MCU';
 assert.equal(a.validate(obj).ok,false);
 obj.devices[1].id='PIR';
 obj.devices[1].i2cAddress='0xGG';
 assert.equal(a.validate(obj).ok,false);
});
test('new Blueprint is integrated with builder view, encrypted cloud and full-project backup',()=>{
 const base=readFileSync(new URL('../routes/+page.svelte',import.meta.url),'utf8');
 const runtime=file('runtime-loader.js');
 const db=file('database-engine-v117.js');
 const backup=file('portable-backup-v124.js');
 const ui=file('system-studio-v130.js');
 assert.match(base,/activeView === 'Builder'/);
 assert.match(base,/pcbpro0045-system-blueprint-v130/);
 assert.match(runtime,/system-architect-v130\.js/);
 assert.match(runtime,/system-studio-v130\.js/);
 assert.match(db,/systemBlueprint:window\.PCBProSystemArchitect/);
 assert.match(db,/pcbpro:system-builder-changed/);
 assert.match(backup,/bundle\.systemBlueprint/);
 assert.match(backup,/KEY\.blueprint/);
 assert.match(ui,/data-template/);
 assert.match(ui,/PCBProVerificationV125\.inspect/);
});

test('reserved I2C 7-bit addresses are surfaced using NXP UM10204, normal 0x40 is accepted',()=>{
 const h=boot(),a=h.api;
 a.addDevice();a.updateDevice('MOD1','interface','i2c');
 a.updateDevice('MOD1','pins',['GPIO21','GPIO22']);
 for(const address of ['0x00','0x03','0x07','0x78','0x7F']){
  a.updateDevice('MOD1','i2cAddress',address);
  assert.ok(a.analyze().issues.some(x=>x.code==='I2C_RESERVED_ADDRESS'),address);
 }
 a.updateDevice('MOD1','i2cAddress','0x40');
 assert.ok(!a.analyze().issues.some(x=>x.code==='I2C_RESERVED_ADDRESS'));
 assert.ok(a.analyze().issues.some(x=>x.code==='CONTROLLER_PINOUT_UNVERIFIED'));
});

test('conceptual power tree reflects project modules and safely escapes user input',()=>{
 const h=boot(),a=h.api;a.addDevice();
 a.updateDevice('MOD1','name','<script>alert(1)</script>');
 const win={PCBProSystemArchitect:a};
 const doc={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(readFileSync(new URL('../../static/system-studio-v130.js',import.meta.url),'utf8'),
  {window:win,document:doc},{filename:'system-studio-v130.js'});
 const svg=win.PCBProSystemStudio.powerTree(a.snapshot());
 assert.match(svg,/SOURCE \/ SUPPLY/);
 assert.match(svg,/MOD1/);
 assert.match(svg,/&lt;script&gt;/);
 assert.doesNotMatch(svg,/<script>/);
 assert.match(svg,/bukan koneksi listrik\/pin/);
});
