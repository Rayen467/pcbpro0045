// @ts-nocheck -- VM uses minimal keyboard/DOM interfaces.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../../static/quick-actions-v130.js',import.meta.url),'utf8');
function get(){
 const win={},handlers=new Map();
 const document={readyState:'loading',addEventListener(name,cb){handlers.set(name,cb)}};
 vm.runInNewContext(js,{window:win,document},{filename:'quick-actions-v130.js'});
 return {api:win.PCBProQuickActions,handlers};
}
test('command palette registers all major active workspaces including new Builder',()=>{
 const c=get().api.commands;
 const views=new Set(c.filter(x=>x.view).map(x=>x.view));
 for(const tab of ['Schematic','PCB','Electrical','Learning','Builder','Fabrication','Rules','Release'])
   assert.ok(views.has(tab),'Missing '+tab);
 assert.equal(c.filter(x=>x.key==='verify').length,1);
 assert.equal(c.filter(x=>x.key==='backup').length,1);
});
test('keyword search finds target actions by caption, description and category',()=>{
 const a=get().api;
 assert.ok(a.search('robot').some(x=>x.view==='Builder'));
 assert.ok(a.search('gpio').some(x=>x.view==='Builder')===false); // Not falsely claim unsupported indexing
 assert.ok(a.search('spice').some(x=>x.key==='spice'));
 assert.ok(a.search('backup').some(x=>x.key==='backup'));
 assert.ok(a.search('kelistrikan').every(x=>x.label||x.desc));
 assert.equal(a.search('___nonexistent___').length,0);
});
test('palette script connects Ctrl/Meta K without taking over workspace state',()=>{
 assert.match(js,/e\.ctrlKey\|\|e\.metaKey/);
 assert.match(js,/Escape/);
 assert.match(js,/ArrowDown/);
 assert.match(js,/ArrowUp/);
 assert.match(js,/aria-modal/);
 assert.match(js,/document\.activeElement/);
 assert.doesNotMatch(js,/eval\(/);
});
test('navigation and backup/VERIFY are explicit user actions only',()=>{
 const all=get().api.commands;
 assert.ok(all.filter(x=>x.action).every(x=>typeof x.action==='function'));
 assert.ok(all.filter(x=>x.view).every(x=>!x.action));
 assert.ok(js.includes("if(command.action)"));
});
