(() => {
  'use strict';

  const VERSION = '0.5.0';
  let panel = null;
  let running = false;
  let timer = 0;
  let frame = 0;
  let fault = 'none';
  let lastResult = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function inferCode(name, id, symbol = '') {
    const text = `${name} ${symbol}`.toLowerCase();
    if (/dc source|voltage source/.test(text) || /^V\d+/i.test(id)) return 'V';
    if (/resistor/.test(text) || /^R\d+/i.test(id)) return 'R';
    if (/capacitor/.test(text) || /^C\d+/i.test(id)) return 'C';
    if (/inductor/.test(text) || /^L\d+/i.test(id)) return 'L';
    if (/led/.test(text)) return 'LED';
    if (/diode/.test(text) || /^D\d+/i.test(id)) return 'D';
    if (/mosfet/.test(text) || /^Q\d+/i.test(id)) return 'Q';
    if (/op-amp/.test(text) || /^U\d+/i.test(id)) return 'U';
    if (/switch/.test(text) || /^SW\d+/i.test(id)) return 'SW';
    if (/ground/.test(text) || /^G\d+/i.test(id)) return 'GND';
    return id.replace(/\d.*$/, '').toUpperCase() || '?';
  }

  function captureDesign() {
    const components = [...document.querySelectorAll('.node')].map((node) => {
      const id = node.querySelector('.ref')?.textContent?.trim() || '';
      const name = node.querySelector('small')?.textContent?.trim() || '';
      const value = node.querySelector('b')?.textContent?.trim() || '';
      const symbol = node.querySelector('.symbol')?.textContent?.trim() || '';
      return { id, name, value, code: inferCode(name, id, symbol) };
    }).filter((x) => x.id);

    const nets = [...document.querySelectorAll('.inspector .net')].map((button) => ({
      name: button.querySelector('b')?.textContent?.trim() || '',
      pins: button.querySelector('small')?.textContent?.trim() || ''
    })).filter((x) => x.name && x.pins);

    return { components, nets };
  }

  function fmt(v, unit = '') {
    if (!Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    const scales = [[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']];
    const [s,p] = scales.find(([x]) => a >= x * 0.999) || [1e-12,'p'];
    const n = v / s;
    const digits = Math.abs(n) >= 100 ? 1 : Math.abs(n) >= 10 ? 2 : 3;
    return `${n.toFixed(digits)} ${p}${unit}`.trim();
  }

  function parseNumber(raw) {
    const m = String(raw || '').replace(',', '.').match(/[-+]?\d*\.?\d+/);
    return m ? Number(m[0]) : NaN;
  }

  function applyFaults(components) {
    if (!fault || fault === 'none') return components.map((c) => ({...c}));
    const [mode, ref] = fault.split(':');
    return components.map((c) => {
      if (c.id !== ref) return {...c};
      if (mode === 'open') return {...c, code:'R', value:'1 TΩ', name:`${c.name} [OPEN FAULT]`};
      if (mode === 'short') return {...c, code:'R', value:'1 µΩ', name:`${c.name} [SHORT FAULT]`};
      if (mode === 'brownout' && c.code === 'V') {
        const nominal = parseNumber(c.value);
        return {...c, value:`${Number.isFinite(nominal) ? nominal * 0.7 : 0} V`, name:`${c.name} [70% BROWNOUT]`};
      }
      return {...c};
    });
  }

  function unsupported(components) {
    const supported = new Set(['V','R','C','L','SW','D','LED','GND','J','TP']);
    return components.filter((c) => !supported.has(c.code)).map((c) => `${c.id} (${c.code})`);
  }

  function faultOptions(components) {
    const rows = ['<option value="none">No fault</option>'];
    for (const c of components) {
      if (['R','C','L','SW','D','LED'].includes(c.code)) {
        rows.push(`<option value="open:${esc(c.id)}">OPEN · ${esc(c.id)}</option>`);
        rows.push(`<option value="short:${esc(c.id)}">SHORT · ${esc(c.id)}</option>`);
      }
      if (c.code === 'V') rows.push(`<option value="brownout:${esc(c.id)}">BROWNOUT 70% · ${esc(c.id)}</option>`);
    }
    return rows.join('');
  }

  function topologyHtml(nets) {
    return nets.map((n) => `<div class="ls-net"><b>${esc(n.name)}</b><span>${esc(n.pins)}</span></div>`).join('') || '<div class="ls-empty">No active netlist.</div>';
  }

  function renderResult(snapshot) {
    if (!panel || !snapshot) return;
    const { result, warnings, error } = snapshot;
    const status = panel.querySelector('.ls-status');
    const nodes = panel.querySelector('.ls-nodes');
    const devices = panel.querySelector('.ls-devices tbody');
    const frameEl = panel.querySelector('.ls-frame');
    if (frameEl) frameEl.textContent = `solve #${snapshot.frame}`;

    if (error) {
      status.className = 'ls-status error';
      status.textContent = `Solver stopped: ${error}`;
      nodes.innerHTML = '<div class="ls-empty">No valid electrical solution.</div>';
      devices.innerHTML = '';
      return;
    }

    status.className = warnings.length ? 'ls-status warn' : 'ls-status ok';
    status.textContent = warnings.length
      ? `Solved with limitations · ${warnings.join(' · ')}`
      : `Solved from active netlist · ${result.iterations} nonlinear iteration(s)`;

    nodes.innerHTML = Object.entries(result.nodeVoltages || {}).map(([name,voltage]) =>
      `<div class="ls-probe"><span>${esc(name)}</span><strong>${fmt(voltage,'V')}</strong></div>`
    ).join('') || '<div class="ls-empty">No node voltages.</div>';

    devices.innerHTML = Object.values(result.devices || {}).map((d) =>
      `<tr><th>${esc(d.id)}</th><td>${esc(d.name || d.code)}</td><td>${fmt(d.voltage,'V')}</td><td>${fmt(d.current,'A')}</td><td>${fmt(d.power,'W')}</td></tr>`
    ).join('');
  }

  function solveOnce() {
    if (!window.PCBProSimulation?.solveDc) {
      lastResult = { frame: ++frame, error:'DC solver is not loaded.', result:null, warnings:['solver unavailable'], fault };
      renderResult(lastResult);
      return lastResult;
    }

    const design = captureDesign();
    const warnings = [];
    const missing = unsupported(design.components);
    if (missing.length) warnings.push(`unsupported model: ${missing.join(', ')}`);
    if (!design.nets.length) warnings.push('netlist is empty');

    try {
      const solvedComponents = applyFaults(design.components);
      const result = window.PCBProSimulation.solveDc(solvedComponents, design.nets);
      warnings.push(...(result.warnings || []));
      lastResult = { frame: ++frame, result, warnings:[...new Set(warnings)], fault, design };
    } catch (error) {
      lastResult = { frame: ++frame, result:null, warnings:[...new Set(warnings)], error:error?.message || String(error), fault, design };
    }
    renderResult(lastResult);
    return lastResult;
  }

  function loop() {
    if (!running) return;
    solveOnce();
    timer = window.setTimeout(loop, 900);
  }

  function start() {
    if (running) return;
    running = true;
    updateControls();
    loop();
  }

  function pause() {
    running = false;
    if (timer) clearTimeout(timer);
    timer = 0;
    updateControls();
  }

  function reset() {
    pause();
    frame = 0;
    fault = 'none';
    const select = panel?.querySelector('.ls-fault');
    if (select) select.value = 'none';
    solveOnce();
  }

  function updateControls() {
    if (!panel) return;
    panel.querySelector('.ls-run')?.classList.toggle('active', running);
    const state = panel.querySelector('.ls-runstate');
    if (state) state.textContent = running ? 'RUNNING' : 'PAUSED';
  }

  function loadAdvancedReality() {
    pause();
    if (window.PCBProReality?.version && window.PCBProReality.version !== 'live-alias') {
      window.PCBProReality.rerun?.();
      return;
    }
    const script = document.createElement('script');
    script.src = '/reality-engine.js';
    script.async = true;
    script.onload = () => setTimeout(() => window.PCBProReality?.rerun?.(), 80);
    document.body.appendChild(script);
  }

  function installStyles() {
    if (document.getElementById('pcbpro-live-sim-style')) return;
    const s = document.createElement('style');
    s.id = 'pcbpro-live-sim-style';
    s.textContent = `
      .live-sim{padding:16px!important;overflow:auto!important;background:linear-gradient(155deg,#0b151e,#081018)!important;color:#dce8ee!important}
      .ls-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.ls-eyebrow{font:800 9px ui-monospace;color:#68d7c0;letter-spacing:.12em}.ls-head h2{font-size:24px;margin:4px 0 5px}.ls-head p{margin:0;color:#8ba0ad;max-width:760px;font-size:11px;line-height:1.55}.ls-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.ls-actions button,.ls-fault{border:1px solid #2e4654;background:#111e28;color:#c9d7de;border-radius:8px;padding:9px 11px;font-size:10px;font-weight:750}.ls-actions button:hover{border-color:#4f7b88}.ls-actions .ls-run.active{background:#176a59;border-color:#44d1b4;color:#fff}.ls-actions .ls-step{background:#133047}.ls-actions .ls-advanced{background:#2a2415;border-color:#665426;color:#e0c277}.ls-strip{display:flex;gap:8px;align-items:center;margin:12px 0}.ls-badge,.ls-runstate,.ls-frame{border:1px solid #29404d;background:#0e1a23;border-radius:7px;padding:7px 9px;font:800 9px ui-monospace}.ls-badge{color:#6ce0c7}.ls-runstate{color:#b8c8d1}.ls-frame{color:#7891a1}.ls-status{border:1px solid #2b4050;background:#0d1923;border-radius:8px;padding:10px 12px;font:10px ui-monospace;margin-bottom:10px}.ls-status.ok{border-color:#28614f;color:#63d9bb;background:#0c211b}.ls-status.warn{border-color:#5c4a24;color:#d6bd70;background:#211b10}.ls-status.error{border-color:#6b4036;color:#ec9d88;background:#281613}
      .ls-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:10px}.ls-card{border:1px solid #203644;background:#0d1821;border-radius:10px;overflow:hidden}.ls-title{padding:10px 12px;border-bottom:1px solid #20313d;color:#8096a4;font-size:9px;font-weight:800;letter-spacing:.08em}.ls-topology{padding:9px}.ls-net{display:flex;justify-content:space-between;gap:10px;padding:7px 8px;border-bottom:1px solid #172935}.ls-net b{font-size:10px;color:#69d7c0}.ls-net span{font:9px ui-monospace;color:#97aab5;text-align:right}.ls-nodes{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:7px;padding:9px}.ls-probe{border:1px solid #243b49;background:#0a141c;border-radius:8px;padding:9px}.ls-probe span{display:block;color:#7e95a4;font-size:9px}.ls-probe strong{display:block;margin-top:5px;font:800 15px ui-monospace;color:#e4edf2}.ls-table-wrap{overflow:auto}.ls-devices{width:100%;border-collapse:collapse}.ls-devices th,.ls-devices td{padding:8px 10px;border-bottom:1px solid #172935;font-size:9px;text-align:left}.ls-devices th{color:#6ed4be}.ls-devices td{color:#afc0ca}.ls-note{margin-top:10px;border:1px solid #2b3f4b;background:#0d171f;border-radius:8px;padding:10px;color:#7f96a4;font-size:9px;line-height:1.55}.ls-note b{color:#c9d7df}.ls-empty{padding:12px;color:#718794;font-size:9px}
      @media(max-width:900px){.ls-head{flex-direction:column}.ls-actions{justify-content:flex-start}.ls-grid{grid-template-columns:1fr}.ls-nodes{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function mount(target) {
    if (!target || target.dataset.liveSimMounted === '1') return;
    installStyles();
    const design = captureDesign();
    target.dataset.liveSimMounted = '1';
    target.classList.add('live-sim');
    target.innerHTML = `
      <div class="panel-title" style="display:none"><span>SIMULATION</span></div>
      <div class="ls-head">
        <div><div class="ls-eyebrow">LIVE CIRCUIT · PACKET-TRACER STYLE WORKFLOW</div><h2>Run, Pause, Solve Step, Inject Fault</h2><p>Primary simulation now works from the active project netlist. It shows the electrical state the built-in solver can actually calculate. Unsupported device models are flagged instead of faked.</p></div>
        <div class="ls-actions"><button class="ls-run">▶ Run</button><button class="ls-pause">Ⅱ Pause</button><button class="ls-step">Step solve</button><button class="ls-reset">Reset</button><select class="ls-fault">${faultOptions(design.components)}</select><button class="ls-advanced">Advanced field analysis</button></div>
      </div>
      <div class="ls-strip"><span class="ls-badge">LIVE SOLVER · v${VERSION}</span><span class="ls-runstate">PAUSED</span><span class="ls-frame">solve #0</span></div>
      <div class="ls-status">Ready. Press Run for continuous re-solve or Step for one real solver pass.</div>
      <div class="ls-grid">
        <section class="ls-card"><div class="ls-title">ACTIVE NETLIST / WIRING</div><div class="ls-topology">${topologyHtml(design.nets)}</div></section>
        <section class="ls-card"><div class="ls-title">LIVE PROBES · NODE VOLTAGE</div><div class="ls-nodes"></div></section>
      </div>
      <section class="ls-card" style="margin-top:10px"><div class="ls-title">DEVICE ELECTRICAL STATE</div><div class="ls-table-wrap"><table class="ls-devices"><thead><tr><th>Ref</th><th>Device</th><th>Voltage</th><th>Current</th><th>Power</th></tr></thead><tbody></tbody></table></div></section>
      <div class="ls-note"><b>Current kernel coverage:</b> DC source, resistor, capacitor-at-DC, inductor-at-DC, switch, diode and LED PWL models. MOSFET/op-amp/vendor nonlinear models are not silently approximated. Advanced Monte Carlo/thermal analysis is available separately and is not the primary live simulator.</div>`;

    panel = target;
    panel.querySelector('.ls-run').addEventListener('click', start);
    panel.querySelector('.ls-pause').addEventListener('click', pause);
    panel.querySelector('.ls-step').addEventListener('click', () => { pause(); solveOnce(); });
    panel.querySelector('.ls-reset').addEventListener('click', reset);
    panel.querySelector('.ls-fault').addEventListener('change', (e) => { fault = e.target.value || 'none'; solveOnce(); });
    panel.querySelector('.ls-advanced').addEventListener('click', loadAdvancedReality);
    solveOnce();
  }

  function scan() {
    const candidates = [...document.querySelectorAll('.panel')];
    for (const candidate of candidates) {
      if (candidate.dataset.liveSimMounted === '1') { panel = candidate; continue; }
      const title = candidate.querySelector('.panel-title span')?.textContent?.trim();
      if (/^SIMULATION$/i.test(title || '') || candidate.dataset.realSimMounted === '1') mount(candidate);
    }
  }

  function boot() {
    scan();
    let attempts = 0;
    const id = setInterval(() => {
      scan();
      attempts += 1;
      if (panel || attempts > 24) clearInterval(id);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.PCBProLiveSimulation = {
    version: VERSION,
    solveOnce,
    start,
    pause,
    reset,
    get running() { return running; },
    get lastResult() { return lastResult; },
    get fault() { return fault; }
  };

  // Compatibility alias for the older assistant action. It now starts the primary live solver,
  // not the Monte-Carlo field envelope.
  if (!window.PCBProReality) {
    window.PCBProReality = {
      version: 'live-alias',
      rerun: () => { if (!panel) scan(); start(); },
      get lastEnvelope() { return null; }
    };
  }
})();
