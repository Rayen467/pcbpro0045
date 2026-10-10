// @ts-nocheck -- Test harness models browser globals and project fixtures dynamically.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../../static/'+name,import.meta.url),'utf8');

function harness(){
  const state=new Map();
  const w={dispatchEvent(){}};
  const doc={readyState:'loading',addEventListener(){}};
  const localStorage={
    getItem:key=>state.has(key)?state.get(key):null,
    setItem:(key,value)=>state.set(key,String(value)),
    removeItem:key=>state.delete(key)
  };
  const context={window:w,document:doc,localStorage,structuredClone,
    CustomEvent:class{constructor(name,opts){this.name=name;this.detail=opts?.detail}},
    setTimeout,Blob,URL};
  for(const name of ['electrical-engine-v126.js','electrical-advanced-v127.js']){
    vm.runInNewContext(read(name),context,{filename:name});
  }
  const core=w.PCBProElectrical,adv=w.PCBProElectricalAdvanced;
  const initial=core.snapshot(); // core starts with defaults before DOMContentLoaded.
  return {core,adv,state,initial};
}
const near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,a+' ≠ '+b);
const update=(h,id,key,value)=>h.core.update(id,key,value);
const cfg=(h,key,value)=>h.adv.configure(key,value);
const schedule=(h,id,start,hours)=>{h.adv.updateCircuit(id,'startHour',start);h.adv.updateCircuit(id,'hoursPerDay',hours);};

test('2026 energy extension opens older v1.26 projects without imaginary operating schedules or PV yield',()=>{
  const h=harness();h.core.add();
  const r=h.adv.analyze();
  assert.equal(r.analysisAvailable,false);
  assert.ok(r.issues.some(x=>x.code==='OPERATING_HOURS_MISSING'));
  assert.equal(h.core.snapshot().advanced,undefined);
  assert.equal(r.coverage.fullAcPowerFlow,false);
});
test('single-phase neutral fundamental magnitude equals supplied balanced scalar example',()=>{
  const h=harness();h.core.add();
  update(h,'C1','watts',1000);
  schedule(h,'C1',8,2);
  const r=h.adv.analyze();
  const I=1000/230;
  near(r.neutral.estimatedFundamentalNeutralA,I);
  near(r.profile.loadKWh,2);
  near(r.profile.gridImportKWh,2);
});
test('balanced three-phase fundamental neutral cancels without assuming harmonics are zero',()=>{
  const h=harness();h.core.configure('mode','3p');h.core.add();
  update(h,'C1','mode','3p');update(h,'C1','watts',3000);update(h,'C1','pf',.8);
  schedule(h,'C1',8,4);
  const r=h.adv.analyze();
  near(r.neutral.estimatedFundamentalNeutralA,0);
  assert.match(r.neutral.caveat,/harmonic/);
  near(r.profile.loadKWh,12);
});
test('fractional overnight schedules integrate by hourly overlap',()=>{
  const h=harness();h.core.add();update(h,'C1','watts',1000);
  schedule(h,'C1',22,3.5);
  const r=h.adv.analyze(),p=r.profile;
  near(p.loadKWh,3.5);
  near(p.hourly[22].loadKWh,1);
  near(p.hourly[23].loadKWh,1);
  near(p.hourly[0].loadKWh,1);
  near(p.hourly[1].loadKWh,.5);
  near(p.hourly[2].loadKWh,0);
});
test('PV requires user-provided generation curve; 24 point dataset is validated',()=>{
  const h=harness();h.core.add();schedule(h,'C1',8,4);
  cfg(h,'pvKWp',5);
  assert.equal(h.adv.analyze().analysisAvailable,false);
  assert.ok(h.adv.analyze().issues.some(x=>x.code==='PV_PROFILE_MISSING'));
  assert.throws(()=>h.adv.setProfile('0,1,2'),/24 factors/);
  assert.throws(()=>h.adv.setProfile('1,'.repeat(23)+'2'),/24 factors/);
  assert.equal(h.core.snapshot().advanced.energy.pvHourlyFactors,null);
  h.adv.setProfile(new Array(24).fill(0).join(','));
  assert.equal(h.adv.analyze().analysisAvailable,true);
});
test('deterministic PV + battery hourly balance conserves energy and respects capacity',()=>{
  const h=harness();h.core.add();update(h,'C1','watts',1000);schedule(h,'C1',12,1);
  cfg(h,'pvKWp',2);const factors=Array(24).fill(0);factors[11]=1;
  h.adv.setProfile(factors.join(','));
  h.adv.configureBattery({batteryCapacityKWh:1,batteryMaxKW:1,
    roundtripEfficiency:1,reserveSocPercent:0});
  const r=h.adv.analyze(),p=r.profile;
  assert.equal(r.ok,true);
  near(p.pvKWh,2);near(p.loadKWh,1);near(p.gridImportKWh,0);
  near(p.batteryChargeInputKWh,1);near(p.batteryDischargeOutputKWh,1);
  near(p.curtailedKWh,1);near(p.gridExportKWh,0);near(p.batteryEndingSOCkWh,0);
  assert.equal(p.gridCostRp,null);
});
test('battery roundtrip loss reduces delivered energy and cost requires explicit tariff',()=>{
  const h=harness();h.core.add();update(h,'C1','watts',1000);schedule(h,'C1',12,1);
  cfg(h,'pvKWp',1);const factors=Array(24).fill(0);factors[11]=1;h.adv.setProfile(factors.join(','));
  h.adv.configureBattery({batteryCapacityKWh:1,batteryMaxKW:1,
    roundtripEfficiency:.81,reserveSocPercent:0});
  cfg(h,'tariffRpKWh',1500);
  const p=h.adv.analyze().profile;
  near(p.gridImportKWh,.19);
  near(p.gridCostRp,285);
  near(p.batteryEndingSOCkWh,0);
});
test('fault breaking capacity blocks only on user-entered comparable Ik and Icu',()=>{
  const h=harness();h.core.add();
  let r=h.adv.analyze();assert.ok(r.issues.some(x=>x.code==='FAULT_LEVEL_NOT_ENTERED'));
  h.adv.updateCircuit('C1','prospectiveIkKA',10);
  h.adv.updateCircuit('C1','breakerIcuKA',6);
  r=h.adv.analyze();
  assert.equal(r.ok,false);
  assert.ok(r.issues.some(x=>x.code==='BREAKING_CAPACITY_BELOW_FAULT'&&x.severity==='blocker'));
  h.adv.updateCircuit('C1','breakerIcuKA',16);
  r=h.adv.analyze();
  assert.equal(r.ok,true);
  assert.ok(r.issues.some(x=>x.code==='BREAKING_CAPACITY_ONLY'));
  assert.ok(r.issues.some(x=>x.code==='ELECTRICAL_SIGNOFF_PENDING'));
});
test('motor and EV review labels never claim protection selection',()=>{
  const h=harness();h.core.add();h.core.add();
  h.adv.updateCircuit('C1','category','motor');h.adv.updateCircuit('C1','startingMultiplier',5);
  h.adv.updateCircuit('C2','category','ev');
  const r=h.adv.analyze();
  assert.ok(r.issues.some(x=>x.code==='MOTOR_INRUSH_ESTIMATE'));
  assert.ok(r.issues.some(x=>x.code==='EV_PROTECTION_REQUIRED'));
});
test('corrupt advanced values reject save without mutating prior project snapshot',()=>{
  const h=harness();h.core.add();const before=h.core.snapshot();
  assert.throws(()=>cfg(h,'batteryCapacityKWh',2.5),/batteryMaxKW/);
  assert.deepEqual(h.core.snapshot(),before);
  assert.throws(()=>h.adv.updateCircuit('C1','hoursPerDay',29),/hoursPerDay/);
  assert.deepEqual(h.core.snapshot(),before);
});
test('export permission defaults off and hypothetical export never assumes feed-in tariff',()=>{
  const h=harness();h.core.add();schedule(h,'C1',8,1);
  cfg(h,'pvKWp',2);const a=Array(24).fill(0);a[8]=1;h.adv.setProfile(a.join(','));
  let p=h.adv.analyze().profile;
  near(p.gridExportKWh,0);near(p.curtailedKWh,1.9);assert.equal(p.hypotheticalExportRevenueRp,null);
  cfg(h,'exportEnabled',true);
  p=h.adv.analyze().profile;
  near(p.gridExportKWh,1.9);near(p.curtailedKWh,0);
  assert.equal(p.hypotheticalExportRevenueRp,null);
  assert.ok(h.adv.analyze().issues.some(x=>x.code==='EXPORT_PERMISSION'));
});

test('battery form can only be saved atomically with all required specs',()=>{
 const h=harness();
 assert.throws(()=>h.adv.configureBattery({batteryCapacityKWh:3}),/batteryMaxKW/);
 assert.equal(h.core.snapshot().advanced,undefined);
 h.adv.configureBattery({batteryCapacityKWh:3,batteryMaxKW:1,
   roundtripEfficiency:.9,reserveSocPercent:20});
 assert.equal(h.core.snapshot().advanced.energy.batteryCapacityKWh,3);
 assert.equal(h.core.snapshot().advanced.energy.reserveSocPercent,20);
});
