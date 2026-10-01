(() => {
  'use strict';

  const VERSION = '0.1.0';
  let root = null;
  let open = true;
  let history = [];
  let refreshTimer = 0;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function parseEng(raw) {
    const text = String(raw ?? '').trim().replace(',', '.').replace(/Ω/gi, '').replace(/ohms?/gi, '');
    const m = text.match(/([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnumkMGTµμ]?)/);
    if (!m) return NaN;
    const map = {p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,'μ':1e-6,m:1e-3,'':1,k:1e3,M:1e6,G:1e9,T:1e12};
    return Number(m[1]) * (map[m[2] || ''] ?? 1);
  }

  function fmt(v, unit='') {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    const scales = [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n']];
    const [s,p] = scales.find(([x]) => a >= x) || [1e-12,'p'];
    const n = v/s;
    return `${n.toFixed(Math.abs(n)>=100?1:Math.abs(n)>=10?2:3)} ${p}${unit}`.trim();
  }

  function capture() {
    const components = [...document.querySelectorAll('.node')].map((node) => ({
      id: node.querySelector('.ref')?.textContent?.trim() || '',
      value: node.querySelector('b')?.textContent?.trim() || '',
      name: node.querySelector('small')?.textContent?.trim() || '',
      symbol: node.querySelector('.symbol')?.textContent?.trim() || '',
      node
    })).filter((x) => x.id);

    const nets = [...document.querySelectorAll('.inspector .net')].map((button) => ({
      name: button.querySelector('b')?.textContent?.trim() || '',
      pins: button.querySelector('small')?.textContent?.trim() || ''
    })).filter((x) => x.name);

    return { components, nets };
  }

  function inferCode(c) {
    const x = `${c.id} ${c.name} ${c.symbol}`.toLowerCase();
    if (/dc source|voltage source/.test(x) || /^v\d+/i.test(c.id)) return 'V';
    if (/resistor/.test(x) || /^r\d+/i.test(c.id)) return 'R';
    if (/capacitor/.test(x) || /^c\d+/i.test(c.id)) return 'C';
    if (/inductor/.test(x) || /^l\d+/i.test(c.id)) return 'L';
    if (/led/.test(x)) return 'LED';
    if (/diode/.test(x) || /^d\d+/i.test(c.id)) return 'D';
    if (/mosfet/.test(x) || /^q\d+/i.test(c.id)) return 'Q';
    if (/op-amp/.test(x) || /^u\d+/i.test(c.id)) return 'U';
    if (/ground/.test(x)) return 'GND';
    return c.id.replace(/\d.*$/, '').toUpperCase();
  }

  function pinsForRef(nets, ref) {
    const out = [];
    for (const net of nets) {
      const pins = String(net.pins).split(/[·,\s]+/).filter(Boolean);
      for (const pin of pins) if (pin.startsWith(`${ref}.`)) out.push({ net: net.name, pin });
    }
    return out;
  }

  function nearestStandardR(ohms) {
    const e24 = [10,11,12,13,15,16,18,20,22,24,27,30,33,36,39,43,47,51,56,62,68,75,82,91];
    if (!Number.isFinite(ohms) || ohms <= 0) return 330;
    const decade = 10 ** Math.floor(Math.log10(ohms / 10));
    const normalized = ohms / decade;
    const pick = e24.reduce((best, n) => Math.abs(n-normalized) < Math.abs(best-normalized) ? n : best, e24[0]);
    return pick * decade;
  }

  function analyze() {
    const { components, nets } = capture();
    const coded = components.map((c) => ({...c, code: inferCode(c)}));
    const issues = [];
    const warnings = [];
    const notes = [];
    let suggestedFix = null;

    const ground = nets.some((n) => /(^|\W)(gnd|0)(\W|$)/i.test(n.name));
    if (!ground) issues.push('Ground reference belum ada di netlist. Solver dan pengukuran lapangan butuh referensi 0 V yang jelas.');

    for (const c of coded) {
      if (['GND','J','TP'].includes(c.code)) continue;
      const pinCount = pinsForRef(nets, c.id).length;
      if (pinCount < 2 && !['Q','U'].includes(c.code)) warnings.push(`${c.id} hanya terbaca di ${pinCount} koneksi net; cek pin yang floating.`);
    }

    const source = coded.find((c) => c.code === 'V');
    const resistor = coded.find((c) => c.code === 'R');
    const led = coded.find((c) => c.code === 'LED');
    if (source && resistor && led) {
      const vs = parseEng(source.value);
      const r = parseEng(resistor.value);
      const vf = parseEng(led.value) || 2;
      if (Number.isFinite(vs) && Number.isFinite(r) && r > 0) {
        const i = Math.max(0, (vs - vf) / r);
        const p = i*i*r;
        notes.push(`Perkiraan nominal jalur LED: ${fmt(i,'A')} dan daya ${resistor.id} sekitar ${fmt(p,'W')}.`);
        if (i > 0.015) {
          const target = 0.010;
          const recommended = nearestStandardR((vs-vf)/target);
          issues.push(`Arus nominal LED sekitar ${fmt(i,'A')}, cukup agresif untuk desain generik tanpa datasheet LED.`);
          suggestedFix = { type:'value', ref:resistor.id, value: recommended >= 1000 ? `${recommended/1000} kΩ` : `${recommended} Ω`, reason:`Turunkan target generik ke sekitar 10 mA.` };
        }
        if (p > 0.20) warnings.push(`${resistor.id} disipasi nominal ${fmt(p,'W')}; verifikasi rating package dan derating suhu.`);
      }
    }

    const reality = window.PCBProReality?.lastEnvelope;
    if (reality?.envelope) {
      const env = reality.envelope;
      const pass = env.rows?.filter((r) => !r.failReasons?.length).length || 0;
      const total = env.rows?.length || 0;
      if (total) notes.push(`Reality Lab terakhir: ${pass}/${total} trial melewati limit generik tanpa finding.`);
      if (env.failures?.size) warnings.push(`${env.failures.size} kelas failure ditemukan di Monte Carlo terakhir.`);
      if (Number.isFinite(env.maxTemp?.p95) && env.maxTemp.p95 > 100) issues.push(`P95 temperatur mencapai ${env.maxTemp.p95.toFixed(1)} °C; perlu thermal margin lebih besar.`);
    } else {
      warnings.push('Reality Lab belum dijalankan pada state desain sekarang. Jalankan field envelope sebelum sign-off.');
    }

    if (coded.some((c) => ['Q','U'].includes(c.code))) warnings.push('Ada MOSFET/op-amp tetapi model vendor belum terhubung. Jangan anggap hasil sign-off final sebelum .model/.lib tersedia.');
    if (!issues.length) notes.push('Tidak ada masalah fatal yang terdeteksi oleh rule set lokal saat ini, tetapi ini belum menggantikan SPICE vendor + pengukuran hardware.');

    return { components:coded, nets, issues, warnings, notes, suggestedFix };
  }

  function renderVisual() {
    if (!root) return;
    const target = root.querySelector('.jarvis-visual');
    if (!target) return;
    const { components, nets } = capture();
    const stage = document.querySelector('.stage.schematic');
    const box = stage?.getBoundingClientRect();
    const coords = new Map();

    components.forEach((c, index) => {
      const r = c.node.getBoundingClientRect();
      const x = box ? ((r.left + r.width/2 - box.left) / Math.max(1,box.width))*100 : 15 + (index%4)*23;
      const y = box ? ((r.top + r.height/2 - box.top) / Math.max(1,box.height))*100 : 25 + Math.floor(index/4)*35;
      coords.set(c.id, {x:Math.max(8,Math.min(92,x)), y:Math.max(12,Math.min(88,y))});
    });

    const edges = [];
    for (const net of nets) {
      const refs = String(net.pins).split(/[·,\s]+/).filter(Boolean).map((p)=>p.split('.')[0]).filter((v,i,a)=>v && a.indexOf(v)===i);
      for (let i=0;i<refs.length-1;i++) if (coords.has(refs[i]) && coords.has(refs[i+1])) edges.push({a:coords.get(refs[i]),b:coords.get(refs[i+1]),name:net.name});
    }

    target.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Live schematic mini map">
      <defs><pattern id="jarvisGrid" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx=".4" cy=".4" r=".18" fill="#284252"/></pattern></defs>
      <rect width="100" height="100" fill="#08131c"/><rect width="100" height="100" fill="url(#jarvisGrid)"/>
      ${edges.map((e)=>{const mx=(e.a.x+e.b.x)/2;return `<path d="M${e.a.x},${e.a.y} H${mx} V${e.b.y} H${e.b.x}" fill="none" stroke="#48d4bd" stroke-width=".55" vector-effect="non-scaling-stroke"/><text x="${mx+1}" y="${(e.a.y+e.b.y)/2-1}" fill="#5f8da1" font-size="2.1">${esc(e.name)}</text>`}).join('')}
      ${components.map((c)=>{const p=coords.get(c.id)||{x:50,y:50};return `<g><rect x="${p.x-7}" y="${p.y-4}" width="14" height="8" rx="1.2" fill="#0d202b" stroke="#2b5865" stroke-width=".35"/><text x="${p.x}" y="${p.y-.4}" text-anchor="middle" fill="#d8e8ee" font-size="2.5" font-weight="700">${esc(c.id)}</text><text x="${p.x}" y="${p.y+2.3}" text-anchor="middle" fill="#6fcfbd" font-size="1.8">${esc(c.value)}</text></g>`}).join('')}
    </svg>`;

    const report = analyze();
    root.querySelector('.jarvis-health').innerHTML = `<span class="${report.issues.length?'bad':report.warnings.length?'warn':'good'}"></span><b>${report.issues.length ? `${report.issues.length} critical` : report.warnings.length ? `${report.warnings.length} checks` : 'design clean'}</b><small>${components.length} parts · ${nets.length} nets</small>`;
  }

  function addMessage(role, text, actions=[]) {
    history.push({role,text,actions});
    const log = root?.querySelector('.jarvis-log');
    if (!log) return;
    const row = document.createElement('div');
    row.className = `jarvis-msg ${role}`;
    row.innerHTML = `<div class="jarvis-avatar">${role==='user'?'YOU':'J'}</div><div class="jarvis-bubble"><p>${esc(text).replace(/\n/g,'<br>')}</p>${actions.length?`<div class="jarvis-actions">${actions.map((a,i)=>`<button data-action="${i}">${esc(a.label)}</button>`).join('')}</div>`:''}</div>`;
    log.appendChild(row);
    actions.forEach((a,i)=>row.querySelector(`[data-action="${i}"]`)?.addEventListener('click',()=>a.run()));
    log.scrollTop = log.scrollHeight;
  }

  function clickTab(name) {
    const tab = [...document.querySelectorAll('.tabs button')].find((b)=>b.textContent.trim().toLowerCase()===name.toLowerCase());
    if (!tab) return false;
    tab.click();
    return true;
  }

  async function selectRef(ref) {
    const node = [...document.querySelectorAll('.node')].find((n)=>n.querySelector('.ref')?.textContent?.trim().toLowerCase()===ref.toLowerCase());
    if (!node) return false;
    const r = node.getBoundingClientRect();
    const pointerId = 88771;
    node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    await wait(60);
    return true;
  }

  async function setValue(ref, value) {
    if (!await selectRef(ref)) return false;
    const inspector = document.querySelector('.inspector');
    const labels = [...inspector.querySelectorAll('label')];
    const label = labels.find((l)=>l.querySelector('span')?.textContent?.trim().toLowerCase()==='value');
    const input = label?.querySelector('input');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
    setter?.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(100);
    window.PCBProReality?.rerun?.();
    renderVisual();
    return true;
  }

  async function addPartByName(name) {
    const part = [...document.querySelectorAll('.part')].find((p)=>p.querySelector('.part-copy b')?.textContent?.toLowerCase().includes(name.toLowerCase()));
    if (!part) return false;
    const r = part.getBoundingClientRect();
    const pointerId = 88772;
    part.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
    await wait(100);
    renderVisual();
    return true;
  }

  function describeAudit() {
    const r = analyze();
    const blocks = [];
    if (r.issues.length) blocks.push(`Yang perlu dibenerin dulu:\n- ${r.issues.join('\n- ')}`);
    if (r.warnings.length) blocks.push(`Yang masih perlu diverifikasi:\n- ${r.warnings.join('\n- ')}`);
    if (r.notes.length) blocks.push(`Yang gue baca dari desain:\n- ${r.notes.join('\n- ')}`);
    const actions = [];
    if (r.suggestedFix) actions.push({label:`Apply ${r.suggestedFix.ref} → ${r.suggestedFix.value}`,run:async()=>{const ok=await setValue(r.suggestedFix.ref,r.suggestedFix.value);addMessage('assistant',ok?`${r.suggestedFix.ref} sudah gue ubah ke ${r.suggestedFix.value}. Reality Lab gue jalankan ulang.`:`Gue belum bisa mengubah ${r.suggestedFix.ref}; pilih komponennya lalu coba lagi.`)}});
    actions.push({label:'Run Reality Lab',run:runSimulation});
    addMessage('assistant', blocks.join('\n\n') || 'Belum ada data desain yang bisa gue baca.', actions);
  }

  async function runSimulation() {
    if (!clickTab('Simulator')) return addMessage('assistant','Tab Simulator nggak ditemukan di workspace sekarang.');
    addMessage('assistant','Gue pindahin ke Field Reality Lab dan jalanin ulang envelope dari state desain terbaru.');
    await wait(250);
    window.PCBProReality?.rerun?.();
    setTimeout(()=>renderVisual(),450);
  }

  async function autoFix() {
    const r = analyze();
    if (!r.suggestedFix) {
      addMessage('assistant','Gue nggak nemu perubahan otomatis yang cukup aman dari rule lokal sekarang. Gue tahan perubahan daripada nebak nilai tanpa datasheet.');
      return;
    }
    const ok = await setValue(r.suggestedFix.ref,r.suggestedFix.value);
    addMessage('assistant', ok ? `${r.suggestedFix.ref} gue ubah ke ${r.suggestedFix.value}. Alasan: ${r.suggestedFix.reason}` : 'Perubahan otomatis gagal diterapkan ke inspector.');
  }

  async function handle(text) {
    const q = text.trim();
    if (!q) return;
    addMessage('user',q);
    const lower = q.toLowerCase();

    const setMatch = q.match(/(?:ubah|set|ganti)\s+([a-z]+\d+)\s+(?:jadi|ke|=)?\s*([^,;]+)/i);
    if (setMatch) {
      const [,ref,value] = setMatch;
      const ok = await setValue(ref,value.trim());
      addMessage('assistant', ok ? `${ref.toUpperCase()} sudah gue ubah ke ${value.trim()}. Gue sinkronkan visual dan minta Reality Lab hitung ulang.` : `Gue nggak menemukan ${ref.toUpperCase()} atau field Value-nya belum tersedia.`);
      return;
    }

    const addMatch = lower.match(/(?:tambah|masukin|tambahkan)\s+(resistor|capacitor|kapasitor|inductor|induktor|led|diode|mosfet|op-amp|switch|saklar|connector|ground)/i);
    if (addMatch) {
      const map={kapasitor:'capacitor',induktor:'inductor',saklar:'switch'};
      const name=map[addMatch[1]]||addMatch[1];
      const ok=await addPartByName(name);
      addMessage('assistant',ok?`${name} sudah gue ambil dari library. Sekarang placement-nya aktif; klik posisi yang lo mau di schematic.`:`Komponen ${name} belum ketemu di library.`);
      return;
    }

    if (/simul|field|reality|run/.test(lower)) return runSimulation();
    if (/audit|cek|periksa|analisa|analisis|salah|kurang|aman|lapangan/.test(lower)) return describeAudit();
    if (/perbaiki|fix|benerin otomatis|benarin otomatis/.test(lower)) return autoFix();
    if (/\bpcb\b/.test(lower) && /(buka|lihat|pindah)/.test(lower)) { clickTab('PCB'); addMessage('assistant','Workspace PCB gue buka. Visual assistant tetap ikut baca state project yang sama.'); return; }
    if (/skematik|schematic/.test(lower) && /(buka|lihat|pindah)/.test(lower)) { clickTab('Schematic'); addMessage('assistant','Schematic gue buka lagi.'); return; }

    const report = analyze();
    const provider = window.PCBProAssistantProvider;
    if (typeof provider === 'function') {
      try {
        const answer = await provider({query:q,design:{components:report.components.map(({node,...x})=>x),nets:report.nets},analysis:{issues:report.issues,warnings:report.warnings,notes:report.notes},reality:window.PCBProReality?.lastEnvelope || null});
        if (answer) { addMessage('assistant',String(answer)); return; }
      } catch (_) {}
    }

    addMessage('assistant',`Gue sudah baca project aktif. Saat ini ada ${report.components.length} komponen dan ${report.nets.length} net. Gue bisa langsung: audit desain, ubah nilai komponen (contoh “ubah R2 jadi 1 kΩ”), tambah part, buka PCB/Schematic, atau jalankan Reality Lab. Untuk percakapan engineering bebas seperti LLM penuh, UI ini sudah punya provider hook—backend model tinggal disambungkan tanpa naruh API key di browser.`,[
      {label:'Audit desain sekarang',run:describeAudit},
      {label:'Run Reality Lab',run:runSimulation}
    ]);
  }

  function installStyles() {
    if (document.getElementById('pcbpro-jarvis-style')) return;
    const s=document.createElement('style');
    s.id='pcbpro-jarvis-style';
    s.textContent=`
      #pcbpro-jarvis{position:fixed;z-index:900;right:12px;bottom:12px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#dce8ef}.jarvis-launch{width:48px;height:48px;border:1px solid #2e7062;border-radius:14px;background:linear-gradient(145deg,#14342d,#0a1a20);color:#62dec5;box-shadow:0 16px 45px #000a;font-weight:900;letter-spacing:.08em}.jarvis-panel{width:min(470px,calc(100vw - 24px));height:min(760px,calc(100vh - 110px));min-width:350px;min-height:480px;resize:both;overflow:hidden;border:1px solid #294252;border-radius:13px;background:#08131cf5;box-shadow:0 25px 80px #000c;display:flex;flex-direction:column;backdrop-filter:blur(12px)}.jarvis-panel.hidden{display:none}.jarvis-head{height:48px;flex:0 0 48px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid #1d303d;background:#0b1721}.jarvis-id{display:flex;align-items:center;gap:8px}.jarvis-orb{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#77f5dc,#1aa58f 38%,#0c2a31 70%);box-shadow:0 0 18px #25c6aa66;color:#04211c;font-weight:950;font-size:9px}.jarvis-id b{display:block;font-size:10px}.jarvis-id small{display:block;font-size:6.5px;color:#5f7c90;margin-top:2px;letter-spacing:.08em}.jarvis-head button{border:1px solid #28404e;background:#0c1a24;color:#91a7b6;border-radius:6px;width:28px;height:28px}.jarvis-visual-wrap{height:180px;flex:0 0 180px;border-bottom:1px solid #1c2e3a;background:#071119;position:relative}.jarvis-visual{position:absolute;inset:0}.jarvis-visual svg{width:100%;height:100%;display:block}.jarvis-visual-title{position:absolute;z-index:2;left:9px;top:8px;color:#68879a;font:800 6.5px ui-monospace;letter-spacing:.12em}.jarvis-health{position:absolute;z-index:3;right:8px;top:7px;display:flex;align-items:center;gap:5px;padding:5px 7px;border:1px solid #233c49;border-radius:7px;background:#091821e8}.jarvis-health>span{width:6px;height:6px;border-radius:50%}.jarvis-health .good{background:#48d1ad}.jarvis-health .warn{background:#d4b251}.jarvis-health .bad{background:#e17363}.jarvis-health b{font-size:7px}.jarvis-health small{font-size:6px;color:#61798b}.jarvis-log{flex:1;min-height:0;overflow:auto;padding:10px 8px;scrollbar-width:thin}.jarvis-msg{display:grid;grid-template-columns:25px minmax(0,1fr);gap:7px;margin:7px 0}.jarvis-msg.user{grid-template-columns:minmax(0,1fr) 25px}.jarvis-msg.user .jarvis-avatar{grid-column:2}.jarvis-msg.user .jarvis-bubble{grid-column:1;grid-row:1;background:#11281f;border-color:#27594d}.jarvis-avatar{width:25px;height:25px;border-radius:7px;background:#102531;border:1px solid #285061;display:grid;place-items:center;color:#59d6be;font:900 7px ui-monospace}.jarvis-bubble{border:1px solid #223947;background:#0c1923;border-radius:9px;padding:8px}.jarvis-bubble p{margin:0;color:#acc0cc;font-size:8px;line-height:1.55}.jarvis-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.jarvis-actions button,.jarvis-chips button{border:1px solid #295348;background:#102b24;color:#64d6bd;border-radius:6px;padding:5px 7px;font-size:7px}.jarvis-chips{display:flex;gap:5px;overflow-x:auto;padding:7px 8px 0;scrollbar-width:none}.jarvis-input{flex:0 0 auto;border-top:1px solid #1b2d39;background:#09151e;padding:8px}.jarvis-compose{display:flex;gap:6px}.jarvis-compose textarea{flex:1;min-height:38px;max-height:92px;resize:vertical;border:1px solid #274150;background:#07121a;color:#d5e3eb;border-radius:8px;padding:8px;font-size:8px;outline:0}.jarvis-compose button{width:62px;border:1px solid #2aa991;background:#159b85;color:white;border-radius:8px;font-size:8px;font-weight:800}.jarvis-foot{display:flex;justify-content:space-between;margin-top:5px;color:#4f687b;font:6px ui-monospace}.jarvis-launch.hidden{display:none}@media(max-width:650px){#pcbpro-jarvis{right:6px;bottom:6px}.jarvis-panel{width:calc(100vw - 12px);height:calc(100vh - 90px);min-width:0;resize:none}.jarvis-visual-wrap{height:145px;flex-basis:145px}}
    `;
    document.head.appendChild(s);
  }

  function mount() {
    if (root) return;
    installStyles();
    root=document.createElement('div');
    root.id='pcbpro-jarvis';
    root.innerHTML=`
      <button class="jarvis-launch hidden" title="Open PCB Pro Assistant">AI</button>
      <section class="jarvis-panel">
        <div class="jarvis-head"><div class="jarvis-id"><div class="jarvis-orb">J</div><div><b>PCB Pro Copilot</b><small>CONTEXT-AWARE DESIGN ASSISTANT · v${VERSION}</small></div></div><button class="jarvis-close">×</button></div>
        <div class="jarvis-visual-wrap"><div class="jarvis-visual-title">LIVE DESIGN VIEW</div><div class="jarvis-health"></div><div class="jarvis-visual"></div></div>
        <div class="jarvis-chips"><button data-q="cek desain gue sekarang">Audit</button><button data-q="jalankan simulasi reality lab">Simulate</button><button data-q="perbaiki otomatis yang aman">Safe fix</button><button data-q="buka PCB">PCB</button></div>
        <div class="jarvis-log"></div>
        <div class="jarvis-input"><div class="jarvis-compose"><textarea placeholder="Contoh: cek desain gue, ubah R2 jadi 470 Ω, tambah capacitor, jalankan simulasi…"></textarea><button>Send</button></div><div class="jarvis-foot"><span>local reasoning + live project context</span><span>LLM provider-ready</span></div></div>
      </section>`;
    document.body.appendChild(root);

    const panel=root.querySelector('.jarvis-panel'), launch=root.querySelector('.jarvis-launch');
    root.querySelector('.jarvis-close').addEventListener('click',()=>{open=false;panel.classList.add('hidden');launch.classList.remove('hidden')});
    launch.addEventListener('click',()=>{open=true;panel.classList.remove('hidden');launch.classList.add('hidden');renderVisual()});
    root.querySelectorAll('.jarvis-chips button').forEach((b)=>b.addEventListener('click',()=>handle(b.dataset.q)));
    const ta=root.querySelector('textarea'), send=root.querySelector('.jarvis-compose button');
    const submit=()=>{const v=ta.value;ta.value='';handle(v)};
    send.addEventListener('click',submit);
    ta.addEventListener('keydown',(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}});

    addMessage('assistant','Gue sudah nyambung ke workspace aktif. Gue bisa baca komponen/net, bikin mini visual live, audit desain, ubah value, tambah part, pindah workspace, dan menjalankan Reality Lab dari chat. Coba bilang: “cek desain gue sekarang”.');
    renderVisual();

    const observer=new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(renderVisual,120)});
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style','class']});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();

  window.PCBProAssistant={
    version:VERSION,
    ask:handle,
    analyze,
    refresh:renderVisual,
    open(){root?.querySelector('.jarvis-launch')?.click()},
    get history(){return history.slice()}
  };
})();