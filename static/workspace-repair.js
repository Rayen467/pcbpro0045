(() => {
  'use strict';

  if (window.PCBProWorkspaceRepair) return;
  const VERSION = '1.1.0';
  const UI_KEY = 'pcbpro0045-layout-mode';
  let layoutMode = localStorage.getItem(UI_KEY) || 'flex';
  let repairTimer = 0;

  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const text = (id, en) => lang() === 'id' ? id : en;

  function notify(message, tone = 'info') {
    let toast = document.querySelector('#pcbpro-repair-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pcbpro-repair-toast';
      document.body.appendChild(toast);
    }
    toast.dataset.tone = tone;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function installStyles() {
    if (document.querySelector('#pcbpro-workspace-repair-style')) return;
    const s = document.createElement('style');
    s.id = 'pcbpro-workspace-repair-style';
    s.textContent = `
      html,body{overflow:hidden!important}.app,.shell,.workbench,.content{min-height:0!important}.shell{overflow:hidden!important}
      .leftbar,.inspector{min-height:0!important;overscroll-behavior:contain;scrollbar-gutter:stable;padding-bottom:56px!important}
      .workbench{position:relative!important;min-width:0!important;overflow:hidden!important}
      .content{padding:10px!important;background:#071018!important;overflow:hidden!important}
      .content>.stage,.content>.panel{border:1px solid #263a48!important;border-radius:12px!important;box-shadow:0 12px 34px #0005,inset 0 0 0 1px #0e1e28!important;overflow:hidden!important}
      .content>.panel{overflow:auto!important}.stage{background-color:#0a151e!important}
      .toolbar-scroll{overflow-x:auto!important;overflow-y:hidden!important;scrollbar-gutter:stable}.toolbar{padding:0 10px!important}.tools,.tool-right{flex-wrap:nowrap!important}
      .tools button,.tool-right button,.tabs button,.menus button,.top-actions button{pointer-events:auto!important;position:relative!important;z-index:1}
      .pcb-tool-unavailable{opacity:.48!important;cursor:not-allowed!important}.pcb-tool-unavailable::after{content:'•';position:absolute;right:2px;top:1px;color:#d5a956;font-size:8px}.pcb-tool-unavailable:hover{opacity:.72!important}
      .pcb-fake-hidden{display:none!important}
      .floating-card[data-truth-guard='1'] strong{font-size:14px!important;color:#d0b76b!important}.floating-card[data-truth-guard='1'] button{display:none!important}
      #pcbpro-ui-trigger,#pcbpro-layout-trigger{border:1px solid #2d4654;background:#101d27;color:#c5d4dc;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:800;white-space:nowrap}
      #pcbpro-ui-trigger.active,#pcbpro-layout-trigger.active{border-color:#3cc4aa;background:#153a32;color:#79e0ca}
      #pcbpro-ux-dock{display:none!important;position:fixed!important;z-index:1180!important;right:18px!important;top:86px!important;bottom:auto!important;left:auto!important;box-shadow:0 20px 70px #000c!important}
      #pcbpro-ux-dock.pcbpro-open{display:flex!important}
      #pcbpro-jarvis{position:static!important;right:auto!important;bottom:auto!important;z-index:auto!important}
      #pcbpro-jarvis .jarvis-launch{width:auto!important;height:34px!important;padding:0 12px!important;border-radius:8px!important;box-shadow:none!important}
      #pcbpro-jarvis .jarvis-panel{position:fixed!important;z-index:1170!important;right:18px!important;top:86px!important;bottom:18px!important;height:auto!important;max-height:none!important;width:min(560px,calc(100vw - 36px))!important;min-width:400px!important}
      #pcbpro-repair-toast{position:fixed;z-index:2000;left:50%;bottom:18px;transform:translate(-50%,18px);opacity:0;pointer-events:none;max-width:min(620px,92vw);border:1px solid #31505e;background:#0d1b24;color:#d9e7ee;border-radius:9px;padding:10px 13px;font-size:11px;line-height:1.45;box-shadow:0 18px 60px #000b;transition:.16s}
      #pcbpro-repair-toast.show{opacity:1;transform:translate(-50%,0)}#pcbpro-repair-toast[data-tone='warn']{border-color:#725d2b;color:#e6ca7e;background:#241d10}#pcbpro-repair-toast[data-tone='bad']{border-color:#74463d;color:#efa28e;background:#281714}
      #pcbpro-command-menu{position:fixed;z-index:1500;min-width:190px;border:1px solid #304856;background:#0c1720;border-radius:9px;padding:6px;box-shadow:0 20px 60px #000c}
      #pcbpro-command-menu button{display:block;width:100%;border:0;background:transparent;color:#bed0d9;text-align:left;border-radius:6px;padding:9px 10px;font-size:10px}#pcbpro-command-menu button:hover{background:#142832;color:#fff}
      body.pcb-layout-focus .shell{grid-template-columns:0 0 minmax(0,1fr) 0 0!important}body.pcb-layout-focus .leftbar,body.pcb-layout-focus .inspector,body.pcb-layout-focus .splitter{display:none!important}
      body.pcb-layout-inspect .shell{grid-template-columns:0 0 minmax(0,1fr) 5px min(380px,32vw)!important}body.pcb-layout-inspect .leftbar,body.pcb-layout-inspect .splitter:not(.right){display:none!important}
      @media(max-width:900px){.content{padding:6px!important}.content>.stage,.content>.panel{border-radius:8px!important}#pcbpro-jarvis .jarvis-panel{right:6px!important;left:6px!important;width:auto!important;min-width:0!important;top:74px!important;bottom:6px!important}#pcbpro-ux-dock{right:6px!important;top:74px!important;max-width:calc(100vw - 12px);overflow:auto}#pcbpro-layout-trigger{display:none!important}}
    `;
    document.head.appendChild(s);
  }

  function currentView() {
    const b = document.querySelector('.tabs button.active');
    return b?.dataset.pcbView || String(b?.textContent || '').trim().toLowerCase();
  }

  function applyLayout(mode = layoutMode) {
    layoutMode = ['flex','focus','inspect'].includes(mode) ? mode : 'flex';
    localStorage.setItem(UI_KEY, layoutMode);
    document.body.classList.toggle('pcb-layout-focus', layoutMode === 'focus');
    document.body.classList.toggle('pcb-layout-inspect', layoutMode === 'inspect');
    const b = document.querySelector('#pcbpro-layout-trigger');
    if (b) {
      const labels = lang() === 'id' ? {flex:'Layout Fleksibel',focus:'Fokus Canvas',inspect:'Fokus Inspector'} : {flex:'Flexible Layout',focus:'Canvas Focus',inspect:'Inspector Focus'};
      b.textContent = labels[layoutMode];
      b.classList.toggle('active', layoutMode !== 'flex');
    }
  }

  function cycleLayout() {
    const order = ['flex','focus','inspect'];
    applyLayout(order[(order.indexOf(layoutMode)+1)%order.length]);
  }

  function mountTopControls() {
    const actions = document.querySelector('.top-actions');
    if (!actions) return;

    let layout = document.querySelector('#pcbpro-layout-trigger');
    if (!layout) {
      layout = document.createElement('button');
      layout.id = 'pcbpro-layout-trigger';
      layout.addEventListener('click', cycleLayout);
      actions.appendChild(layout);
    }

    let ui = document.querySelector('#pcbpro-ui-trigger');
    if (!ui) {
      ui = document.createElement('button');
      ui.id = 'pcbpro-ui-trigger';
      ui.textContent = 'UI';
      ui.title = text('Bahasa, ukuran teks, patch update','Language, text size, patch updates');
      ui.addEventListener('click', (e) => {
        e.stopPropagation();
        const dock = document.querySelector('#pcbpro-ux-dock');
        dock?.classList.toggle('pcbpro-open');
        ui.classList.toggle('active', dock?.classList.contains('pcbpro-open'));
      });
      actions.appendChild(ui);
    }

    const ai = document.querySelector('#pcbpro-jarvis');
    if (ai && ai.parentElement !== actions) actions.appendChild(ai);
    applyLayout(layoutMode);
  }

  function closePopovers(event) {
    const dock = document.querySelector('#pcbpro-ux-dock');
    const ui = document.querySelector('#pcbpro-ui-trigger');
    if (dock?.classList.contains('pcbpro-open') && !dock.contains(event.target) && event.target !== ui) {
      dock.classList.remove('pcbpro-open');
      ui?.classList.remove('active');
    }
    const menu = document.querySelector('#pcbpro-command-menu');
    if (menu && !menu.contains(event.target) && !event.target.closest?.('.menus button')) menu.remove();
  }

  function activeToolAvailability() {
    const view = currentView();
    const liveByView = {
      schematic:new Set(['select','place','wire','pan']),
      pcb:new Set(['select','place','route','via','zone','keepout','pan']),
      simulator:new Set(['run','stop','probe','cursor a','cursor b','trace','measure']),
      '3d':new Set([]), bom:new Set(['refresh','group','mpn','supplier','cost','export csv']), fabrication:new Set(['preflight']), rules:new Set([]), release:new Set([])
    };
    document.querySelectorAll('.tools button').forEach((b) => {
      const tool = b.dataset.pcbTool || String(b.querySelector('small')?.textContent || '').trim().toLowerCase();
      const live = liveByView[view]?.has(tool) ?? true;
      b.classList.toggle('pcb-tool-unavailable', !live);
      if (!live) b.title = text('Belum aktif: engine inti belum tersedia. Tombol tidak akan pura-pura bekerja.','Not active: core engine is not available. This control will not pretend to work.');
      else if (/belum aktif|not active/i.test(b.title || '')) b.removeAttribute('title');
    });
  }

  function updateTruthGuards() {
    const ercFindings = window.PCBProWorkflow?.runErc?.() || [];
    const baseDrc = window.PCBProBoardModel?.drc?.() || [];
    const advDrc = window.PCBProAdvancedBoard?.drc?.() || [];
    const drcFindings = [...(Array.isArray(baseDrc)?baseDrc:[]), ...(Array.isArray(advDrc)?advDrc:[])];

    const section = [...document.querySelectorAll('.inspector section')].find((s) => /DESIGN CHECKS|PEMERIKSAAN DESAIN/i.test(s.querySelector('.ins-title span')?.textContent || ''));
    if (section) {
      const checks = [...section.querySelectorAll('.check')];
      const erc = checks.find((b) => /ERC/i.test(b.textContent || ''));
      const drc = checks.find((b) => /DRC/i.test(b.textContent || ''));
      const badge = section.querySelector('.ins-title b');
      if (erc) {
        const small = erc.querySelector('small');
        if (small) small.textContent = ercFindings.length ? `${ercFindings.length} ${text('temuan','findings')}` : text('lulus check tersedia','available checks pass');
        erc.dataset.state = ercFindings.length ? 'warn' : 'ok';
      }
      if (drc) {
        const small = drc.querySelector('small');
        const ready = typeof window.PCBProBoardModel?.drc === 'function';
        if (small) small.textContent = ready ? (drcFindings.length ? `${drcFindings.length} ${text('temuan','findings')}` : text('lulus check tersedia','available checks pass')) : text('engine memuat','engine loading');
        drc.dataset.truthGuard = ready ? '0' : '1';
      }
      if (badge) badge.textContent = String(ercFindings.length + drcFindings.length);
    }

    const card = document.querySelector('.pcbstage .floating-card');
    if (card) {
      const tracks = window.PCBProBoardModel?.tracks || [];
      const strong = card.querySelector('strong');
      const small = card.querySelector('small');
      const button = card.querySelector('button');
      card.dataset.truthGuard = '0';
      if (strong) strong.textContent = `${tracks.length} ${text('track','tracks')}`;
      if (small) small.textContent = drcFindings.length
        ? `${drcFindings.length} DRC ${text('temuan pada check tersedia','findings in available checks')}`
        : text('Route/Via/Zone aktif · jalankan DRC setelah perubahan','Route/Via/Zone active · run DRC after changes');
      if (button) {
        button.disabled = false;
        button.hidden = false;
        button.textContent = text('Aktifkan Route','Activate Route');
        button.title = text('Aktifkan router PCB nyata yang tersedia','Activate the available PCB router');
      }
    }

    const simPanel = [...document.querySelectorAll('.panel')].find((p) => /SIMULATION|SIMULASI/i.test(p.querySelector('.panel-title span')?.textContent || ''));
    if (simPanel && !simPanel.classList.contains('live-sim') && !simPanel.dataset.realSimMounted) {
      const h = simPanel.querySelector('.panel-title h2');
      const p = simPanel.querySelector('.panel-title p');
      const b = simPanel.querySelector('.panel-title button');
      if (h) h.textContent = text('Live Circuit Solver','Live Circuit Solver');
      if (p) p.textContent = text('Solver live sedang dimuat dari netlist aktif. Tidak ada angka placeholder.','The live solver is loading from the active netlist. No placeholder values are shown.');
      if (b) { b.disabled = false; b.textContent = '▶ Run'; }
    }
  }

  function downloadSnapshot() {
    const components = window.PCBProProject?.getComponents?.() || [...document.querySelectorAll('.stage.schematic .node')].map((n) => ({
      id:n.querySelector('.ref')?.textContent?.trim() || '',
      value:n.querySelector('b')?.textContent?.trim() || '',
      name:n.querySelector('small')?.textContent?.trim() || ''
    })).filter((x)=>x.id);
    const nets = window.PCBProWireEngine?.nets?.map(({name,pins})=>({name,pins})) || [];
    const payload = {
      format:'pcbpro0045-full-project-snapshot', version:VERSION, exportedAt:new Date().toISOString(),
      components,
      nets,
      wireGraph:window.PCBProWireEngine?.routes || [],
      board:window.PCBProBoardModel?.model || null,
      advancedBoard:window.PCBProAdvancedBoard?.model || null,
      professional:window.PCBProProfessional?.snapshot?.() || null,
      workflow:window.PCBProWorkflow?.snapshot?.() || null,
      database:window.PCBProDatabase?.snapshot?.() || null
    };
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'pcbpro0045-full-project.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
    notify(text('Full project snapshot diekspor dari state engine aktif.','Full project snapshot exported from active engine state.'));
  }

  function resetLayout() {
    for (const key of ['pcbpro0045-wiregraph-v1', 'pcbpro0045-wiregraph-v2', 'pcbpro0045-board-v1', 'pcbpro0045-board-advanced-v1']) localStorage.removeItem(key);
    window.PCBProWireEngine?.clear?.();
    window.PCBProBoardModel?.clear?.();
    window.PCBProAdvancedBoard?.clear?.();
  }
  window.addEventListener('pcbpro:reset-layout', (event) => { resetLayout(); event.preventDefault(); });

  function newProject() {
    if (!confirm(text('Buat project kosong baru? Project database saat ini tidak akan ditimpa; project baru akan dibuat saat reload.','Create a new empty project? The current database project will not be overwritten; a new project will be created after reload.'))) return;
    try {
      localStorage.setItem('pcbpro0045-project-v11', JSON.stringify({version:'1.19.0',components:[],savedAt:'New project'}));
      localStorage.setItem('pcbpro0045-cloud-create-new','1');
      localStorage.setItem('pcbpro0045-cloud-project-name','Untitled PCB');
      localStorage.removeItem('pcbpro0045-cloud-active-project');
      resetLayout();
      location.reload();
    } catch {
      notify(text('Penyimpanan gagal. Ekspor proyek sebelum mencoba lagi.','Storage failed. Export your project before trying again.'),'warn');
    }
  }

  function showMenu(anchor, items) {
    document.querySelector('#pcbpro-command-menu')?.remove();
    const r = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'pcbpro-command-menu';
    menu.style.left = `${Math.max(8,Math.min(innerWidth-210,r.left))}px`;
    menu.style.top = `${Math.min(innerHeight-220,r.bottom+5)}px`;
    items.forEach(({label,run,disabled}) => {
      const b = document.createElement('button'); b.textContent = label; b.disabled = Boolean(disabled); b.addEventListener('click',()=>{menu.remove();run?.()}); menu.appendChild(b);
    });
    document.body.appendChild(menu);
  }

  function menuItems(name) {
    const n = String(name || '').trim().toLowerCase();
    if (['berkas','file'].includes(n)) return [
      {label:text('Project baru','New project'),run:newProject},
      {label:text('Simpan','Save'),run:()=>[...document.querySelectorAll('.top-actions button')].find((b)=>/^(Simpan|Save)$/i.test(b.textContent.trim()))?.click()},
      {label:text('Ekspor project aktual','Export actual project'),run:downloadSnapshot}
    ];
    if (['edit'].includes(n)) return [
      {label:'Undo',run:()=>[...document.querySelectorAll('.tool-right button')].find((b)=>/Undo/i.test(b.textContent))?.click()},
      {label:'Redo',run:()=>[...document.querySelectorAll('.tool-right button')].find((b)=>/Redo/i.test(b.textContent))?.click()},
      {label:text('Hapus pilihan','Delete selection'),run:()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}))}
    ];
    if (['tampilan','view'].includes(n)) return [
      {label:text('Layout fleksibel','Flexible layout'),run:()=>applyLayout('flex')},
      {label:text('Fokus canvas','Canvas focus'),run:()=>applyLayout('focus')},
      {label:text('Fokus inspector','Inspector focus'),run:()=>applyLayout('inspect')}
    ];
    if (['tempatkan','place'].includes(n)) return [{label:text('Aktifkan tool Tempatkan','Activate Place tool'),run:()=>window.PCBProCommand?.clickTool?.('place')}];
    if (['jalur','route'].includes(n)) return [{label:currentView()==='schematic'?text('Aktifkan Kabel','Activate Wire'):text('Aktifkan PCB Route','Activate PCB Route'),run:()=>window.PCBProCommand?.clickTool?.(currentView()==='schematic'?'wire':'route')}];
    if (['periksa','inspect'].includes(n)) return [
      {label:text('Jalankan ERC','Run ERC'),run:()=>{const f=window.PCBProWorkflow?.runErc?.()||[];notify(f.length?`${f.length} ERC ${text('temuan','findings')}`:text('ERC check tersedia lulus','Available ERC checks pass'),f.length?'warn':'info')}},
      {label:text('Jalankan PCB DRC','Run PCB DRC'),run:()=>{const f=[...(window.PCBProBoardModel?.drc?.()||[]),...(window.PCBProAdvancedBoard?.drc?.()||[])];notify(f.length?`${f.length} DRC ${text('temuan','findings')}`:text('DRC check tersedia lulus','Available DRC checks pass'),f.length?'warn':'info')}},
      {label:text('Professional Audit','Professional Audit'),run:()=>window.PCBProProfessional?.open?.('audit')}
    ];
    if (['alat','tools'].includes(n)) return [
      {label:'AI Engineering Agent',run:()=>window.PCBProAssistantV115?.open?.()},
      {label:'Workflow',run:()=>window.PCBProWorkflow?.open?.()},
      {label:text('Professional Center','Professional Center'),run:()=>window.PCBProProfessional?.open?.('audit')},
      {label:text('System Health','System Health'),run:()=>window.PCBProStability?.open?.()}
    ];
    if (['produksi','manufacture'].includes(n)) return [{label:text('Buka Fabrikasi','Open Fabrication'),run:()=>window.PCBProCommand?.clickView?.('fabrication')}];
    return [];
  }

  function intercept(event) {
    const button = event.target.closest?.('button');
    if (!button) return;

    if (button.closest('.menus')) {
      const items = menuItems(button.textContent);
      if (items.length) { event.preventDefault(); event.stopImmediatePropagation(); showMenu(button,items); return; }
    }

    if (button.closest('.top-actions')) {
      const label = button.textContent.trim();
      if (/^(Baru|New)$/i.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); newProject(); return; }
      if (/^(Ekspor|Export)$/i.test(label)) { event.preventDefault(); event.stopImmediatePropagation(); downloadSnapshot(); return; }
    }

    if (button.closest('.tools') && button.classList.contains('pcb-tool-unavailable')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const tool = button.querySelector('small')?.textContent?.trim() || button.textContent.trim();
      notify(`${tool}: ${text('belum punya engine nyata, jadi sengaja tidak dipalsukan.','no real engine yet, so it is intentionally not faked.')}`,'warn');
      return;
    }

    if (/DRC/i.test(button.textContent || '') && (button.closest('.tool-right') || button.closest('.inspector'))) {
      event.preventDefault(); event.stopImmediatePropagation();
      const f=[...(window.PCBProBoardModel?.drc?.()||[]),...(window.PCBProAdvancedBoard?.drc?.()||[])];
      notify(f.length ? `${f.length} DRC ${text('temuan','findings')}` : text('DRC check yang tersedia lulus.','Available DRC checks pass.'), f.length?'warn':'info');
      return;
    }
  }

  function initialPanelBalance() {
    const key = 'pcbpro0045-panel-balance-v17';
    if (localStorage.getItem(key) || innerWidth < 1180) return;
    localStorage.setItem(key,'1');
    setTimeout(()=>{
      const buttons=[...document.querySelectorAll('.workspace-controls button')];
      buttons.find((b)=>/Library −/i.test(b.textContent))?.click();
      const plus=buttons.find((b)=>/Inspector \+/i.test(b.textContent));
      plus?.click(); plus?.click();
    },350);
  }

  function repair() {
    window.PCBProCommand?.stamp?.();
    mountTopControls();
    activeToolAvailability();
    updateTruthGuards();
  }

  function scheduleRepair(delay=60) {
    clearTimeout(repairTimer);
    repairTimer=setTimeout(repair,delay);
  }

  function start() {
    installStyles();
    document.addEventListener('click', intercept, true);
    document.addEventListener('pointerdown', closePopovers, true);
    document.addEventListener('click', () => scheduleRepair(30), {passive:true});
    window.addEventListener('pcbpro:language', () => scheduleRepair(20));
    window.addEventListener('pcbpro:netlist-changed', () => scheduleRepair(20));
    window.addEventListener('resize', () => scheduleRepair(80), {passive:true});
    initialPanelBalance();
    repair();
    [250,700,1300,2400].forEach((ms)=>setTimeout(repair,ms));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();

  window.PCBProWorkspaceRepair = {version:VERSION,repair,applyLayout,notify,downloadSnapshot};
})();