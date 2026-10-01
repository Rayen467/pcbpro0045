(() => {
  'use strict';
  if (window.PCBProExplain) return;

  const VERSION='1.13.0';
  const REGISTRY_URL='/explanation-registry-v113.json';
  const PATCH_URL='/patches.json';
  const CHANGE_KEY='pcbpro0045-explain-changes-v113';
  let registry=null;
  let patches=[];
  let explainMode=false;
  let drawerTab='context';
  let currentTarget=null;
  let currentEntry=null;
  let observer=null;
  let scanTimer=0;
  const runtimeEntries=[];

  const lang=()=>window.PCBProUX?.lang||localStorage.getItem('pcbpro0045-lang')||'id';
  const t=(id,en)=>lang()==='id'?id:en;
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const loc=(v)=>typeof v==='string'?v:(v?.[lang()]??v?.id??v?.en??'');
  const norm=(v)=>String(v??'').toLowerCase().replace(/\s+/g,' ').trim();
  const interactiveSelector='button, a, input, select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"]), [data-pcb-view]';
  const resultSelector='.learn-result,.deep-result,.sim-result,.simulation-result,.finding,.findings,.drc-result,.erc-result,.status-card,.result,[data-result],[data-status]';

  const currentRelease={
    version:'1.13.0',date:'2026-10-02',
    title:{id:'Explain Everything — Penjelasan untuk fitur, hasil, status, alur, dan perubahan',en:'Explain Everything — explanations for features, results, status, flow, and changes'},
    changes:{
      id:[
        'Tambah Explanation Center global yang menjelaskan apa sebuah fitur, untuk apa, input, proses, output, cara membaca hasil, batasan, dan langkah berikutnya.',
        'Tambah Mode Jelaskan: aktifkan lalu klik elemen apa pun di workspace untuk melihat konteksnya tanpa menjalankan aksi elemen tersebut.',
        'Semua kontrol interaktif dipindai otomatis. Fitur yang punya dokumentasi khusus diberi penjelasan dedicated; fitur baru yang belum didokumentasikan tetap mendapat fallback yang jujur dan ditandai perlu dokumentasi khusus.',
        'Hasil/check/status dapat dibedah bersama snapshot teks saat ini; hasil tidak diperlakukan sama dengan measurement atau manufacturing sign-off.',
        'Tambah alur awal-ke-akhir PCB Pro dan level kepastian hasil: UI state → derived project state → calculated/simulated → verified datasheet → manufacturing check → physical measurement.',
        'Tambah Coverage Audit untuk melihat berapa kontrol yang sudah punya dokumentasi dedicated dan mana yang masih memakai fallback.',
        'Tambah change-event ledger agar fitur masa depan bisa mendaftarkan alasan perubahan, dampak, dan batasan melalui PCBProExplain.registerChange().'
      ],
      en:[
        'Added a global Explanation Center describing what a feature is, why it exists, its inputs, process, output, how to interpret results, limitations, and next steps.',
        'Added Explain Mode: enable it and click any workspace element to inspect its context without triggering the element action.',
        'All interactive controls are scanned automatically. Known features receive dedicated documentation; new undocumented controls still receive an honest fallback and are flagged as needing dedicated documentation.',
        'Results/checks/status can be inspected together with their current text snapshot; outputs are not treated as equivalent to measurements or manufacturing sign-off.',
        'Added the end-to-end PCB Pro flow and result-confidence ladder from UI state through physical measurement.',
        'Added Coverage Audit to show dedicated-documentation coverage versus fallback coverage.',
        'Added a change-event ledger so future features can register change reasons, impact, and limitations through PCBProExplain.registerChange().'
      ]
    }
  };

  async function load(){
    try{const r=await fetch(REGISTRY_URL,{cache:'no-store'});if(r.ok)registry=await r.json()}catch(e){console.warn('[PCB Pro Explain] registry',e)}
    try{const r=await fetch(PATCH_URL,{cache:'no-store'});if(r.ok)patches=await r.json()}catch(e){console.warn('[PCB Pro Explain] patches',e)}
    if(!registry) registry={overview:{title:{id:'PCB Pro',en:'PCB Pro'},what:{id:'Dokumentasi belum termuat.',en:'Documentation has not loaded.'}},entries:[]};
  }

  function allEntries(){return [...(registry?.entries||[]),...runtimeEntries]}
  function labelOf(el){
    if(!el)return'';
    const bits=[el.dataset?.explainKey,el.dataset?.pcbView,el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.getAttribute?.('name'),el.getAttribute?.('placeholder')];
    if(!/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName||'')) bits.push(el.textContent);
    return norm(bits.filter(Boolean).join(' '));
  }
  function aliasMatch(text,alias){
    const a=norm(alias);if(!a)return false;if(text===a)return true;
    const safe=a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    try{return new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`,'i').test(text)}catch{return text.includes(a)}
  }
  function scoreEntry(entry,text,el){
    let score=0;
    if(el?.dataset?.explainKey===entry.id)score+=1000;
    for(const a of entry.match||[]){if(aliasMatch(text,a))score+=Math.max(3,String(a).length)}
    if(entry.category==='check-result'&&el?.matches?.(resultSelector))score+=5;
    return score;
  }
  function dedicatedFor(el){
    const text=labelOf(el);let best=null,bestScore=0;
    for(const entry of allEntries()){
      const s=scoreEntry(entry,text,el);if(s>bestScore){best=entry;bestScore=s}
    }
    return bestScore>0?best:null;
  }
  function genericFor(el){
    const label=(el?.getAttribute?.('aria-label')||el?.getAttribute?.('title')||el?.textContent||el?.value||el?.tagName||'').trim().replace(/\s+/g,' ').slice(0,160);
    const isResult=!!el?.closest?.(resultSelector)||!!el?.matches?.(resultSelector);
    if(isResult){
      const base=allEntries().find(x=>x.id==='result.generic');
      if(base)return {...base,_fallback:true,title:{id:`Hasil: ${label||'tanpa label'}`,en:`Result: ${label||'unlabelled'}`}};
    }
    return {
      id:'fallback.undocumented',category:'undocumented',status:'needs-dedicated-doc',_fallback:true,
      title:{id:label?`Elemen: ${label}`:'Elemen belum berlabel',en:label?`Element: ${label}`:'Unlabelled element'},
      what:{id:'Elemen ini terdeteksi di antarmuka, tetapi belum memiliki dokumentasi khusus di registry v1.13.0.',en:'This element exists in the interface but does not yet have dedicated documentation in the v1.13.0 registry.'},
      why:{id:'Fallback ini sengaja jujur: web tidak mengarang tujuan teknis yang belum didaftarkan oleh fitur pemiliknya.',en:'This fallback is intentionally honest: the app does not invent a technical purpose that has not been registered by the owning feature.'},
      input:{id:'Lihat label, parent panel, dan state project terkait.',en:'Inspect the label, parent panel, and related project state.'},
      process:{id:'Belum ada proses khusus yang terdokumentasi untuk elemen ini.',en:'No feature-specific process is documented for this element yet.'},
      output:{id:'Aksi/output bergantung implementasi asli elemen; fallback tidak menebak.',en:'Action/output depends on the actual implementation; the fallback does not guess.'},
      how_to_read:{id:'Gunakan Coverage Audit untuk menandai elemen ini sebagai pekerjaan dokumentasi.',en:'Use Coverage Audit to flag this element for documentation work.'},
      limits:{id:'Dokumentasi khusus wajib ditambahkan saat fitur ini dikembangkan/diubah.',en:'Dedicated documentation must be added when this feature is developed/changed.'},
      next:{id:'Tambahkan entry registry atau panggil PCBProExplain.register() dari engine fitur.',en:'Add a registry entry or call PCBProExplain.register() from the feature engine.'}
    };
  }
  function entryFor(el){return dedicatedFor(el)||genericFor(el)}

  function installStyles(){
    if(document.querySelector('#pcbpro-explain-style'))return;
    const s=document.createElement('style');s.id='pcbpro-explain-style';s.textContent=`
      #pcbpro-explain-trigger{border:1px solid #47606d;background:#10202a;color:#d5e4ea;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:900;white-space:nowrap}#pcbpro-explain-trigger:hover,#pcbpro-explain-trigger.active{border-color:#e2b65c;background:#332912;color:#fff0bf}
      body.pcbpro-explain-mode{cursor:help!important}body.pcbpro-explain-mode *{cursor:help!important}body.pcbpro-explain-mode [data-explain-dedicated="0"]{outline:1px dashed #b77858!important;outline-offset:1px}body.pcbpro-explain-mode [data-explain-dedicated="1"]{outline:1px dashed #4aa992!important;outline-offset:1px}
      #pcbpro-explain-drawer{position:fixed;z-index:2700;top:0;right:0;width:min(560px,96vw);height:100dvh;background:#071118;color:#dce9ee;border-left:1px solid #36505c;box-shadow:-30px 0 90px #000a;display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;font-family:inherit}
      .pex-head{display:flex;align-items:center;gap:9px;padding:11px 12px;border-bottom:1px solid #203641;background:#0a1821}.pex-brand{display:grid;gap:1px;min-width:0;flex:1}.pex-brand small{font:900 8px ui-monospace;color:#e0b65e;letter-spacing:.08em}.pex-brand b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pex-head button,.pex-tabs button,.pex-actions button{border:1px solid #2d4855;background:#10212a;color:#c4d4db;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:900}.pex-head button.active,.pex-tabs button.active,.pex-actions button.active{border-color:#e0b45b;background:#352a12;color:#fff1c1}.pex-close{font-size:17px!important;line-height:1!important}.pex-tabs{display:flex;gap:5px;padding:8px 10px;border-bottom:1px solid #203641;overflow:auto;background:#08141c}.pex-body{min-height:0;overflow:auto;padding:13px}.pex-card{border:1px solid #213b47;background:#0b1921;border-radius:10px;padding:11px;margin-bottom:9px}.pex-card h3{font-size:10px;margin:0 0 7px;color:#e3edf1}.pex-card p,.pex-card li{font-size:10px;line-height:1.58;color:#9fb2ba}.pex-card ul,.pex-card ol{padding-left:18px;margin:6px 0}.pex-key{display:inline-block;border:1px solid #38505b;border-radius:999px;padding:3px 7px;font:800 7px ui-monospace;color:#91aeb8;margin-right:5px}.pex-warn{border-color:#765c35;background:#2c2312}.pex-warn h3{color:#f0ca79}.pex-snapshot{white-space:pre-wrap;max-height:180px;overflow:auto;font:800 9px/1.55 ui-monospace;color:#c9dce4;background:#061017;border-radius:7px;padding:8px}.pex-actions{display:flex;gap:6px;flex-wrap:wrap}.pex-flow{counter-reset:x}.pex-flow li{margin-bottom:6px}.pex-release{border-left:3px solid #395663;padding-left:10px;margin:12px 0}.pex-release.current{border-left-color:#e0b45b}.pex-release b{font-size:11px}.pex-release small{margin-left:7px;color:#6f8994}.pex-release li{font-size:9px;line-height:1.5;color:#9eb1b9}.pex-meter{height:8px;border-radius:99px;background:#132832;overflow:hidden;margin:7px 0}.pex-meter i{display:block;height:100%;background:#56bda7}.pex-table{width:100%;border-collapse:collapse;font-size:9px}.pex-table th,.pex-table td{padding:6px;border-bottom:1px solid #1b333e;text-align:left;vertical-align:top}.pex-unknown{color:#e7b887}.pex-known{color:#6bd4bb}
      #pcbpro-explain-toast{position:fixed;z-index:2699;left:50%;bottom:18px;transform:translateX(-50%);background:#2e2513;color:#fff0c0;border:1px solid #d6aa52;border-radius:10px;padding:9px 12px;font-size:10px;font-weight:800;box-shadow:0 14px 50px #000b}
      @media(max-width:650px){#pcbpro-explain-drawer{width:100vw}.pex-body{padding:9px}}
    `;document.head.appendChild(s)
  }

  function mountTrigger(){
    installStyles();const actions=document.querySelector('.top-actions');if(!actions)return false;
    let b=document.querySelector('#pcbpro-explain-trigger');
    if(!b){b=document.createElement('button');b.id='pcbpro-explain-trigger';b.type='button';b.textContent=t('ⓘ Penjelasan','ⓘ Explain');b.title=t('Jelaskan fitur, hasil, alur, dan perubahan','Explain features, results, flow, and changes');b.addEventListener('click',()=>openDrawer(null,'overview'));const ui=document.querySelector('#pcbpro-ui-trigger');if(ui)actions.insertBefore(b,ui);else actions.appendChild(b)}
    return true;
  }

  function section(title,value){const v=loc(value);return v?`<section class="pex-card"><h3>${esc(title)}</h3><p>${esc(v)}</p></section>`:''}
  function snapshotText(target){
    if(!target)return'';const box=target.closest?.(resultSelector)||target;return String(box?.innerText||'').trim().replace(/\n{3,}/g,'\n\n').slice(0,2400)
  }
  function contextHtml(){
    const x=currentEntry||registry?.overview||{};const fallback=!!x._fallback;const snap=snapshotText(currentTarget);
    return `${fallback?`<section class="pex-card pex-warn"><h3>${t('Dokumentasi khusus belum ada','Dedicated documentation missing')}</h3><p>${t('Elemen ini tetap bisa dijelaskan secara struktural, tetapi engine tidak akan mengarang fungsi teknis yang belum didaftarkan.','This element can still be explained structurally, but the engine will not invent undocumented technical behavior.')}</p></section>`:''}
      <section class="pex-card"><span class="pex-key">${esc(x.category||'overview')}</span><span class="pex-key">${esc(x.status||'documented')}</span><h3 style="margin-top:8px">${esc(loc(x.title)||t('Gambaran PCB Pro','PCB Pro Overview'))}</h3></section>
      ${section(t('Apa ini?','What is it?'),x.what)}${section(t('Untuk apa / kenapa ada?','Why does it exist?'),x.why)}${section(t('Input / data masuk','Input / source data'),x.input)}${section(t('Yang terjadi di dalam','What happens internally'),x.process)}${section(t('Output / hasil','Output / result'),x.output)}${section(t('Cara membaca hasil','How to interpret it'),x.how_to_read)}${section(t('Batasan / jangan disimpulkan','Limits / do not infer'),x.limits)}${section(t('Langkah berikutnya','Next step'),x.next)}
      ${snap?`<section class="pex-card"><h3>${t('Snapshot yang sedang terlihat','Current visible snapshot')}</h3><div class="pex-snapshot">${esc(snap)}</div><p>${t('Snapshot ini hanya menyalin state UI saat ini; interpretasinya mengikuti penjelasan feature/model di atas.','This snapshot only captures the current UI state; interpret it using the feature/model explanation above.')}</p></section>`:''}`
  }
  function overviewHtml(){
    const o=registry?.overview||{};const levels=o.result_levels||[];
    return `${section(t('Awal mula / identitas sistem','Starting point / system identity'),o.what)}${section(t('Tujuan utama','Primary purpose'),o.why)}<section class="pex-card"><h3>${t('Alur dari awal sampai hasil','Flow from start to result')}</h3><ol class="pex-flow">${(o.flow||[]).map(v=>`<li>${esc(v)}</li>`).join('')}</ol></section><section class="pex-card"><h3>${t('Tingkat kepastian sebuah hasil','Result confidence ladder')}</h3><table class="pex-table">${levels.map(v=>`<tr><th>${esc(v.id)}</th><td>${esc(v.meaning)}</td></tr>`).join('')}</table><p>${t('Semakin ke bawah bukan berarti feature sebelumnya salah; levelnya hanya menjawab pertanyaan yang berbeda.','Moving downward does not make earlier features wrong; each level answers a different question.')}</p></section>`
  }
  function localChanges(){try{return JSON.parse(localStorage.getItem(CHANGE_KEY)||'[]')}catch{return[]}}
  function changesHtml(){
    const list=[currentRelease,...patches.filter(p=>p?.version!==currentRelease.version)].slice(0,25);const runtime=localChanges();
    return `<section class="pex-card"><h3>${t('Aturan perubahan ke depan','Rule for future changes')}</h3><p>${t('Setiap feature baru/perubahan seharusnya mendaftarkan: apa yang berubah, kenapa berubah, bagian yang terdampak, hasil baru, batasan, dan migration/next action bila ada.','Every new/changed feature should register what changed, why, impacted areas, new result behavior, limitations, and migration/next action when applicable.')}</p></section>${list.map((p,i)=>{const r=p.changes?.[lang()]||p.changes?.id||[];return `<article class="pex-release ${i===0?'current':''}"><b>v${esc(p.version||'?')} · ${esc(loc(p.title)||'Update')}</b><small>${esc(p.date||'')}</small><ul>${r.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></article>`}).join('')}${runtime.length?`<section class="pex-card"><h3>${t('Runtime change ledger','Runtime change ledger')}</h3>${runtime.slice(-20).reverse().map(c=>`<div class="pex-release"><b>${esc(c.title||c.feature||'Change')}</b><small>${esc(c.time||'')}</small><p>${esc(c.why||c.detail||'')}</p></div>`).join('')}</section>`:''}`
  }
  function audit(){
    const els=[...document.querySelectorAll(interactiveSelector)].filter(el=>!el.closest('#pcbpro-explain-drawer')&&!el.closest('#pcbpro-explain-toast'));
    let dedicated=0;const missing=[];
    for(const el of els){const e=dedicatedFor(el);if(e)dedicated++;else missing.push({label:(el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent||el.tagName).trim().replace(/\s+/g,' ').slice(0,90),tag:el.tagName})}
    return {total:els.length,dedicated,fallback:missing.length,coverage:els.length?Math.round(dedicated/els.length*100):100,missing};
  }
  function auditHtml(){
    const a=audit();return `<section class="pex-card"><h3>${t('Coverage dokumentasi khusus','Dedicated documentation coverage')}</h3><b style="font-size:26px">${a.coverage}%</b><div class="pex-meter"><i style="width:${a.coverage}%"></i></div><p>${a.dedicated} ${t('kontrol punya penjelasan khusus','controls have dedicated explanations')} · ${a.fallback} ${t('masih memakai fallback','still use fallback')} · ${a.total} total.</p></section><section class="pex-card"><h3>${t('Kontrol yang perlu dokumentasi khusus','Controls needing dedicated documentation')}</h3>${a.missing.length?`<table class="pex-table">${a.missing.slice(0,80).map(v=>`<tr><td class="pex-unknown">${esc(v.label||'(unlabelled)')}</td><td>${esc(v.tag)}</td></tr>`).join('')}</table>`:`<p class="pex-known">${t('Semua kontrol terdeteksi sudah punya mapping khusus.','All detected controls have dedicated mappings.')}</p>`}<p>${t('Fallback tetap tersedia, jadi elemen baru tidak menjadi tanpa penjelasan; tetapi daftar ini adalah utang dokumentasi yang harus dibereskan pada patch berikutnya.','Fallback remains available so new elements never become explanation-less; this list is documentation debt to resolve in the next patch.')}</p></section>`
  }

  function drawerTitle(){
    if(drawerTab==='context')return loc(currentEntry?.title)||t('Penjelasan konteks','Context explanation');
    if(drawerTab==='overview')return loc(registry?.overview?.title)||'PCB Pro';
    if(drawerTab==='changes')return t('Perubahan & alasan','Changes & rationale');
    return t('Audit cakupan','Coverage audit')
  }
  function renderDrawer(){
    const d=document.querySelector('#pcbpro-explain-drawer');if(!d)return;
    d.querySelector('.pex-brand b').textContent=drawerTitle();d.querySelector('#pcbpro-explain-trigger-inline').classList.toggle('active',explainMode);
    d.querySelectorAll('[data-pex-tab]').forEach(b=>b.classList.toggle('active',b.dataset.pexTab===drawerTab));
    const body=d.querySelector('.pex-body');
    if(drawerTab==='context')body.innerHTML=contextHtml();
    else if(drawerTab==='overview')body.innerHTML=overviewHtml();
    else if(drawerTab==='changes')body.innerHTML=changesHtml();
    else body.innerHTML=auditHtml();
  }
  function openDrawer(target=null,tab='context'){
    installStyles();currentTarget=target||currentTarget;currentEntry=target?entryFor(target):(currentEntry||null);drawerTab=tab;
    let d=document.querySelector('#pcbpro-explain-drawer');
    if(!d){d=document.createElement('aside');d.id='pcbpro-explain-drawer';d.innerHTML=`<header class="pex-head"><div class="pex-brand"><small>PCB PRO · EXPLAIN EVERYTHING v${VERSION}</small><b></b></div><button id="pcbpro-explain-trigger-inline">${t('⌁ Mode Jelaskan','⌁ Explain Mode')}</button><button class="pex-close">×</button></header><nav class="pex-tabs"><button data-pex-tab="context">${t('Konteks','Context')}</button><button data-pex-tab="overview">${t('Awal → Hasil','Start → Result')}</button><button data-pex-tab="changes">${t('Perubahan','Changes')}</button><button data-pex-tab="audit">${t('Cakupan','Coverage')}</button></nav><main class="pex-body"></main>`;document.body.appendChild(d);
      d.querySelector('.pex-close').addEventListener('click',closeDrawer);d.querySelector('#pcbpro-explain-trigger-inline').addEventListener('click',()=>setExplainMode(!explainMode));d.querySelectorAll('[data-pex-tab]').forEach(b=>b.addEventListener('click',()=>{drawerTab=b.dataset.pexTab;renderDrawer()}))
    }
    document.querySelector('#pcbpro-explain-trigger')?.classList.add('active');renderDrawer();
  }
  function closeDrawer(){document.querySelector('#pcbpro-explain-drawer')?.remove();document.querySelector('#pcbpro-explain-trigger')?.classList.remove('active')}
  function toast(msg){document.querySelector('#pcbpro-explain-toast')?.remove();const x=document.createElement('div');x.id='pcbpro-explain-toast';x.textContent=msg;document.body.appendChild(x);setTimeout(()=>x.remove(),2200)}
  function setExplainMode(on){explainMode=!!on;document.body.classList.toggle('pcbpro-explain-mode',explainMode);document.querySelector('#pcbpro-explain-trigger-inline')?.classList.toggle('active',explainMode);if(explainMode)toast(t('Mode Jelaskan aktif — klik fitur atau hasil apa pun.','Explain Mode active — click any feature or result.'))}

  function scan(){
    clearTimeout(scanTimer);scanTimer=setTimeout(()=>{
      const els=[...document.querySelectorAll(interactiveSelector)];
      for(const el of els){if(el.closest('#pcbpro-explain-drawer'))continue;const e=dedicatedFor(el);el.dataset.explainDedicated=e?'1':'0';if(e&&!el.title)el.title=`ⓘ ${loc(e.title)} — ${loc(e.what).slice(0,160)}`;if(!el.dataset.explainKey&&e)el.dataset.explainKey=e.id}
      const results=[...document.querySelectorAll(resultSelector)];for(const el of results){if(el.closest('#pcbpro-explain-drawer'))continue;if(!el.dataset.explainDedicated)el.dataset.explainDedicated=dedicatedFor(el)?'1':'0'}
    },90)
  }
  function onCaptureClick(e){
    if(!explainMode)return;if(e.target?.closest?.('#pcbpro-explain-drawer,#pcbpro-explain-trigger'))return;
    const target=e.target?.closest?.(`${interactiveSelector},${resultSelector},.panel,.card,.node,.net,.component-intel,.reality-lab`)||e.target;
    if(!target)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();currentTarget=target;currentEntry=entryFor(target);openDrawer(target,'context')
  }
  function onKey(e){
    if(/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();openDrawer(null,'overview')}
    if(e.key==='Escape'&&document.querySelector('#pcbpro-explain-drawer')&&explainMode){setExplainMode(false)}
  }
  function register(entry){if(!entry?.id)return false;const i=runtimeEntries.findIndex(x=>x.id===entry.id);if(i>=0)runtimeEntries[i]=entry;else runtimeEntries.push(entry);scan();return true}
  function registerChange(change){
    const item={...change,time:new Date().toISOString()};const list=localChanges();list.push(item);try{localStorage.setItem(CHANGE_KEY,JSON.stringify(list.slice(-100)))}catch{};window.dispatchEvent(new CustomEvent('pcbpro:explain-change',{detail:item}));return item
  }
  function snapshot(){return {version:VERSION,mode:explainMode,registryVersion:registry?.version||null,audit:audit(),current:currentEntry?.id||null,changeCount:localChanges().length}}
  function refresh(){mountTrigger();scan();if(document.querySelector('#pcbpro-explain-drawer'))renderDrawer()}

  async function start(){
    await load();mountTrigger();scan();document.addEventListener('click',onCaptureClick,true);document.addEventListener('keydown',onKey,true);window.addEventListener('pcbpro:language',refresh);
    observer=new MutationObserver(ms=>{if(ms.some(m=>![...m.addedNodes].some(n=>n?.nodeType===1&&n.closest?.('#pcbpro-explain-drawer,#pcbpro-explain-toast'))))scan()});observer.observe(document.body,{childList:true,subtree:true});
    window.dispatchEvent(new CustomEvent('pcbpro:explain-ready',{detail:{version:VERSION}}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

  window.PCBProExplain={version:VERSION,open:openDrawer,close:closeDrawer,mode:setExplainMode,explain:(target)=>{const el=typeof target==='string'?document.querySelector(target):target;if(el){currentTarget=el;currentEntry=entryFor(el);openDrawer(el,'context')}},entryFor,register,registerChange,audit,snapshot,refresh,get registry(){return registry},get release(){return currentRelease}};
})();
