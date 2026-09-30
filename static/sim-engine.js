(() => {
  'use strict';

  const ENGINE_VERSION = '0.1.0';
  const STORAGE_KEYS = ['pcbpro0045-project-v11', 'pcbpro0045-project'];
  const DEFAULT_COMPONENTS = [
    { id: 'V1', code: 'V', name: 'DC Source', value: '5 V' },
    { id: 'R2', code: 'R', name: 'Resistor', value: '330 Ω' },
    { id: 'D3', code: 'LED', name: 'LED', value: 'Red 2 V' },
    { id: 'G4', code: 'GND', name: 'Ground', value: '0 V' }
  ];
  const DEFAULT_NETS = [
    { name: 'VCC', pins: 'V1.1 · R2.1' },
    { name: 'LED_A', pins: 'R2.2 · D3.1' },
    { name: 'GND', pins: 'D3.2 · V1.2' }
  ];

  let runtimeComponents = null;
  let runtimeNets = null;
  let mountedPanel = null;
  let lastResult = null;

  function parseEngineeringValue(raw) {
    if (typeof raw === 'number') return raw;
    const text = String(raw ?? '').trim().replace(',', '.').replace(/Ω/gi, '').replace(/ohms?/gi, '');
    const match = text.match(/([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnumkMGTµμ]?)/);
    if (!match) return NaN;
    const value = Number(match[1]);
    const prefix = match[2] || '';
    const multipliers = {
      p: 1e-12,
      n: 1e-9,
      u: 1e-6,
      µ: 1e-6,
      μ: 1e-6,
      m: 1e-3,
      k: 1e3,
      M: 1e6,
      G: 1e9,
      T: 1e12
    };
    return value * (multipliers[prefix] ?? 1);
  }

  function formatNumber(value, unit = '') {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    const scales = [
      [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']
    ];
    for (const [scale, prefix] of scales) {
      if (abs >= scale * 0.999 || scale === 1e-12) {
        const n = value / scale;
        const digits = Math.abs(n) >= 100 ? 1 : Math.abs(n) >= 10 ? 2 : 3;
        return `${n.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')} ${prefix}${unit}`.trim();
      }
    }
    return `${value} ${unit}`.trim();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizePins(pins) {
    if (Array.isArray(pins)) return pins.map(String);
    return String(pins ?? '')
      .split(/[·,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function captureFromDom() {
    const schematicNodes = [...document.querySelectorAll('.stage.schematic .node')];
    if (schematicNodes.length) {
      const parsed = schematicNodes.map((node) => {
        const id = node.querySelector('.ref')?.textContent?.trim() || '';
        const name = node.querySelector('small')?.textContent?.trim() || '';
        const value = node.querySelector('b')?.textContent?.trim() || '';
        let code = '';
        if (/ground/i.test(name)) code = 'GND';
        else if (/dc source/i.test(name)) code = 'V';
        else if (/resistor/i.test(name)) code = 'R';
        else if (/capacitor/i.test(name)) code = 'C';
        else if (/inductor/i.test(name)) code = 'L';
        else if (/led/i.test(name)) code = 'LED';
        else if (/diode/i.test(name)) code = 'D';
        else if (/mosfet/i.test(name)) code = 'Q';
        else if (/op-amp/i.test(name)) code = 'U';
        else if (/switch/i.test(name)) code = 'SW';
        else code = id.replace(/\d.*$/, '') || '?';
        return { id, code, name, value };
      }).filter((x) => x.id);
      if (parsed.length) runtimeComponents = parsed;
    }

    const netButtons = [...document.querySelectorAll('.inspector .net')];
    if (netButtons.length) {
      const parsed = netButtons.map((button) => ({
        name: button.querySelector('b')?.textContent?.trim() || '',
        pins: button.querySelector('small')?.textContent?.trim() || ''
      })).filter((x) => x.name && x.pins);
      if (parsed.length) runtimeNets = parsed;
    }
  }

  function loadComponents() {
    captureFromDom();
    if (runtimeComponents?.length) return structuredClone(runtimeComponents);
    for (const key of STORAGE_KEYS) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (Array.isArray(parsed?.components) && parsed.components.length) return parsed.components;
      } catch (_) {}
    }
    return structuredClone(DEFAULT_COMPONENTS);
  }

  function loadNets() {
    captureFromDom();
    return structuredClone(runtimeNets?.length ? runtimeNets : DEFAULT_NETS);
  }

  function buildPinMap(nets) {
    const pinToNet = new Map();
    for (const net of nets) {
      for (const pin of normalizePins(net.pins)) pinToNet.set(pin, net.name);
    }
    return pinToNet;
  }

  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
      }
      if (Math.abs(M[pivot][col]) < 1e-14) throw new Error('Singular circuit matrix: check floating nodes or missing ground.');
      if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
      const div = M[col][col];
      for (let j = col; j <= n; j++) M[col][j] /= div;
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = M[row][col];
        if (Math.abs(factor) < 1e-18) continue;
        for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j];
      }
    }
    return M.map((row) => row[n]);
  }

  function solveDc(components, nets, sourceOverrides = {}) {
    const pinToNet = buildPinMap(nets);
    const groundNames = new Set(['GND', '0', 'GND / 0']);
    const allNetNames = [...new Set(nets.map((n) => n.name))];
    let ground = allNetNames.find((name) => groundNames.has(name.toUpperCase?.() || name)) || allNetNames.find((name) => /(^|\W)(gnd|0)(\W|$)/i.test(name));
    if (!ground) throw new Error('No ground net found. Add a GND connection before simulation.');

    const nodes = allNetNames.filter((name) => name !== ground);
    const nodeIndex = new Map(nodes.map((name, i) => [name, i]));
    const sources = components.filter((c) => c.code === 'V' && pinToNet.has(`${c.id}.1`) && pinToNet.has(`${c.id}.2`));
    const sourceIndex = new Map(sources.map((s, i) => [s.id, i]));
    const N = nodes.length + sources.length;
    if (!N) throw new Error('Circuit has no solvable nodes.');

    const voltageAt = (solution, net) => net === ground ? 0 : solution[nodeIndex.get(net)];
    let diodeStates = new Map();
    let solution = new Array(N).fill(0);
    let iterations = 0;

    for (iterations = 0; iterations < 12; iterations++) {
      const A = Array.from({ length: N }, () => new Array(N).fill(0));
      const b = new Array(N).fill(0);
      const stampConductance = (na, nb, g) => {
        const ia = na === ground ? -1 : nodeIndex.get(na);
        const ib = nb === ground ? -1 : nodeIndex.get(nb);
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      const stampCurrent = (na, nb, currentAtoB) => {
        const ia = na === ground ? -1 : nodeIndex.get(na);
        const ib = nb === ground ? -1 : nodeIndex.get(nb);
        if (ia >= 0) b[ia] -= currentAtoB;
        if (ib >= 0) b[ib] += currentAtoB;
      };

      const unsupported = [];
      for (const c of components) {
        const n1 = pinToNet.get(`${c.id}.1`);
        const n2 = pinToNet.get(`${c.id}.2`);
        if (!n1 || !n2) continue;

        if (c.code === 'R') {
          const R = parseEngineeringValue(c.value);
          if (!Number.isFinite(R) || R <= 0) throw new Error(`${c.id}: invalid resistance '${c.value}'.`);
          stampConductance(n1, n2, 1 / R);
        } else if (c.code === 'L') {
          stampConductance(n1, n2, 1 / 1e-6);
        } else if (c.code === 'C') {
          stampConductance(n1, n2, 1e-12);
        } else if (c.code === 'SW') {
          const closed = /closed|on|1/i.test(String(c.value));
          stampConductance(n1, n2, closed ? 1e6 : 1e-12);
        } else if (c.code === 'D' || c.code === 'LED') {
          const prevV = voltageAt(solution, n1) - voltageAt(solution, n2);
          const model = c.code === 'LED' ? { vf: 1.8, rd: 20 } : { vf: 0.65, rd: 5 };
          const wasOn = diodeStates.get(c.id) ?? false;
          const on = prevV > model.vf - 0.03 || (wasOn && prevV > model.vf - 0.12);
          diodeStates.set(c.id, on);
          if (on) {
            const g = 1 / model.rd;
            stampConductance(n1, n2, g);
            stampCurrent(n1, n2, -g * model.vf);
          } else stampConductance(n1, n2, 1e-10);
        } else if (!['V', 'GND', 'J', 'TP'].includes(c.code)) unsupported.push(c.id);
      }

      for (const source of sources) {
        const nPlus = pinToNet.get(`${source.id}.1`);
        const nMinus = pinToNet.get(`${source.id}.2`);
        const row = nodes.length + sourceIndex.get(source.id);
        const ip = nPlus === ground ? -1 : nodeIndex.get(nPlus);
        const im = nMinus === ground ? -1 : nodeIndex.get(nMinus);
        if (ip >= 0) { A[ip][row] += 1; A[row][ip] += 1; }
        if (im >= 0) { A[im][row] -= 1; A[row][im] -= 1; }
        const nominal = parseEngineeringValue(source.value);
        b[row] = Number.isFinite(sourceOverrides[source.id]) ? sourceOverrides[source.id] : nominal;
      }

      const next = solveLinear(A, b);
      const delta = Math.max(...next.map((v, i) => Math.abs(v - solution[i])));
      solution = next;
      if (delta < 1e-8 && iterations > 0) break;
    }

    const nodeVoltages = { [ground]: 0 };
    for (const node of nodes) nodeVoltages[node] = solution[nodeIndex.get(node)];
    const devices = {};
    const warnings = [];

    for (const c of components) {
      const n1 = pinToNet.get(`${c.id}.1`);
      const n2 = pinToNet.get(`${c.id}.2`);
      if (!n1 || !n2) {
        if (!['GND', 'J', 'TP'].includes(c.code)) warnings.push(`${c.id} is not connected to two nets.`);
        continue;
      }
      const v1 = nodeVoltages[n1] ?? 0;
      const v2 = nodeVoltages[n2] ?? 0;
      const voltage = v1 - v2;
      let current = NaN;
      if (c.code === 'R') current = voltage / parseEngineeringValue(c.value);
      else if (c.code === 'L') current = voltage / 1e-6;
      else if (c.code === 'C') current = 0;
      else if (c.code === 'SW') current = /closed|on|1/i.test(String(c.value)) ? voltage * 1e6 : 0;
      else if (c.code === 'D' || c.code === 'LED') {
        const model = c.code === 'LED' ? { vf: 1.8, rd: 20 } : { vf: 0.65, rd: 5 };
        current = diodeStates.get(c.id) ? Math.max(0, (voltage - model.vf) / model.rd) : 0;
      } else if (c.code === 'V') {
        const idx = sourceIndex.get(c.id);
        current = Number.isFinite(idx) ? solution[nodes.length + idx] : NaN;
      }
      devices[c.id] = {
        id: c.id,
        code: c.code,
        name: c.name,
        value: c.value,
        n1,
        n2,
        voltage,
        current,
        power: Number.isFinite(current) ? voltage * current : NaN
      };
    }

    return {
      nodeVoltages,
      devices,
      ground,
      iterations: iterations + 1,
      warnings: [...new Set(warnings)]
    };
  }

  function runSweep(components, nets, points = 41) {
    const source = components.find((c) => c.code === 'V');
    if (!source) return [];
    const nominal = parseEngineeringValue(source.value);
    if (!Number.isFinite(nominal)) return [];
    const rows = [];
    for (let i = 0; i < points; i++) {
      const value = nominal * i / (points - 1);
      try {
        const result = solveDc(components, nets, { [source.id]: value });
        const nonGroundNodes = Object.keys(result.nodeVoltages).filter((n) => n !== result.ground);
        const observed = nonGroundNodes.find((n) => /led/i.test(n)) || nonGroundNodes.at(-1) || result.ground;
        rows.push({
          source: value,
          nodeName: observed,
          nodeVoltage: result.nodeVoltages[observed] ?? 0,
          sourceCurrent: result.devices[source.id]?.current ?? 0
        });
      } catch (_) {}
    }
    return rows;
  }

  function metricCards(result) {
    const nodes = Object.entries(result.nodeVoltages).filter(([name]) => name !== result.ground);
    const resistor = Object.values(result.devices).find((d) => d.code === 'R');
    const diode = Object.values(result.devices).find((d) => d.code === 'LED' || d.code === 'D');
    const source = Object.values(result.devices).find((d) => d.code === 'V');
    const cards = [];
    if (source) cards.push({ label: `V(${source.id})`, value: formatNumber(source.voltage, 'V'), sub: `${source.n1} → ${source.n2}` });
    if (resistor) cards.push({ label: `I(${resistor.id})`, value: formatNumber(resistor.current, 'A'), sub: `Calculated from ${resistor.value}` });
    if (resistor) cards.push({ label: `P(${resistor.id})`, value: formatNumber(resistor.power, 'W'), sub: 'V × I' });
    if (diode) cards.push({ label: `V(${diode.id})`, value: formatNumber(diode.voltage, 'V'), sub: `${diode.code === 'LED' ? 'LED' : 'Diode'} PWL model` });
    while (cards.length < 4 && nodes.length) {
      const [name, value] = nodes[cards.length % nodes.length];
      cards.push({ label: `V(${name})`, value: formatNumber(value, 'V'), sub: 'Solved node voltage' });
    }
    return cards.slice(0, 4);
  }

  function buildPlot(sweep) {
    if (!sweep.length) return '<div class="sim-empty">No sweep data.</div>';
    const W = 900, H = 250, pad = 34;
    const maxX = Math.max(...sweep.map((p) => p.source), 1e-9);
    const maxY = Math.max(...sweep.map((p) => p.nodeVoltage), 1e-9);
    const currentAbs = Math.max(...sweep.map((p) => Math.abs(p.sourceCurrent)), 1e-12);
    const x = (v) => pad + (v / maxX) * (W - pad * 2);
    const yV = (v) => H - pad - (v / maxY) * (H - pad * 2);
    const yI = (v) => H - pad - (Math.abs(v) / currentAbs) * (H - pad * 2);
    const volts = sweep.map((p, i) => `${i ? 'L' : 'M'}${x(p.source).toFixed(1)},${yV(p.nodeVoltage).toFixed(1)}`).join(' ');
    const amps = sweep.map((p, i) => `${i ? 'L' : 'M'}${x(p.source).toFixed(1)},${yI(p.sourceCurrent).toFixed(1)}`).join(' ');
    const observed = escapeHtml(sweep[0].nodeName || 'node');
    return `
      <div class="sim-plot-head"><span>DC Sweep · 0 → ${formatNumber(maxX, 'V')}</span><div><i></i>V(${observed}) <i class="i"></i>|I(source)|</div></div>
      <svg class="sim-plot-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="DC sweep plot">
        <g class="sim-grid">${[0,1,2,3,4,5].map((n)=>`<line x1="${pad}" y1="${pad+n*(H-pad*2)/5}" x2="${W-pad}" y2="${pad+n*(H-pad*2)/5}"/><line x1="${pad+n*(W-pad*2)/5}" y1="${pad}" x2="${pad+n*(W-pad*2)/5}" y2="${H-pad}"/>`).join('')}</g>
        <path class="sim-v" d="${volts}"/><path class="sim-i" d="${amps}"/>
      </svg>`;
  }

  function renderResult(panel, result, sweep, elapsedMs) {
    const cards = metricCards(result);
    const deviceRows = Object.values(result.devices).filter((d) => !['GND','J','TP'].includes(d.code));
    panel.querySelector('.sim-results').innerHTML = `
      <div class="sim-metrics">${cards.map((c)=>`<article><span>${escapeHtml(c.label)}</span><strong>${escapeHtml(c.value)}</strong><small>${escapeHtml(c.sub)}</small></article>`).join('')}</div>
      <div class="sim-plot">${buildPlot(sweep)}</div>
      <div class="sim-lower">
        <section><div class="sim-section-title">NODE VOLTAGES <b>${Object.keys(result.nodeVoltages).length}</b></div><div class="sim-table-wrap"><table><thead><tr><th>Node</th><th>Voltage</th></tr></thead><tbody>${Object.entries(result.nodeVoltages).map(([n,v])=>`<tr><td>${escapeHtml(n)}</td><td>${escapeHtml(formatNumber(v,'V'))}</td></tr>`).join('')}</tbody></table></div></section>
        <section><div class="sim-section-title">DEVICE RESULTS <b>${deviceRows.length}</b></div><div class="sim-table-wrap"><table><thead><tr><th>Ref</th><th>V</th><th>I</th><th>P</th></tr></thead><tbody>${deviceRows.map((d)=>`<tr><td>${escapeHtml(d.id)}</td><td>${escapeHtml(formatNumber(d.voltage,'V'))}</td><td>${escapeHtml(formatNumber(d.current,'A'))}</td><td>${escapeHtml(formatNumber(d.power,'W'))}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      ${result.warnings.length ? `<div class="sim-warning"><b>Warnings</b>${result.warnings.map((w)=>`<span>${escapeHtml(w)}</span>`).join('')}</div>` : ''}`;
    const status = panel.querySelector('.sim-status');
    status.className = 'sim-status ok';
    status.textContent = `Solved · ${result.iterations} iterations · ${elapsedMs.toFixed(1)} ms`;
  }

  function run(panel) {
    const button = panel.querySelector('.sim-run');
    const status = panel.querySelector('.sim-status');
    button.disabled = true;
    button.textContent = 'Solving…';
    status.className = 'sim-status';
    status.textContent = 'Building netlist and solving MNA…';
    requestAnimationFrame(() => {
      const t0 = performance.now();
      try {
        const components = loadComponents();
        const nets = loadNets();
        const result = solveDc(components, nets);
        const sweep = runSweep(components, nets, 51);
        lastResult = result;
        renderResult(panel, result, sweep, performance.now() - t0);
      } catch (error) {
        status.className = 'sim-status error';
        status.textContent = error?.message || 'Simulation failed.';
        panel.querySelector('.sim-results').innerHTML = `<div class="sim-error"><b>Solver error</b><span>${escapeHtml(error?.message || error)}</span><small>Check ground, net connectivity, and component values.</small></div>`;
      } finally {
        button.disabled = false;
        button.textContent = '▶ Run analysis';
      }
    });
  }

  function installStyles() {
    if (document.getElementById('pcbpro-sim-engine-style')) return;
    const style = document.createElement('style');
    style.id = 'pcbpro-sim-engine-style';
    style.textContent = `
      .sim-pro{padding:16px!important;background:linear-gradient(155deg,#0b151f,#071018)!important;overflow:auto!important}
      .sim-pro-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px}.sim-pro-head .eyebrow{font:800 7px ui-monospace;letter-spacing:.14em;color:#5f788c}.sim-pro-head h2{font-size:20px;margin:4px 0 3px}.sim-pro-head p{margin:0;color:#6b8092;font-size:8px;max-width:620px;line-height:1.5}.sim-controls{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.sim-engine-badge{border:1px solid #2e6356;background:#0c241e;color:#61d6b8;border-radius:6px;padding:6px 8px;font:750 7px ui-monospace;white-space:nowrap}.sim-run{border:1px solid #32b8a1;background:#159b86;color:white;border-radius:7px;padding:8px 11px;font-size:8px;font-weight:800}.sim-run:disabled{opacity:.55}.sim-status{border:1px solid #2b3f50;background:#0c1721;color:#7f95a7;border-radius:7px;padding:8px 10px;margin-bottom:10px;font:7px ui-monospace}.sim-status.ok{border-color:#28584c;color:#5ed1b4;background:#0b211c}.sim-status.error{border-color:#664137;color:#e69682;background:#281714}.sim-metrics{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:8px}.sim-metrics article{border:1px solid #203443;background:#0d1a24;border-radius:9px;padding:11px}.sim-metrics span{font-size:7px;color:#71889b}.sim-metrics strong{display:block;margin:7px 0 4px;font:800 18px ui-monospace;color:#e0ebf2}.sim-metrics small{font-size:6.5px;color:#5f7689}.sim-plot{margin-top:9px;border:1px solid #1f3241;border-radius:9px;background:#071119;overflow:hidden}.sim-plot-head{height:34px;border-bottom:1px solid #1c2d3a;display:flex;align-items:center;justify-content:space-between;padding:0 10px;color:#71889b;font-size:7px}.sim-plot-head div{display:flex;align-items:center;gap:5px}.sim-plot-head i{width:10px;height:2px;background:#47dfc7}.sim-plot-head i.i{background:#a87af4;margin-left:6px}.sim-plot-svg{display:block;width:100%;height:230px}.sim-grid line{stroke:#132532;stroke-width:1}.sim-v,.sim-i{fill:none;stroke-width:2}.sim-v{stroke:#47dfc7}.sim-i{stroke:#a87af4}.sim-lower{display:grid;grid-template-columns:1fr 1.6fr;gap:8px;margin-top:8px}.sim-lower section{border:1px solid #203342;background:#0b1721;border-radius:9px;overflow:hidden}.sim-section-title{height:31px;display:flex;align-items:center;justify-content:space-between;padding:0 9px;font-size:7px;letter-spacing:.1em;color:#688196;border-bottom:1px solid #1b2b39}.sim-section-title b{font:800 7px ui-monospace;color:#50d2b8}.sim-table-wrap{overflow:auto;max-height:190px}.sim-table-wrap table{width:100%;border-collapse:collapse;font-size:7px}.sim-table-wrap th,.sim-table-wrap td{padding:7px 9px;text-align:left;border-bottom:1px solid #172733;white-space:nowrap}.sim-table-wrap th{color:#5d7588;background:#0d1923;position:sticky;top:0}.sim-table-wrap td{color:#a8bac8;font-family:ui-monospace,monospace}.sim-warning,.sim-error{margin-top:8px;border:1px solid #5b4825;background:#241e10;color:#d7b65d;border-radius:8px;padding:9px;font-size:7px;display:grid;gap:4px}.sim-error{border-color:#603c34;background:#261613;color:#e28c79}.sim-warning b,.sim-error b{font-size:8px}.sim-error small{color:#8e6d66}.sim-empty{height:180px;display:grid;place-items:center;color:#5c7387;font-size:8px}
      @media(max-width:1050px){.sim-metrics{grid-template-columns:repeat(2,1fr)}.sim-lower{grid-template-columns:1fr}.sim-pro-head{flex-direction:column}.sim-controls{justify-content:flex-start}}
      @media(max-width:650px){.sim-metrics{grid-template-columns:1fr}.sim-plot-svg{height:190px}}
    `;
    document.head.appendChild(style);
  }

  function mount(panel) {
    if (!panel || panel.dataset.realSimMounted === '1') return;
    const title = panel.querySelector('.panel-title span')?.textContent?.trim();
    if (title !== 'SIMULATION') return;
    installStyles();
    captureFromDom();
    panel.dataset.realSimMounted = '1';
    panel.classList.add('sim-pro');
    panel.innerHTML = `
      <div class="sim-pro-head">
        <div><div class="eyebrow">DC CIRCUIT ANALYSIS</div><h2>Operating Point + Source Sweep</h2><p>Calculated from the project component values and net connectivity. Browser MNA solver with piecewise-linear diode/LED models — no hardcoded measurement cards.</p></div>
        <div class="sim-controls"><span class="sim-engine-badge">MNA ENGINE · v${ENGINE_VERSION}</span><button class="sim-run">▶ Run analysis</button></div>
      </div>
      <div class="sim-status">Ready · reading project netlist…</div>
      <div class="sim-results"></div>`;
    panel.querySelector('.sim-run').addEventListener('click', () => run(panel));
    mountedPanel = panel;
    run(panel);
  }

  function scan() {
    captureFromDom();
    const panels = [...document.querySelectorAll('.panel')];
    for (const panel of panels) mount(panel);
  }

  const observer = new MutationObserver(() => scan());
  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    scan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.PCBProSimulation = {
    version: ENGINE_VERSION,
    parseEngineeringValue,
    solveDc,
    runSweep,
    rerun() { if (mountedPanel?.isConnected) run(mountedPanel); },
    get lastResult() { return lastResult; }
  };
})();
