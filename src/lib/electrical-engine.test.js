// @ts-nocheck -- vm sandbox mocks deliberately use dynamic browser objects.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../../static/electrical-engine-v126.js',import.meta.url),'utf8');
function harness(seed){
  const store=new Map(seed?Object.entries(seed):[]);
  const win={dispatchEvent(){},PCBProDatabase:{scheduleSave(){}}};
  const context={window:win,
    document:{readyState:'complete',addEventListener(){}},
    localStorage:{
      getItem:key=>store.has(key)?store.get(key):null,
      setItem:(key,value)=>store.set(key,String(value)),
      removeItem:key=>store.delete(key)
    },
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},
    structuredClone,Blob,URL,setTimeout
  };
  vm.runInNewContext(script,context,{filename:'electrical-engine-v126.js'});
  return {api:win.PCBProElectrical,store};
}
const approx=(actual,wanted,tolerance=1e-6)=>assert.ok(Math.abs(actual-wanted)<tolerance,actual+' !== '+wanted);

test('1-phase active power, current and copper voltage drop are consistent',()=>{
  const h=harness();
  h.api.add();
  h.api.update('C1','watts',1000);
  h.api.update('C1','tempC',20);
  const r=h.api.calculate();
  assert.equal(r.ok,true);
  approx(r.circuits[0].currentA,1000/230);
  approx(r.circuits[0].drop.volts,2*(1000/230)*10*(17.241/2.5)/1000,1e-8);
  assert.equal(r.summary.watts,1000);
  assert.equal(r.scope,'PRELIMINARY-NOT-APPROVED-FOR-INSTALLATION');
});
test('balanced 3-phase source uses sqrt(3), and unbalanced branches are flagged',()=>{
  const h=harness();h.api.configure('mode','3p');
  h.api.add();h.api.update('C1','mode','3p');h.api.update('C1','watts',3000);
  let r=h.api.calculate();
  approx(r.circuits[0].currentA,3000/(Math.sqrt(3)*400));
  for(const i of ['L1','L2','L3'])approx(r.summary.phaseCurrent[i],3000/(Math.sqrt(3)*400));
  h.api.add();h.api.update('C2','watts',1000);
  r=h.api.calculate();
  approx(r.circuits[1].voltageV,400/Math.sqrt(3));
  assert.ok(r.findings.some(f=>f.code==='UNBALANCED_APPROX'));
  assert.ok(r.summary.phaseCurrent.L2<r.summary.phaseCurrent.L1);
});
test('invalid inputs and phase mismatch refuse mutation without writing data',()=>{
  const h=harness();
  h.api.add();
  assert.throws(()=>h.api.update('C1','pf',0),/pf/);
  assert.equal(h.api.snapshot().circuits[0].pf,1);
  assert.throws(()=>h.api.update('C1','sectionMm2',0),/sectionMm2/);
  assert.throws(()=>h.api.update('C1','mode','3p'),/mode/);
  assert.equal(h.api.snapshot().circuits[0].mode,'1p');
  assert.ok(h.store.has('pcbpro0045-electrical-v126'));
});
test('1-phase switch clears incompatible 3-phase branches; data persists across reload',()=>{
  const h=harness();h.api.configure('mode','3p');h.api.add();h.api.update('C1','mode','3p');
  h.api.configure('mode','1p');
  assert.equal(h.api.snapshot().circuits[0].mode,'1p');
  const restored=harness(Object.fromEntries(h.store));
  assert.equal(restored.api.snapshot().circuits.length,1);
  restored.api.reset();
  assert.equal(restored.api.snapshot().circuits.length,0);
});
test('load schedule CSV prevents spreadsheet injection from user-supplied labels',()=>{
  const h=harness();h.api.add();h.api.update('C1','name','=HYPERLINK("evil")');
  const csv=h.api.csv();
  assert.match(csv,/'=HYPERLINK/);
  assert.match(csv,/"ID","Beban"/);
});
test('single-line SVG escapes user text and does not claim fabrication approval',()=>{
  const h=harness();h.api.add();
  h.api.configure('title','<img onerror=alert(1)>');
  const svg=h.api.sld();
  assert.doesNotMatch(svg,/<img/);
  assert.match(svg,/&lt;img/);
  assert.match(svg,/NOT A WIRING\/PROTECTION APPROVAL/);
});
test('breaker smaller than load is flagged, larger breaker is not certified',()=>{
  const h=harness();h.api.add();h.api.update('C1','watts',5000);h.api.update('C1','breakerA',6);
  const report=h.api.calculate();
  assert.ok(report.findings.some(f=>f.code==='LOAD_ABOVE_BREAKER'));
  assert.ok(report.findings.some(f=>f.code==='NOT_VERIFIED'));
  assert.ok(!JSON.stringify(report).includes('approved'));
});
