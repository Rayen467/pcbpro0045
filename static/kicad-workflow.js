(() => {
  'use strict';

  if (window.PCBProWorkflow) return;
  const VERSION = '1.0.0';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const lang = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';

  const copy = {
    id: {
      title: 'Workflow PCB dari skematik sampai fabrikasi',
      sub: 'Alur kerja bergaya KiCad 10, tapi statusnya dibaca dari project PCB Pro yang benar-benar aktif.',
      open: 'Workflow',
      close: 'Tutup',
      ready: 'Siap', done: 'Selesai', partial: 'Parsial', blocked: 'Terblokir',
      runErc: 'Jalankan ERC', openView: 'Buka workspace', exportJson: 'Export project JSON',
      sourceTruth: 'Status tidak dipalsukan. Langkah manufaktur hanya dianggap siap jika data geometri yang dibutuhkan benar-benar ada.',
      next: 'Langkah berikutnya', findings: 'Temuan', noFindings: 'Tidak ada temuan ERC dasar.',
      exact: 'Implementasi sekarang', limit: 'Batas saat ini'
    },
    en: {
      title: 'PCB workflow from schematic to fabrication',
      sub: 'A KiCad 10-style flow, with status derived from the actual active PCB Pro project.',
      open: 'Workflow',
      close: 'Close',
      ready: 'Ready', done: 'Done', partial: 'Partial', blocked: 'Blocked',
      runErc: 'Run ERC', openView: 'Open workspace', exportJson: 'Export project JSON',
      sourceTruth: 'Status is not fabricated. Manufacturing steps are only marked ready when the required geometry really exists.',
      next: 'Next step', findings: 'Findings', noFindings: 'No basic ERC findings.',
      exact: 'Implemented now', limit: 'Current limit'
    }
  };

  function t(key) { return copy[lang()]?.[key] || copy.id[key] || key; }

  function capture() {
    const components = [...document.querySelectorAll('.node')].map((node) => ({
      id: node.querySelector('.ref')?.textContent?.trim() || '',
      name: node.querySelector('small')?.textContent?.trim() || '',
      value: node.querySelector('b')?.textContent?.trim() || '',
      footprint: (() => {
        const ref = node.querySelector('.ref')?.textContent?.trim() || '';
        const selected = [...document.querySelectorAll('.inspector section')].find((s) => /PROPERTIES|PROPERTI/i.test(s.textContent || ''));
        const selectedRef = selected?.querySelector('.ins-title b')?.textContent?.trim();
        if (selectedRef !== ref) return '';
        return [...(selected?.querySelectorAll('label') || [])].find((l) => /Footprint/i.test(l.querySelector('span')?.textContent || ''))?.querySelector('input')?.value || '';
      })()
    })).filter((x) => x.id);

    let stored = null;
    try { stored = JSON.parse(localStorage.getItem('pcbpro0045-project-v11') || localStorage.getItem('pcbpro0045-project') || 'null'); } catch {}
    const storedById = new Map((stored?.components || []).map((c) => [c.id, c]));
    for (const c of components) {
      const s = storedById.get(c.id);
      if (s) {
        c.footprint = c.footprint || s.footprint || '';
        c.px = s.px; c.py = s.py; c.sx = s.sx; c.sy = s.sy;
        c.code = s.code || c.id.replace(/\d.*$/, '');
      }
    }

    const nets = [...document.querySelectorAll('.inspector .net')].map((button) => ({
      name: button.querySelector('b')?.textContent?.trim() || '',
      pins: button.querySelector('small')?.textContent?.trim() || ''
    })).filter((x) => x.name && x.pins);

    return { components, nets, stored };
  }

  function pinList(raw) {
    return String(raw || '').split(/[·,;\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+\d+\.\d+$/.test(x));
  }

  function codeOf(c) {
    const text = `${c.id} ${c.name}`.toLowerCase();
    if (/ground/.test(text)) return 'GND';
    if (/led/.test(text)) return 'LED';
    if (/resistor/.test(text)) return 'R';
    if (/capacitor/.test(text)) return 'C';
    if (/inductor/.test(text)) return 'L';
    if (/source/.test(text)) return 'V';
    if (/diode/.test(text)) return 'D';
    if (/switch/.test(text)) return 'SW';
    return String(c.code || c.id.replace(/\d.*$/, '')).toUpperCase();
  }

  function runErc(design = capture()) {
    const findings = [];
    const ids = design.components.map((c) => c.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dup.length) findings.push(`Duplicate reference: ${[...new Set(dup)].join(', ')}`);
    for (const c of design.components) {
      if (!/^[A-Za-z]+\d+$/.test(c.id)) findings.push(`${c.id}: reference belum ter-annotate dengan format RefDes yang valid.`);
    }
    const allPins = design.nets.flatMap((n) => pinList(n.pins));
    const hasGround = design.nets.some((n) => /(^|\W)(gnd|0)(\W|$)/i.test(n.name));
    if (!hasGround) findings.push('Tidak ada GND / reference node pada netlist aktif.');
    for (const c of design.components) {
      const code = codeOf(c);
      if (!['V','R','C','L','D','LED','SW'].includes(code)) continue;
      const count = allPins.filter((p) => p.startsWith(`${c.id}.`)).length;
      if (count < 2) findings.push(`${c.id}: hanya ${count} pin yang tercatat di netlist; cek floating/unconnected pin.`);
    }
    const physical = design.components.filter((c) => codeOf(c) !== 'GND');
    const missingFp = physical.filter((c) => !c.footprint || c.footprint === '—');
    if (missingFp.length) findings.push(`Footprint belum ditentukan: ${missingFp.map((c)=>c.id).join(', ')}.`);
    return findings;
  }

  function geometryState() {
    const boardVisible = Boolean(document.querySelector('.board'));
    const persistentTraceEngine = Boolean(window.PCBProProject?.traces || window.PCBProBoardModel?.traces);
    const persistentZones = Boolean(window.PCBProProject?.zones || window.PCBProBoardModel?.zones);
    const explicitOutline = Boolean(window.PCBProProject?.boardOutline || window.PCBProBoardModel?.outline);
    return { boardVisible, persistentTraceEngine, persistentZones, explicitOutline };
  }

  function buildSnapshot() {
    const design = capture();
    const findings = runErc(design);
    const physical = design.components.filter((c) => codeOf(c) !== 'GND');
    const refsOk = design.components.length > 0 && new Set(design.components.map((c)=>c.id)).size === design.components.length && design.components.every((c)=>/^[A-Za-z]+\d+$/.test(c.id));
    const footprintsOk = physical.length > 0 && physical.every((c)=>c.footprint && c.footprint !== '—');
    const placed = physical.length > 0 && physical.every((c)=>Number.isFinite(c.px) && Number.isFinite(c.py));
    const geo = geometryState();
    const routed = geo.persistentTraceEngine;
    const zones = geo.persistentZones;
    const outline = geo.explicitOutline;
    const ercOk = design.components.length > 0 && findings.length === 0;

    const stages = [
      { id:'project', label:{id:'Buat / buka project',en:'Create / open project'}, status:'done', view:'Schematic', detail:{id:'Project PCB Pro aktif dan state lokal tersedia.',en:'PCB Pro project is active and local project state is available.'}},
      { id:'workflow', label:{id:'Pahami alur kerja',en:'Understand workflow'}, status:'done', view:'Schematic', detail:{id:'Workflow sekarang mengikuti urutan schematic → ERC → PCB → DRC → fabrication.',en:'Workflow follows schematic → ERC → PCB → DRC → fabrication.'}},
      { id:'schematic', label:{id:'Gambar schematic',en:'Draw schematic'}, status: design.components.length && design.nets.length ? 'done':'ready', view:'Schematic', detail:{id:`${design.components.length} komponen · ${design.nets.length} net terbaca.`,en:`${design.components.length} components · ${design.nets.length} nets detected.`}},
      { id:'components', label:{id:'Tambah & edit komponen',en:'Add & edit components'}, status: design.components.length ? 'done':'ready', view:'Schematic', detail:{id:'Library dan property editor tersedia.',en:'Library and property editing are available.'}},
      { id:'annotate', label:{id:'Annotate schematic',en:'Annotate schematic'}, status: refsOk ? 'done':'ready', view:'Schematic', detail:{id:refsOk?'Reference designator unik dan terformat.':'Masih ada ref yang belum valid/unik.',en:refsOk?'Reference designators are unique and formatted.':'Some references are not yet valid/unique.'}},
      { id:'footprints', label:{id:'Assign PCB footprints',en:'Assign PCB footprints'}, status: footprintsOk ? 'done':'ready', view:'Schematic', detail:{id:footprintsOk?'Semua komponen fisik punya footprint.':'Masih ada komponen fisik tanpa footprint.',en:footprintsOk?'All physical components have footprints.':'Some physical components are missing footprints.'}},
      { id:'erc', label:{id:'Electrical Rules Check (ERC)',en:'Electrical Rules Check (ERC)'}, status: ercOk ? 'done':'ready', view:'Schematic', detail:{id:ercOk?'ERC dasar lulus.':'ERC dasar masih punya temuan.',en:ercOk?'Basic ERC passes.':'Basic ERC still has findings.'}},
      { id:'sync', label:{id:'Update PCB dari schematic',en:'Update PCB from schematic'}, status: ercOk && footprintsOk ? 'done':'ready', view:'PCB', detail:{id:'PCB Pro memakai project state yang sama untuk schematic dan footprint placement; belum punya file-board terpisah seperti KiCad.',en:'PCB Pro shares project state between schematic and footprint placement; it does not yet use a separate board document like KiCad.'}},
      { id:'outline', label:{id:'Board outline / Edge.Cuts',en:'Board outline / Edge.Cuts'}, status: outline ? 'done':'partial', view:'PCB', detail:{id:outline?'Outline eksplisit ada di board model.':'Outline yang terlihat sekarang masih visual; belum menjadi geometri Edge.Cuts manufacturing source-of-truth.',en:outline?'Explicit outline exists in the board model.':'The visible outline is still visual; it is not yet manufacturing source-of-truth Edge.Cuts geometry.'}},
      { id:'placement', label:{id:'Component placement',en:'Component placement'}, status: placed ? 'done':'ready', view:'PCB', detail:{id:placed?'Semua footprint punya koordinat placement.':'Masih ada footprint yang belum punya koordinat placement.',en:placed?'All footprints have placement coordinates.':'Some footprints are missing placement coordinates.'}},
      { id:'routing', label:{id:'Routing PCB traces',en:'Route PCB traces'}, status: routed ? 'done':'blocked', view:'PCB', detail:{id:routed?'Trace graph persisten tersedia.':'Tool Route ada, tetapi trace geometry belum tersimpan sebagai source-of-truth. Karena itu status routing tidak dipalsukan.',en:routed?'Persistent trace graph exists.':'The Route tool exists, but trace geometry is not yet persisted as source of truth. Routing completion is therefore not faked.'}},
      { id:'zones', label:{id:'Copper zones / ground plane',en:'Copper zones / ground plane'}, status: zones ? 'done':'blocked', view:'PCB', detail:{id:zones?'Copper zone geometry persisten tersedia.':'Zone tool belum menghasilkan polygon copper persisten yang bisa difabrikasi.',en:zones?'Persistent copper zone geometry exists.':'The Zone tool does not yet create persistent manufacturable copper polygons.'}},
      { id:'preflight', label:{id:'DRC + manufacturing preflight',en:'DRC + manufacturing preflight'}, status: routed && zones && outline && ercOk ? 'ready':'blocked', view:'Rules', detail:{id:'Preflight manufacturing harus memakai outline, track, via, clearance, drill, zone, dan connectivity yang nyata.',en:'Manufacturing preflight must use real outline, tracks, vias, clearance, drill, zones, and connectivity.'}},
      { id:'fabrication', label:{id:'Export Gerber + drill files',en:'Export Gerber + drill files'}, status: routed && outline ? 'ready':'blocked', view:'Fabrication', detail:{id:'Gerber/Excellon tidak akan dibuat dari gambar UI palsu. Export baru boleh aktif setelah board geometry source-of-truth lengkap.',en:'Gerber/Excellon will not be generated from fake UI graphics. Export is only enabled after board geometry source of truth is complete.'}},
      { id:'cam', label:{id:'Check manufacturing files',en:'Check manufacturing files'}, status:'blocked', view:'Fabrication', detail:{id:'CAM/Gerber viewer akan aktif setelah exporter menghasilkan file manufacturing nyata.',en:'CAM/Gerber inspection becomes available after the exporter produces real manufacturing files.'}},
      { id:'order', label:{id:'Handoff / order ke JLCPCB',en:'Handoff / order to JLCPCB'}, status:'blocked', view:'Fabrication', detail:{id:'Ordering tidak boleh dibuka sebagai “siap” sebelum Gerber + drill + DRC valid.',en:'Ordering must not be marked ready until Gerber + drill + DRC are valid.'}}
    ];

    const done = stages.filter((s)=>s.status==='done').length;
    const next = stages.find((s)=>s.status!=='done') || stages[stages.length-1];
    return { version:VERSION, generatedAt:new Date().toISOString(), design:{components:design.components.map(({sx,sy,px,py,...c})=>({...c,sx,sy,px,py})),nets:design.nets}, findings, geometry:geo, stages, done, total:stages.length, next:next.id };
  }

  function clickView(name) {
    const button = [...document.querySelectorAll('.tabs button')].find((b)=>b.textContent.trim().toLowerCase()===name.toLowerCase());
    if (button) { button.click(); return true; }
    return false;
  }

  function downloadProject() {
    const snapshot = buildSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pcbpro-project-workflow-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 500);
  }

  function statusText(status) { return t(status); }

  function render() {
    const root = document.querySelector('#pcbpro-kicad-flow');
    if (!root) return;
    const snap = buildSnapshot();
    const selectedId = root.dataset.selected || snap.next;
    const selected = snap.stages.find((s)=>s.id===selectedId) || snap.stages[0];
    root.dataset.selected = selected.id;
    const l = lang();
    const detail = selected.detail?.[l] || selected.detail?.id || '';
    const progress = Math.round((snap.done/snap.total)*100);

    root.querySelector('.kw-title').textContent = t('title');
    root.querySelector('.kw-sub').textContent = t('sub');
    root.querySelector('.kw-progress-label').textContent = `${snap.done}/${snap.total} · ${progress}%`;
    root.querySelector('.kw-bar i').style.width = `${progress}%`;
    root.querySelector('.kw-steps').innerHTML = snap.stages.map((s,i)=>`<button data-stage="${s.id}" class="${s.id===selected.id?'active':''}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(s.label[l] || s.label.id)}</b><small class="${s.status}">${esc(statusText(s.status))}</small></div></button>`).join('');
    root.querySelector('.kw-detail').innerHTML = `<div class="kw-detail-head"><div><span>${String(snap.stages.indexOf(selected)+1).padStart(2,'0')} / ${snap.total}</span><h3>${esc(selected.label[l] || selected.label.id)}</h3></div><b class="kw-pill ${selected.status}">${esc(statusText(selected.status))}</b></div><p>${esc(detail)}</p><div class="kw-actions"><button data-open="${esc(selected.view)}">${esc(t('openView'))}: ${esc(selected.view)}</button>${selected.id==='erc'?`<button data-erc>${esc(t('runErc'))}</button>`:''}<button data-export>${esc(t('exportJson'))}</button></div>`;
    root.querySelector('.kw-findings').innerHTML = snap.findings.length ? `<b>${esc(t('findings'))}</b>${snap.findings.map((f)=>`<p>• ${esc(f)}</p>`).join('')}` : `<b>${esc(t('findings'))}</b><p>${esc(t('noFindings'))}</p>`;
    root.querySelector('.kw-truth').textContent = t('sourceTruth');
    const launch = document.querySelector('#pcbpro-workflow-launch');
    if (launch) launch.textContent = `${t('open')} ${snap.done}/${snap.total}`;

    root.querySelectorAll('[data-stage]').forEach((b)=>b.addEventListener('click',()=>{root.dataset.selected=b.dataset.stage;render();}));
    root.querySelector('[data-open]')?.addEventListener('click',(e)=>{clickView(e.currentTarget.dataset.open);});
    root.querySelector('[data-erc]')?.addEventListener('click',()=>render());
    root.querySelector('[data-export]')?.addEventListener('click',downloadProject);
  }

  function install() {
    if (document.querySelector('#pcbpro-kicad-flow')) return;
    const style = document.createElement('style');
    style.id = 'pcbpro-kicad-flow-style';
    style.textContent = `
      #pcbpro-workflow-launch{border:1px solid #2b6659;background:#10261f;color:#75dfc8;border-radius:8px;padding:8px 10px;font-size:10px;font-weight:800}
      #pcbpro-kicad-flow{position:fixed;z-index:220;inset:0;background:#02070bcc;display:none;place-items:center;padding:24px}#pcbpro-kicad-flow.open{display:grid}.kw-shell{width:min(1120px,96vw);height:min(760px,92vh);display:grid;grid-template-columns:340px 1fr;background:#09131c;border:1px solid #294151;border-radius:14px;overflow:hidden;box-shadow:0 30px 100px #000c}.kw-side{background:#08111a;border-right:1px solid #1d303d;display:flex;flex-direction:column;min-height:0}.kw-side-head{padding:18px;border-bottom:1px solid #1b2d39}.kw-side-head h2{margin:0;font-size:20px;color:#e5eef3}.kw-side-head p{margin:7px 0 12px;font-size:10px;line-height:1.5;color:#8297a5}.kw-progress{display:flex;align-items:center;gap:10px}.kw-bar{height:7px;flex:1;background:#152530;border-radius:999px;overflow:hidden}.kw-bar i{display:block;height:100%;background:#46d0b6}.kw-progress-label{font:800 9px ui-monospace;color:#65d5bd}.kw-steps{overflow:auto;padding:8px}.kw-steps button{width:100%;display:grid;grid-template-columns:30px 1fr;gap:8px;align-items:center;text-align:left;border:1px solid transparent;background:transparent;color:#b5c6d0;padding:9px;border-radius:8px}.kw-steps button:hover,.kw-steps button.active{background:#0f202b;border-color:#29404d}.kw-steps button>span{font:800 9px ui-monospace;color:#5f7888}.kw-steps b{display:block;font-size:10px}.kw-steps small{display:inline-block;margin-top:3px;font:800 8px ui-monospace}.kw-steps small.done,.kw-pill.done{color:#60d6b9}.kw-steps small.ready,.kw-pill.ready{color:#77b9e8}.kw-steps small.partial,.kw-pill.partial{color:#e0bd66}.kw-steps small.blocked,.kw-pill.blocked{color:#e08a73}.kw-main{display:flex;flex-direction:column;min-width:0}.kw-top{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #1d303d}.kw-top b{font-size:11px;color:#7790a0}.kw-close{border:1px solid #29404d;background:#0d1a24;color:#c3d0d7;border-radius:7px;padding:7px 10px}.kw-body{padding:22px;overflow:auto}.kw-detail{border:1px solid #263e4c;background:#0d1923;border-radius:12px;padding:16px}.kw-detail-head{display:flex;justify-content:space-between;gap:12px}.kw-detail-head span{font:800 9px ui-monospace;color:#5d788a}.kw-detail h3{font-size:22px;margin:4px 0;color:#e8f0f4}.kw-detail p{font-size:11px;color:#8fa2ae;line-height:1.65}.kw-pill{border:1px solid #304a57;border-radius:999px;padding:6px 9px;font:800 8px ui-monospace;height:max-content}.kw-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.kw-actions button{border:1px solid #2c4a58;background:#10212b;color:#b9cbd4;border-radius:8px;padding:8px 10px;font-size:9px}.kw-actions button:first-child{background:#12362e;border-color:#2b6c5d;color:#70dbc2}.kw-findings{margin-top:12px;border:1px solid #283d49;background:#0a151d;border-radius:10px;padding:13px}.kw-findings>b{font-size:10px;color:#d4e0e6}.kw-findings p{font-size:9px;color:#899da9;line-height:1.5;margin:6px 0}.kw-truth{margin-top:12px;border:1px solid #594925;background:#211b10;color:#d1b96e;border-radius:9px;padding:10px;font-size:9px;line-height:1.55}@media(max-width:800px){#pcbpro-kicad-flow{padding:8px}.kw-shell{grid-template-columns:1fr;height:96vh}.kw-side{max-height:42vh}.kw-main{min-height:0}}
    `;
    document.head.appendChild(style);

    const launch = document.createElement('button');
    launch.id = 'pcbpro-workflow-launch';
    launch.textContent = t('open');
    (document.querySelector('.top-actions') || document.querySelector('.topbar') || document.body).appendChild(launch);

    const root = document.createElement('div');
    root.id = 'pcbpro-kicad-flow';
    root.innerHTML = `<div class="kw-shell"><aside class="kw-side"><div class="kw-side-head"><h2 class="kw-title"></h2><p class="kw-sub"></p><div class="kw-progress"><div class="kw-bar"><i></i></div><span class="kw-progress-label"></span></div></div><div class="kw-steps"></div></aside><main class="kw-main"><div class="kw-top"><b>PCB PRO · KICAD-STYLE WORKFLOW · v${VERSION}</b><button class="kw-close">×</button></div><div class="kw-body"><section class="kw-detail"></section><section class="kw-findings"></section><div class="kw-truth"></div></div></main></div>`;
    document.body.appendChild(root);

    launch.addEventListener('click',()=>{root.classList.add('open');render();});
    root.querySelector('.kw-close').addEventListener('click',()=>root.classList.remove('open'));
    root.addEventListener('click',(e)=>{if(e.target===root)root.classList.remove('open');});
    window.addEventListener('pcbpro:language',render);
    document.addEventListener('click',(e)=>{if(e.target.closest('.tabs button,.part,.node,.footprint,.toolbar button'))setTimeout(render,100);},{passive:true});
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();

  window.PCBProWorkflow = {
    version:VERSION,
    snapshot:buildSnapshot,
    runErc:()=>runErc(capture()),
    open(){document.querySelector('#pcbpro-kicad-flow')?.classList.add('open');render();},
    refresh:render
  };
})();