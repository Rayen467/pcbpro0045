// @ts-nocheck -- Pure browser-theme VM fixtures intentionally mock window, document and media APIs.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const file = name => readFileSync(new URL('../../'+name,import.meta.url),'utf8');
const script = file('static/theme-controller-v129.js');
const css = file('static/design-system-v129.css');
const appHtml = file('src/app.html');
const svelte = file('src/routes/+page.svelte');

function boot({saved=null,dark=false,storageThrows=false}={}){
 const values=new Map(saved===null?[]:[['sirkuitlab-theme-v129',saved]]);
 const listeners=new Map(), mediaListeners=new Map();
 const html={dataset:{},style:{colorScheme:''}};
 const selectors=[];
 const meta={attributes:{},setAttribute(key,value){this.attributes[key]=value;}};
 const themeSelect={value:'',getAttribute(){return null;}};
 const document={
   documentElement:html,
   querySelector(selector){selectors.push(selector);return selector==='meta[name="theme-color"]'?meta:null;},
   querySelectorAll(selector){return selector==='[data-sirkuitlab-theme-select]'?[themeSelect]:[];}
 };
 const media={
   matches:dark,
   addEventListener(event,fn){mediaListeners.set(event,fn);}
 };
 const events=[];
 const window={
   localStorage:{
     getItem(k){if(storageThrows)throw Error('Storage blocked');return values.get(k)??null;},
     setItem(k,v){if(storageThrows)throw Error('Storage blocked');values.set(k,v);}
   },
   matchMedia:()=>media,
   addEventListener(name,fn){listeners.set(name,fn);},
   dispatchEvent(e){events.push(e);}
 };
 const CustomEvent=class{constructor(type,init){this.type=type;this.detail=init.detail;}};
 vm.runInNewContext(script,{window,document,CustomEvent},{filename:'theme-controller-v129.js'});
 return {api:window.PCBProTheme,html,values,media,mediaListeners,listeners,meta,themeSelect,events};
}
test('first visit starts in bright clean Light mode without waiting for Svelte hydration',()=>{
 const h=boot();
 assert.equal(h.api.getMode(),'light');
 assert.equal(h.html.dataset.theme,'light');
 assert.equal(h.html.dataset.themePreference,'light');
 assert.equal(h.html.style.colorScheme,'light');
 assert.equal(h.themeSelect.value,'light');
 assert.equal(h.meta.attributes.content,'#f5f7fa');
 assert.equal(h.events[0].type,'sirkuitlab:theme-change');
});
test('explicit Dark mode persists and overrides a light OS; reload respects saved mode',()=>{
 const h=boot();
 h.api.setMode('dark');
 assert.equal(h.values.get('sirkuitlab-theme-v129'),'dark');
 assert.equal(h.html.dataset.theme,'dark');
 assert.equal(h.html.style.colorScheme,'dark');
 assert.equal(h.themeSelect.value,'dark');
 assert.equal(boot({saved:h.values.get('sirkuitlab-theme-v129'),dark:false}).html.dataset.theme,'dark');
});
test('System mode follows user OS changes, and explicit mode blocks OS-only changes',()=>{
 const h=boot({dark:false});
 h.api.setMode('system');
 assert.equal(h.html.dataset.theme,'light');
 h.media.matches=true;h.mediaListeners.get('change')();
 assert.equal(h.html.dataset.theme,'dark');
 assert.equal(h.meta.attributes.content,'#101720');
 h.api.setMode('light');
 h.media.matches=false;h.mediaListeners.get('change')();
 h.media.matches=true;h.mediaListeners.get('change')();
 assert.equal(h.html.dataset.theme,'light');
 assert.equal(h.html.dataset.themePreference,'light');
});
test('theme synchronizes changes from another browser tab and rejects invalid preferences',()=>{
 const h=boot({saved:'random-key'});
 assert.equal(h.api.getMode(),'light');
 h.listeners.get('storage')({key:'sirkuitlab-theme-v129',newValue:'dark'});
 assert.equal(h.api.getMode(),'dark');
 h.listeners.get('storage')({key:'sirkuitlab-theme-v129',newValue:'bad'});
 assert.equal(h.api.getMode(),'light');
 assert.throws(()=>h.api.setMode('bad'),/Theme must be/);
});
test('theme works in private mode when storage throws and without OS matchMedia support',()=>{
 const h=boot({storageThrows:true,dark:true});
 assert.equal(h.html.dataset.theme,'light');
 assert.doesNotThrow(()=>h.api.setMode('dark'));
 assert.equal(h.api.getMode(),'dark');
 assert.equal(h.html.dataset.theme,'dark');
});
test('2026 design system covers shell, Learning Academy and Electrical without repainting copper as success',()=>{
 const patterns=[
  /--sl-bg:#f5f7fa/,/--sl-surface:#ffffff/,/html\[data-theme="dark"\]/,
  /--sl-accent/,/\.topbar/,/\.tabs button\.active/,/\.leftbar/,/\.stage/,
  /\.node/,/\.ac-root/,/\.el-root/,/#ea-v127/,/#pcbpro-ux-dock/,
  /prefers-reduced-motion/,/focus-visible/
 ];
 for(const p of patterns)assert.match(css,p,'Theme coverage missing: '+p);
 assert.doesNotMatch(css,/filter\s*:\s*invert\(/i);
 assert.doesNotMatch(css,/\.board\s*\{\s*background:\s*var\(/);
});
test('pre-paint head, explicit theme selector, runtime revision and product branding are wired',()=>{
 assert.match(appHtml,/<script src="\/theme-controller-v129\.js\?v=1\.29\.0"><\/script>/);
 assert.match(appHtml,/<link rel="stylesheet" href="\/design-system-v129\.css\?v=1\.29\.0"/);
 assert.ok(appHtml.indexOf('theme-controller-v129.js')<appHtml.indexOf('%sveltekit.head%'));
 assert.match(appHtml,/runtime-loader\.js\?v=1\.29\.0/);
 assert.match(svelte,/data-sirkuitlab-theme-select/);
 assert.match(svelte,/onchange=\{\(event\)=>changeTheme\(event.currentTarget.value\)\}/);
 assert.match(svelte,/<strong>SirkuitLab<\/strong>/);
 assert.match(svelte,/getMode\?\.\(\)/);
});
