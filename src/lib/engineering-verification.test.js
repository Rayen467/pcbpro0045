// @ts-nocheck -- VM browser mocks intentionally use dynamic fixture types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const getScript = name => readFileSync(new URL('../../static/'+name, import.meta.url), 'utf8');
function boot(name, api, overrides={}) {
  const w={...api, dispatchEvent() {}};
  const context={
    window:w,document:{readyState:'loading',addEventListener(){},querySelector(){return null;}},
    localStorage:{getItem(){return null;}},CustomEvent:class {},
    setTimeout(){}, Blob,URL, structuredClone, ...overrides
  };
  vm.runInNewContext(getScript(name), context, {filename:name});
  return w;
}
const component=(id,code,value)=>({id,code,value,name:code,footprint:code+'_0805',sx:1,sy:1,px:1,py:1,rot:0});
const resistor=component('R1','R','330 Ω');
const source=component('V1','V','5 V');
const ground=component('G1','GND','0 V');
const nets=[
  {name:'VCC',pinList:['V1.1','R1.1']},
  {name:'GND',pinList:['V1.2','R1.2','G1.1']}
];

test('SPICE exporter generates actual current-net circuit with zero ground node',()=>{
 const w=boot('spice-netlist-v125.js',{PCBProProject:{getComponents:()=>[source,resistor,ground]},PCBProWireEngine:{nets}});
 const result=w.PCBProSpiceV125.current();
 assert.equal(result.ok,true, JSON.stringify(result.issues));
 const text=result.lines.join('\n');
 assert.match(text,/R1 VCC 0 3\.300000000000e\+2/);
 assert.match(text,/V1 VCC 0 DC 5\.000000000000e\+0/);
 assert.match(text,/\.op\n\.end/);
 assert.equal(result.stats.mappedDevices,2);
});
test('empty design never invents a default demo source or resistor',()=>{
 const w=boot('spice-netlist-v125.js',{PCBProProject:{getComponents:()=>[]},PCBProWireEngine:{nets:[]}});
 const result=w.PCBProSpiceV125.current();
 assert.equal(result.ok,false);
 assert.equal(result.lines.length,0);
 assert.ok(result.issues.some(x=>x.code==='NO_COMPONENTS'));
});
test('SPICE blocks unsupported ICs, missing pins, and incorrect values',()=>{
 const w=boot('spice-netlist-v125.js',{});
 const api=w.PCBProSpiceV125;
 assert.ok(api.build([resistor,source,component('U1','U','Op amp'),ground],nets).issues.some(x=>x.code==='UNSUPPORTED_MODEL'));
 assert.ok(api.build([resistor,source,ground],nets.slice(0,1)).issues.some(x=>x.code==='MISSING_PINS'));
 assert.ok(api.build([{...resistor,value:'not a number'},source,ground],nets).issues.some(x=>x.code==='INVALID_VALUE'));
 assert.ok(api.build([{...resistor,value:'0 Ω'},source,ground],nets).issues.some(x=>x.code==='INVALID_VALUE'));
});
test('SPICE does not conflate 10M with 10m and rejects multi-net pin assignment',()=>{
 const api=boot('spice-netlist-v125.js',{}).PCBProSpiceV125;
 assert.equal(api.parseValue('10MΩ'),1e7);
 assert.equal(api.parseValue('10mΩ'),0.01);
 assert.equal(api.parseValue('4.7µF'),4.7e-6);
 assert.equal(api.parseValue('garbage'),Number.NaN);
 const multi=[...nets,{name:'EXTRA',pinList:['R1.1','R1.2']}];
 assert.ok(api.build([resistor,source,ground],multi).issues.some(x=>x.code==='PIN_MULTI_NET'));
});
test('diode only exports with conspicuous opt-in generic model',()=>{
 const diode=component('D1','LED','Red 2 V');
 const n=[...nets,{name:'LED_A',pinList:['D1.1']}];
 const components=[resistor,source,ground,diode];
 const api=boot('spice-netlist-v125.js',{}).PCBProSpiceV125;
 assert.ok(api.build(components,n).issues.some(x=>x.code==='MISSING_PINS'));
 const n2=[...nets,{name:'LED_A',pinList:['D1.1','D1.2']}];
 assert.ok(api.build(components,n2).issues.some(x=>x.code==='SHORTED_DEVICE'));
 const n3=[...nets.map(n=>({...n,pinList:n.name==='GND'?[...n.pinList,'D1.2']:n.pinList})),{name:'LED_A',pinList:['D1.1','R9.1']}];
 assert.ok(api.build(components,n3).issues.some(x=>x.code==='UNKNOWN_PIN'));
 const proper=[{name:'VCC',pinList:['V1.1','R1.1']},{name:'LED_A',pinList:['R1.2','D1.1']},{name:'GND',pinList:['V1.2','G1.1','D1.2']}];
 assert.ok(api.build(components,proper).issues.some(x=>x.code==='MISSING_VENDOR_MODEL'));
 const demo=api.build(components,proper,{allowGenericDiodes:true});
 assert.equal(demo.ok,true);
 assert.match(demo.lines.join('\n'),/DEMO_LED/);
 assert.ok(demo.issues.some(x=>x.code==='GENERIC_MODEL'));
});
function physical({tracks=[],vias=[],outline=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]}={}) {
 const w=boot('physical-drc-v121.js',{
  PCBProBoardModel:{model:{outline,tracks,placements:[],pads:[]}},
  PCBProAdvancedBoard:{model:{vias,zones:[],keepouts:[]}},
  PCBProProfessional:{state:{trackWidthMm:0.2,clearanceMm:0.2,edgeClearanceMm:0.15,viaDiameterMm:0.6,viaDrillMm:0.3}},
  PCBProManufacturing:{state:{widthMm:10,heightMm:10}}
 });
 return w.PCBProPhysicalDRC.run();
}
test('physical DRC tests crossings even when both tracks have missing net assignment',()=>{
 const tracks=[
  {id:'T1',layer:'F.Cu',widthMm:.25,start:{x:2,y:2},end:{x:8,y:8}},
  {id:'T2',layer:'F.Cu',widthMm:.25,start:{x:2,y:8},end:{x:8,y:2}}
 ];
 const r=physical({tracks});
 assert.ok(r.findings.some(f=>f.code==='TRACK_UNASSIGNED_NET'));
 assert.ok(r.findings.some(f=>f.code==='TRACK_CLEARANCE'));
 assert.equal(r.ready,false);
});
test('physical DRC rejects tracks and vias wholly outside board outline',()=>{
 const tracks=[{id:'T1',net:'A',layer:'F.Cu',widthMm:.25,start:{x:20,y:20},end:{x:21,y:20}}];
 const vias=[{id:'V1',net:'A',x:20,y:20,diameterMm:.6,drillMm:.3}];
 const r=physical({tracks,vias});
 assert.ok(r.findings.some(f=>f.code==='TRACK_OUTSIDE_OUTLINE'));
 assert.ok(r.findings.some(f=>f.code==='VIA_OUTSIDE_OUTLINE'));
 assert.equal(r.ready,false);
});
