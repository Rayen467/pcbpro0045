// @ts-nocheck -- Browser VM fixtures deliberately model dynamic DOM and runtime APIs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const get=name=>readFileSync(new URL('../../static/'+name,import.meta.url),'utf8');
const curriculum=JSON.parse(get('academy-curriculum-v128.json'));
function academy(existing){
 const store=new Map(existing?Object.entries(existing):[]);
 const hooks={};
 const document={
  readyState:'complete',
  addEventListener(name,callback){hooks[name]=callback},
  querySelector(){return null},
  getElementById(){return null}
 };
 const listeners=[];
 const window={dispatchEvent(e){listeners.push(e)}};
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const context={window,document,localStorage,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},
  structuredClone,setTimeout,fetch:async url=>({ok:url==='/academy-curriculum-v128.json',json:async()=>curriculum})};
 vm.runInNewContext(get('academy-hub-v128.js'),context,{filename:'academy-hub-v128.js'});
 return {api:window.PCBProAcademy,store,listeners,ready:async()=>{
   for(let i=0;i<8;i++)await Promise.resolve();
 }};
}
function routing(){
 const window={};
 const document={readyState:'loading',addEventListener(){}};
 vm.runInNewContext(get('routing-trainer-v128.js'),{window,document,structuredClone},
   {filename:'routing-trainer-v128.js'});
 return window.PCBProRoutingTrainer;
}
test('structured curriculum contains 14 modules / 42 substantive lessons / beginner-first ordering',()=>{
 assert.equal(curriculum.version,'1.28.0');
 assert.equal(curriculum.stages.length,14);
 assert.equal(curriculum.totalLessons,42);
 assert.equal(curriculum.stages[0].lessons[0].title,'Apa yang sebenarnya akan kita bangun?');
 const ids=new Set();
 for(const s of curriculum.stages){
   assert.equal(s.lessons.length,3);
   assert.ok(s.sources.length>=1);
   for(const l of s.lessons){
     assert.ok(!ids.has(l.id),'duplicate '+l.id);ids.add(l.id);
     for(const field of ['body','example','exercise','pass'])assert.ok(l[field].length>=35,l.id+' lacks '+field);
     assert.ok(Number.isInteger(l.quiz.answer)&&l.quiz.answer>=0&&l.quiz.answer<l.quiz.options.length);
     assert.equal(l.quiz.options.length,3);
     assert.ok(['Learning','Schematic','PCB','Electrical','Fabrication'].includes(l.view));
   }
 }
 for(const track of curriculum.tracks)for(const stage of track.stages)
   assert.ok(curriculum.stages.some(s=>s.id===stage),'unknown stage '+stage);
});
test('mastery requires both practice confirmation and a correct quiz (not just a click)',async()=>{
 const h=academy();await h.ready();
 const id='M00-L1';
 assert.equal(h.api.ready,true);
 h.api.quiz(id,1);
 assert.equal(h.api.progress.completed[id],undefined);
 h.api.quiz(id,0);
 assert.equal(h.api.progress.quizPassed[id],true);
 assert.equal(h.api.progress.completed[id],undefined);
 h.api.togglePractice(id,true);
 assert.equal(h.api.progress.completed[id],true);
 h.api.togglePractice(id,false);
 assert.equal(h.api.progress.completed[id],undefined);
 assert.equal(h.api.progress.quizPassed[id],true);
});
test('academy progress survives reload and merging portable state never erases prior achievements',async()=>{
 const first=academy();await first.ready();
 first.api.quiz('M00-L1',0);first.api.togglePractice('M00-L1',true);first.api.markLab('led');
 const saved=first.store.get('pcbpro0045-academy-progress-v128');
 const second=academy({'pcbpro0045-academy-progress-v128':saved});await second.ready();
 assert.equal(second.api.progress.completed['M00-L1'],true);
 assert.equal(second.api.progress.labs.led,true);
 const oldState=second.api.progress;
 const incoming={version:'1.28.0',completed:{'M01-L1':true},practiced:{'M01-L1':true},
   quizPassed:{'M01-L1':true},labs:{i2c:true},selected:'M01-L1',track:'all'};
 second.api.restore(incoming,{merge:true});
 assert.equal(second.api.progress.completed['M00-L1'],true);
 assert.equal(second.api.progress.completed['M01-L1'],true);
 assert.equal(second.api.progress.labs.i2c,true);
 assert.equal(second.api.progress.selected,oldState.selected);
});
test('academy rejects unsafe/unbounded progress and rejects unknown labs',async()=>{
 const h=academy();await h.ready();
 assert.equal(h.api.validate({completed:Object.fromEntries([['__proto__',true]]),selected:'a',track:'all'}).ok,false);
 assert.equal(h.api.validate({completed:[],selected:'a',track:'all'}).ok,false);
 assert.equal(h.api.validate({completed:{a:'YES'},selected:'a',track:'all'}).ok,false);
 assert.throws(()=>h.api.markLab('mains'),/Unknown/);
});
test('three low-voltage routing scenarios distinguish correct net connections from shorts',()=>{
 const r=routing();
 assert.deepEqual(Array.from(r.examples,x=>x.id),['led','i2c','motor']);
 for(const exercise of r.examples){
  const pass=r.evaluate(exercise,exercise.edges);
  assert.equal(pass.ok,true,exercise.id);
  assert.equal(pass.correct,exercise.edges.length);
  const missing=r.evaluate(exercise,exercise.edges.slice(1));
  assert.equal(missing.ok,false);
  assert.equal(missing.missing.length,1);
 }
 const led=r.examples[0];
 const short=r.evaluate(led,[...led.edges,['SRC.VCC','SRC.GND']]);
 assert.equal(short.ok,false);
 assert.equal(short.incorrect.length,1);
 assert.ok(led.intro.includes('Tidak ada kabel fisik'));
});
test('backup + cloud + native view reference same Academy data rather than disconnected demo',()=>{
 const runtime=get('runtime-loader.js');
 const backup=get('portable-backup-v124.js');
 const cloud=get('database-engine-v117.js');
 const page=readFileSync(new URL('../routes/+page.svelte',import.meta.url),'utf8');
 assert.match(runtime,/academy-hub-v128/);
 assert.match(runtime,/routing-trainer-v128/);
 assert.match(backup,/academyProgress/);
 assert.match(backup,/mergedAcademy/);
 assert.match(cloud,/academyProgress:window.PCBProAcademy/);
 assert.match(cloud,/pcbpro:academy-changed/);
 assert.match(page,/activeView === 'Learning'/);
});
