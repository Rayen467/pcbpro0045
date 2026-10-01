(() => {
  'use strict';

  const VERSION = '1.2.0';
  const KEY_LANG = 'pcbpro0045-lang';
  const KEY_SCALE = 'pcbpro0045-ui-scale';
  let lang = localStorage.getItem(KEY_LANG) || 'id';
  let scale = Number(localStorage.getItem(KEY_SCALE) || '1.18');
  if (!Number.isFinite(scale)) scale = 1.18;
  scale = Math.max(1, Math.min(1.45, scale));
  let dock = null;
  let modal = null;
  let translating = false;
  let patches = [];

  const translations = {
    id: {
      'File':'Berkas','Edit':'Edit','View':'Tampilan','Place':'Tempatkan','Route':'Jalur','Inspect':'Periksa','Tools':'Alat','Manufacture':'Produksi',
      'Schematic':'Skematik','Simulator':'Simulator','Fabrication':'Fabrikasi','Rules':'Aturan','Release':'Rilis',
      'Select':'Pilih','Wire':'Kabel','Bus':'Bus','Net label':'Label net','Junction':'Sambungan','No connect':'Tidak terhubung','Power':'Daya','Pan':'Geser','Measure':'Ukur','Annotate':'Anotasi',
      'Library':'Pustaka','Project':'Proyek','History':'Riwayat','Parts':'Komponen','Save':'Simpan','Export':'Ekspor','New':'Baru','Simulate':'Simulasikan',
      'Properties':'Properti','Reference':'Referensi','Value':'Nilai','Footprint':'Footprint','Rotate':'Putar','Delete':'Hapus','Workspace':'Workspace',
      'Design checks':'Pemeriksaan desain','Net inspector':'Pemeriksa net','Search component':'Cari komponen',
      'Run preflight':'Jalankan preflight','Run DRC':'Jalankan DRC','Export CSV':'Ekspor CSV'
    },
    en: {}
  };
  translations.en = Object.fromEntries(Object.entries(translations.id).map(([en,id]) => [id,en]));

  function applyScale() {
    document.documentElement.style.setProperty('--pcbpro-ui-scale', String(scale));
    localStorage.setItem(KEY_SCALE, String(scale));
    const label = dock?.querySelector('.ux-scale-label');
    if (label) label.textContent = `${Math.round(scale * 100)}%`;
  }

  function translateTextNode(node, to) {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    const trimmed = raw.trim();
    const map = translations[to];
    const replacement = map[trimmed];
    if (!replacement) return;
    node.nodeValue = raw.replace(trimmed, replacement);
  }

  function translateTree(root = document.body) {
    if (translating || !root) return;
    translating = true;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) translateTextNode(node, lang);
      document.documentElement.lang = lang === 'id' ? 'id' : 'en';
      for (const input of document.querySelectorAll('input[placeholder],textarea[placeholder]')) {
        const p = input.getAttribute('placeholder') || '';
        if (lang === 'id') {
          input.setAttribute('placeholder', p
            .replace('Search component','Cari komponen')
            .replace('Search symbol, value, group','Cari simbol, nilai, grup')
            .replace('Example:','Contoh:'));
        }
      }
    } finally { translating = false; }
  }

  function setLang(next) {
    if (!['id','en'].includes(next) || next === lang) return;
    const old = lang;
    lang = next;
    localStorage.setItem(KEY_LANG, lang);
    // Translate back using the reverse map first, then into target.
    if (old === 'id' && next === 'en') translateTree(document.body);
    else translateTree(document.body);
    updateDock();
    window.dispatchEvent(new CustomEvent('pcbpro:language',{detail:{lang}}));
  }

  async function loadPatches() {
    try {
      const res = await fetch('/patches.json',{cache:'no-store'});
      patches = res.ok ? await res.json() : [];
    } catch (_) { patches = []; }
  }

  function patchModalHtml() {
    const rows = patches.map((p) => {
      const title = p.title?.[lang] || p.title?.en || p.version;
      const changes = p.changes?.[lang] || p.changes?.en || [];
      return `<article><div class="ux-patch-head"><b>v${p.version}</b><span>${p.date || ''}</span></div><h3>${title}</h3><ul>${changes.map((c)=>`<li>${c}</li>`).join('')}</ul></article>`;
    }).join('');
    return `<div class="ux-modal-card"><div class="ux-modal-title"><div><small>PCB PRO 0045</small><h2>${lang==='id'?'Patch Perkembangan':'Patch Updates'}</h2></div><button class="ux-modal-close">×</button></div><div class="ux-modal-body">${rows || `<p>${lang==='id'?'Belum ada patch log.':'No patch log yet.'}</p>`}</div></div>`;
  }

  function openPatches() {
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pcbpro-patch-modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML = patchModalHtml();
    modal.classList.add('open');
    modal.querySelector('.ux-modal-close')?.addEventListener('click',()=>modal.classList.remove('open'));
    modal.addEventListener('pointerdown',(e)=>{if(e.target===modal)modal.classList.remove('open')},{once:true});
  }

  function updateDock() {
    if (!dock) return;
    dock.querySelector('.ux-lang-id')?.classList.toggle('active',lang==='id');
    dock.querySelector('.ux-lang-en')?.classList.toggle('active',lang==='en');
    const patch = dock.querySelector('.ux-patches');
    if (patch) patch.textContent = lang==='id' ? 'Update' : 'Updates';
    const comfort = dock.querySelector('.ux-comfort');
    if (comfort) comfort.textContent = lang==='id' ? 'Nyaman' : 'Comfort';
  }

  function installStyles() {
    if (document.getElementById('pcbpro-ux-style')) return;
    const s = document.createElement('style');
    s.id = 'pcbpro-ux-style';
    s.textContent = `
      :root{--pcbpro-ui-scale:1.18;--ux-bg:#0b1219;--ux-surface:#111b25;--ux-border:#2a3d4b;--ux-text:#e9f0f4;--ux-muted:#91a3af;--ux-accent:#43cbb2}
      body{background:#0a1118!important;color:var(--ux-text)!important}
      .topbar{height:64px!important;flex-basis:64px!important;padding:0 14px!important;background:#0c141c!important}
      .menubar{height:36px!important;flex-basis:36px!important;background:#0b1219!important}
      .tabs{height:50px!important;flex-basis:50px!important;background:#0d151d!important}
      .toolbar-scroll{height:58px!important;flex-basis:58px!important}.toolbar{height:57px!important}
      .brand strong{font-size:calc(15px * var(--pcbpro-ui-scale))!important}.brand span,.version,.save-state,.workspace-state,.menus button,.tabs button,.tools small,.tool-right button,.side-tabs button,.side-title span,.ins-title span,.panel-title span,.hint,.part-copy b,.part-copy small,.tree button,.history p,.node b,.node small,.node .ref,.footprint,.layer-strip button,.stage-info,.stage-help span,.statusbar,.console,.inspector label span,.inspector input,.prop-actions button,.workspace-controls button,.check,.net,.panel-title p,.rules span,.rules input,.table-wrap th,.table-wrap td,.cards p,.release p{font-size:calc(9px * var(--pcbpro-ui-scale))!important;line-height:1.45!important}
      .menus button,.tabs button,.tools small,.tool-right button,.part-copy b,.check,.net,.prop-actions button,.workspace-controls button{font-size:calc(10px * var(--pcbpro-ui-scale))!important}
      .side-title h2{font-size:calc(17px * var(--pcbpro-ui-scale))!important}.panel-title h2{font-size:calc(20px * var(--pcbpro-ui-scale))!important}
      .search input,.inspector input,.rules input{font-size:calc(11px * var(--pcbpro-ui-scale))!important;padding:9px!important}
      .part{min-height:52px!important;padding:8px!important}.part-symbol{width:34px!important;height:34px!important;font-size:calc(10px * var(--pcbpro-ui-scale))!important}
      .leftbar,.inspector{background:#0d161f!important}.panel{background:linear-gradient(155deg,#101923,#0b1219)!important}
      .node{min-width:108px!important;padding:10px 12px!important;background:#0e1b25!important}.node .symbol{font-size:calc(13px * var(--pcbpro-ui-scale))!important;height:24px!important}
      .statusbar{height:34px!important;flex-basis:34px!important}.console{height:32px!important;flex-basis:32px!important}
      #pcbpro-jarvis .jarvis-panel{width:min(560px,calc(100vw - 28px))!important;min-width:420px!important;background:#0d171ff8!important}
      #pcbpro-jarvis .jarvis-head{height:58px!important;flex-basis:58px!important}#pcbpro-jarvis .jarvis-id b{font-size:14px!important}#pcbpro-jarvis .jarvis-id small{font-size:9px!important}
      #pcbpro-jarvis .jarvis-bubble p{font-size:12px!important;line-height:1.65!important}#pcbpro-jarvis .jarvis-compose textarea{font-size:12px!important;min-height:48px!important}#pcbpro-jarvis .jarvis-compose button{font-size:11px!important;width:74px!important}#pcbpro-jarvis .jarvis-actions button,#pcbpro-jarvis .jarvis-chips button{font-size:10px!important;padding:7px 9px!important}
      .reality-head h2{font-size:24px!important}.reality-head p,.reality-note,.reality-status,.reality-config span,.reality-config input,.reality-config select,.reality-metrics span,.reality-metrics small,.reality-section-title,.reality-grid2 table,.reality-coverage b,.reality-coverage span{font-size:calc(9px * var(--pcbpro-ui-scale))!important;line-height:1.5!important}.reality-metrics strong{font-size:calc(16px * var(--pcbpro-ui-scale))!important}
      #pcbpro-ux-dock{position:fixed;z-index:880;right:14px;top:108px;display:flex;align-items:center;gap:5px;border:1px solid #304552;background:#0e1821ee;border-radius:10px;padding:6px;box-shadow:0 12px 36px #0008;backdrop-filter:blur(10px)}
      #pcbpro-ux-dock button,#pcbpro-ux-dock span{border:1px solid #2b414e;background:#111e28;color:#b9c8d1;border-radius:7px;padding:7px 9px;font-size:11px;font-weight:750}#pcbpro-ux-dock button.active{background:#174239;border-color:#3bc4aa;color:#7de5d0}#pcbpro-ux-dock .ux-patches{background:#1a3029;color:#7adbc6}.ux-scale-label{min-width:52px;text-align:center}
      #pcbpro-patch-modal{position:fixed;z-index:1200;inset:0;background:#000a;display:none;place-items:center;padding:18px}#pcbpro-patch-modal.open{display:grid}.ux-modal-card{width:min(760px,96vw);max-height:88vh;overflow:hidden;border:1px solid #344b59;border-radius:14px;background:#0d171f;box-shadow:0 30px 90px #000d}.ux-modal-title{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #243946}.ux-modal-title small{color:#5fd2bb;font:800 10px ui-monospace}.ux-modal-title h2{margin:3px 0 0;font-size:24px}.ux-modal-close{width:36px;height:36px;border:1px solid #34505e;background:#13232e;color:#dce8ee;border-radius:8px;font-size:20px}.ux-modal-body{padding:14px;overflow:auto;max-height:72vh}.ux-modal-body article{border:1px solid #243946;background:#101d27;border-radius:10px;padding:13px;margin-bottom:10px}.ux-patch-head{display:flex;justify-content:space-between;color:#79dbc6;font:800 10px ui-monospace}.ux-modal-body h3{margin:6px 0 8px;font-size:16px}.ux-modal-body ul{margin:0;padding-left:18px;color:#b7c6cf;font-size:12px;line-height:1.6}
      @media(max-width:760px){#pcbpro-ux-dock{top:auto;right:8px;bottom:8px;z-index:890}.topbar{height:58px!important;flex-basis:58px!important}#pcbpro-jarvis .jarvis-panel{min-width:0!important;width:calc(100vw - 12px)!important}.ux-comfort{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function mountDock() {
    if (dock) return;
    dock = document.createElement('div');
    dock.id = 'pcbpro-ux-dock';
    dock.innerHTML = `<button class="ux-lang-id">ID</button><button class="ux-lang-en">EN</button><button class="ux-minus">A−</button><span class="ux-scale-label"></span><button class="ux-plus">A+</button><button class="ux-comfort">Comfort</button><button class="ux-patches">Updates</button>`;
    document.body.appendChild(dock);
    dock.querySelector('.ux-lang-id').addEventListener('click',()=>setLang('id'));
    dock.querySelector('.ux-lang-en').addEventListener('click',()=>setLang('en'));
    dock.querySelector('.ux-minus').addEventListener('click',()=>{scale=Math.max(1,+(scale-.08).toFixed(2));applyScale()});
    dock.querySelector('.ux-plus').addEventListener('click',()=>{scale=Math.min(1.45,+(scale+.08).toFixed(2));applyScale()});
    dock.querySelector('.ux-comfort').addEventListener('click',()=>{scale=1.22;applyScale()});
    dock.querySelector('.ux-patches').addEventListener('click',openPatches);
    updateDock(); applyScale();
  }

  function start() {
    installStyles();
    mountDock();
    loadPatches();
    translateTree(document.body);
    const observer = new MutationObserver((records)=>{
      if (translating) return;
      clearTimeout(observer.timer);
      observer.timer = setTimeout(()=>translateTree(document.body),90);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();

  window.PCBProUX = { version:VERSION, get lang(){return lang}, setLang, get scale(){return scale}, openPatches, translate:translateTree };
})();