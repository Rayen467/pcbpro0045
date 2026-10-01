(() => {
  'use strict';

  const ENGINE_VERSION = '0.2.0';
  const STORAGE_KEYS = ['pcbpro0045-project-v11', 'pcbpro0045-project'];
  const DEFAULT_NETS = [
    { name: 'VCC', pins: 'V1.1 · R2.1' },
    { name: 'LED_A', pins: 'R2.2 · D3.1' },
    { name: 'GND', pins: 'D3.2 · V1.2' }
  ];

  let runtimeComponents = null;
  let runtimeNets = null;
  let mountedPanel = null;
  let lastEnvelope = null;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  }

  function parseEng(raw) {
    if (typeof raw === 'number') return raw;
    const text = String(raw ?? '').trim().replace(',', '.').replace(/Ω/gi, '').replace(/ohms?/gi, '');
    const match = text.match(/([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnumkMGTµμ]?)/);
    if (!match) return NaN;
    const mult = { p:1e-12, n:1e-9, u:1e-6, 'µ':1e-6, 'μ':1e-6, m:1e-3, '':1, k:1e3, M:1e6, G:1e9, T:1e12 };
    return Number(match[1]) * (mult[match[2] || ''] ?? 1);
  }

  function fmt(value, unit = '') {
    if (!Number.isFinite(value)) return '—';
    const a = Math.abs(value);
    const options = [
      [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']
    ];
    const selected = options.find(([scale]) => a >= scale) || [1e-12, 'p'];
    const scaled = value / selected[0];
    const digits = Math.abs(scaled) >= 100 ? 1 : Math.abs(scaled) >= 10 ? 2 : 3;
    return `${scaled.toFixed(digits)} ${selected[1]}${unit}`.trim();
  }

  function inferCode(name, id, symbolText = '') {
    const n = `${name} ${symbolText}`.toLowerCase();
    if (/dc source|voltage source/.test(n) || /^V\d+/i.test(id)) return 'V';
    if (/resistor/.test(n) || /^R\d+/i.test(id)) return 'R';
    if (/capacitor/.test(n) || /^C\d+/i.test(id)) return 'C';
    if (/inductor/.test(n) || /^L\d+/i.test(id)) return 'L';
    if (/led/.test(n)) return 'LED';
    if (/diode/.test(n) || /^D\d+/i.test(id)) return 'D';
    if (/mosfet/.test(n) || /^Q\d+/i.test(id)) return 'Q';
    if (/op-amp/.test(n) || /^U\d+/i.test(id)) return 'U';
    if (/switch/.test(n) || /^SW\d+/i.test(id)) return 'SW';
    if (/ground/.test(n) || /^G\d+/i.test(id)) return 'GND';
    if (/connector/.test(n) || /^J\d+/i.test(id)) return 'J';
    if (/test point/.test(n) || /^TP\d+/i.test(id)) return 'TP';
    return id.replace(/\d.*$/, '').toUpperCase() || '?';
  }

  function captureFromDom() {
    const nodes = [...document.querySelectorAll('.node')];
    if (nodes.length) {
      const parsed = nodes.map((node) => {
        const id = node.querySelector('.ref')?.textContent?.trim() || '';
        const value = node.querySelector('b')?.textContent?.trim() || '';
        const name = node.querySelector('small')?.textContent?.trim() || '';
        const symbol = node.querySelector('.symbol')?.textContent?.trim() || '';
        return { id, code: inferCode(name, id, symbol), name, value };
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
        if (Array.isArray(parsed?.components) && parsed.components.length) {
          return parsed.components.map((c) => ({ ...c, code: c.code || inferCode(c.name, c.id) }));
        }
      } catch (_) {}
    }
    return [
      { id:'V1', code:'V', name:'DC Source', value:'5 V' },
      { id:'R2', code:'R', name:'Resistor', value:'330 Ω' },
      { id:'D3', code:'LED', name:'LED', value:'Red 2 V' },
      { id:'G4', code:'GND', name:'Ground', value:'0 V' }
    ];
  }

  function loadNets() {
    captureFromDom();
    return structuredClone(runtimeNets?.length ? runtimeNets : DEFAULT_NETS);
  }

  function normalizePins(raw) {
    return String(raw || '').split(/[·,;\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+\d+\.\d+$/.test(x));
  }

  function pinMap(nets) {
    const map = new Map();
    for (const net of nets) for (const pin of normalizePins(net.pins)) map.set(pin, net.name);
    return map;
  }

  function gaussian(rng) {
    let u = 0, v = 0;
    while (!u) u = rng();
    while (!v) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let pivot = col;
      for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row;
      if (Math.abs(M[pivot][col]) < 1e-14) throw new Error('Singular matrix: floating net, missing ground, or incompatible fault state.');
      if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];
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

  function modelDefaults(component) {
    const code = component.code;
    const fp = String(component.footprint || '').toUpperCase();
    if (code === 'R') return { tolerance: 0.01, tcr: 100e-6, theta: /0603/.test(fp) ? 220 : 160, maxPower: /0603/.test(fp) ? 0.10 : 0.125 };
    if (code === 'LED') return { vf: parseEng(component.value) || 1.95, vfSigma: 0.08, tempco: -0.0020, rd: 18, theta: 220, maxCurrent: 0.020 };
    if (code === 'D') return { vf: 0.68, vfSigma: 0.035, tempco: -0.0018, rd: 4, theta: 180, maxCurrent: 0.150 };
    if (code === 'L') return { dcr: 0.12, tolerance: 0.20, tcr: 3900e-6, theta: 140 };
    if (code === 'C') return { leakageR: 20e6, tolerance: 0.20, esr: 0.08, theta: 160 };
    if (code === 'V') return { tolerance: 0.02, sourceR: 0.10 };
    return {};
  }

  function applyFault(component, fault) {
    if (!fault || fault === 'none') return null;
    const [id, mode] = fault.split(':');
    return component.id === id ? mode : null;
  }

  function buildTrialModels(components, env, rng) {
    const models = new Map();
    for (const c of components) {
      const d = modelDefaults(c);
      const fault = applyFault(c, env.fault);
      if (c.code === 'R') {
        const nominal = parseEng(c.value);
        const tolerance = Number.isFinite(nominal) ? env.resTol : d.tolerance;
        models.set(c.id, { ...d, nominal, delta: (rng() * 2 - 1) * tolerance, fault });
      } else if (c.code === 'LED' || c.code === 'D') {
        models.set(c.id, { ...d, vfOffset: gaussian(rng) * d.vfSigma, fault });
      } else if (c.code === 'V') {
        models.set(c.id, { ...d, nominal: parseEng(c.value), delta: (rng() * 2 - 1) * env.sourceTol, sourceR: env.sourceR, fault });
      } else if (c.code === 'L') {
        models.set(c.id, { ...d, delta: (rng() * 2 - 1) * d.tolerance, fault });
      } else models.set(c.id, { ...d, fault });
    }
    return models;
  }

  function solveDc(components, nets, env, models, temperatures = new Map(), sourceDrop = new Map()) {
    const pmap = pinMap(nets);
    const allNets = [...new Set(nets.map((n) => n.name))];
    const ground = allNets.find((n) => /^(gnd|0|gnd\s*\/\s*0)$/i.test(n)) || allNets.find((n) => /gnd|ground/i.test(n));
    if (!ground) throw new Error('No GND net. Field simulation requires an explicit ground/reference node.');
    const nodes = allNets.filter((n) => n !== ground);
    const nodeIndex = new Map(nodes.map((n, i) => [n, i]));
    const sources = components.filter((c) => c.code === 'V' && pmap.has(`${c.id}.1`) && pmap.has(`${c.id}.2`));
    const sourceIndex = new Map(sources.map((s, i) => [s.id, i]));
    const N = nodes.length + sources.length;
    if (!N) throw new Error('No solvable electrical network.');

    const index = (net) => net === ground ? -1 : nodeIndex.get(net);
    const voltage = (solution, net) => net === ground ? 0 : solution[nodeIndex.get(net)] ?? 0;
    let solution = new Array(N).fill(0);
    let diodeStates = new Map();

    for (let iter = 0; iter < 18; iter++) {
      const A = Array.from({ length:N }, () => new Array(N).fill(0));
      const b = new Array(N).fill(0);
      const gStamp = (na, nb, g) => {
        const ia = index(na), ib = index(nb);
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      const iStamp = (na, nb, i) => {
        const ia = index(na), ib = index(nb);
        if (ia >= 0) b[ia] -= i;
        if (ib >= 0) b[ib] += i;
      };

      for (const c of components) {
        const n1 = pmap.get(`${c.id}.1`), n2 = pmap.get(`${c.id}.2`);
        if (!n1 || !n2) continue;
        const m = models.get(c.id) || modelDefaults(c);
        const temp = temperatures.get(c.id) ?? env.ambient;
        if (m.fault === 'open') { gStamp(n1, n2, 1e-12); continue; }
        if (m.fault === 'short') { gStamp(n1, n2, 1e8); continue; }

        if (c.code === 'R') {
          const base = m.nominal;
          const value = Math.max(1e-9, base * (1 + m.delta) * (1 + m.tcr * (temp - 25)));
          gStamp(n1, n2, 1 / value);
        } else if (c.code === 'L') {
          const dcr = Math.max(1e-6, m.dcr * (1 + m.delta) * (1 + m.tcr * (temp - 25)));
          gStamp(n1, n2, 1 / dcr);
        } else if (c.code === 'C') {
          gStamp(n1, n2, 1 / m.leakageR);
        } else if (c.code === 'SW') {
          const closed = /closed|on|1/i.test(String(c.value));
          gStamp(n1, n2, closed ? 1e8 : 1e-12);
        } else if (c.code === 'D' || c.code === 'LED') {
          const vf = Math.max(0.05, m.vf + m.vfOffset + m.tempco * (temp - 25));
          const prev = voltage(solution, n1) - voltage(solution, n2);
          const wasOn = diodeStates.get(c.id) ?? false;
          const on = prev > vf - 0.025 || (wasOn && prev > vf - 0.12);
          diodeStates.set(c.id, on);
          if (on) {
            const g = 1 / m.rd;
            gStamp(n1, n2, g);
            iStamp(n1, n2, -g * vf);
          } else gStamp(n1, n2, 1e-11);
        }
      }

      for (const s of sources) {
        const nPlus = pmap.get(`${s.id}.1`), nMinus = pmap.get(`${s.id}.2`);
        const row = nodes.length + sourceIndex.get(s.id);
        const ip = index(nPlus), im = index(nMinus);
        if (ip >= 0) { A[ip][row] += 1; A[row][ip] += 1; }
        if (im >= 0) { A[im][row] -= 1; A[row][im] -= 1; }
        const m = models.get(s.id);
        let v = m.nominal * (1 + m.delta);
        if (m.fault === 'brownout') v *= 0.72;
        if (m.fault === 'open') v = 0;
        v -= sourceDrop.get(s.id) || 0;
        b[row] = v;
      }

      const next = solveLinear(A, b);
      const delta = Math.max(...next.map((v, i) => Math.abs(v - solution[i])));
      solution = next;
      if (delta < 1e-9 && iter > 0) break;
    }

    const nodeVoltages = { [ground]:0 };
    for (const n of nodes) nodeVoltages[n] = voltage(solution, n);
    const devices = {};

    for (const c of components) {
      const n1 = pmap.get(`${c.id}.1`), n2 = pmap.get(`${c.id}.2`);
      if (!n1 || !n2) continue;
      const m = models.get(c.id) || modelDefaults(c);
      const temp = temperatures.get(c.id) ?? env.ambient;
      const v = (nodeVoltages[n1] ?? 0) - (nodeVoltages[n2] ?? 0);
      let i = NaN;
      if (m.fault === 'open') i = 0;
      else if (m.fault === 'short') i = v * 1e8;
      else if (c.code === 'R') {
        const r = Math.max(1e-9, m.nominal * (1 + m.delta) * (1 + m.tcr * (temp - 25)));
        i = v / r;
      } else if (c.code === 'L') {
        const r = Math.max(1e-6, m.dcr * (1 + m.delta) * (1 + m.tcr * (temp - 25)));
        i = v / r;
      } else if (c.code === 'C') i = v / m.leakageR;
      else if (c.code === 'SW') i = /closed|on|1/i.test(String(c.value)) ? v * 1e8 : 0;
      else if (c.code === 'D' || c.code === 'LED') {
        const vf = Math.max(0.05, m.vf + m.vfOffset + m.tempco * (temp - 25));
        i = diodeStates.get(c.id) ? Math.max(0, (v - vf) / m.rd) : 0;
      } else if (c.code === 'V') {
        const idx = sourceIndex.get(c.id);
        i = Number.isFinite(idx) ? solution[nodes.length + idx] : NaN;
      }
      devices[c.id] = { ...c, n1, n2, voltage:v, current:i, power:Number.isFinite(i) ? v * i : NaN, temperature:temp };
    }

    return { ground, nodeVoltages, devices };
  }

  function solveElectroThermal(components, nets, env, models) {
    let temperatures = new Map(components.map((c) => [c.id, env.ambient]));
    let sourceDrop = new Map();
    let result = null;
    for (let outer = 0; outer < 8; outer++) {
      result = solveDc(components, nets, env, models, temperatures, sourceDrop);
      const nextTemps = new Map(temperatures);
      for (const c of components) {
        const m = models.get(c.id) || modelDefaults(c);
        const dev = result.devices[c.id];
        if (!dev || !Number.isFinite(dev.power) || !Number.isFinite(m.theta)) continue;
        const target = env.ambient + Math.min(220, Math.abs(dev.power) * m.theta);
        nextTemps.set(c.id, 0.55 * (temperatures.get(c.id) ?? env.ambient) + 0.45 * target);
      }
      const nextDrop = new Map();
      for (const c of components.filter((x) => x.code === 'V')) {
        const m = models.get(c.id);
        const current = Math.abs(result.devices[c.id]?.current || 0);
        nextDrop.set(c.id, current * (m.sourceR + env.traceR));
      }
      temperatures = nextTemps;
      sourceDrop = nextDrop;
    }
    result = solveDc(components, nets, env, models, temperatures, sourceDrop);
    for (const [id, temp] of temperatures) if (result.devices[id]) result.devices[id].temperature = temp;
    result.sourceDrop = Object.fromEntries(sourceDrop);
    return result;
  }

  function trialSummary(result, models) {
    const led = Object.values(result.devices).find((d) => d.code === 'LED' || d.code === 'D');
    const resistor = Object.values(result.devices).find((d) => d.code === 'R');
    const source = Object.values(result.devices).find((d) => d.code === 'V');
    const maxTemp = Math.max(...Object.values(result.devices).map((d) => d.temperature || 0), 0);
    const ledLimit = led ? (models.get(led.id)?.maxCurrent || Infinity) : Infinity;
    const rLimit = resistor ? (models.get(resistor.id)?.maxPower || Infinity) : Infinity;
    const failReasons = [];
    if (led && Math.abs(led.current) > ledLimit) failReasons.push(`${led.id} over-current`);
    if (resistor && Math.abs(resistor.power) > rLimit) failReasons.push(`${resistor.id} over-power`);
    if (maxTemp > 125) failReasons.push('component temperature >125°C');
    return {
      ledCurrent: Math.abs(led?.current ?? NaN),
      ledVoltage: led?.voltage ?? NaN,
      resistorPower: Math.abs(resistor?.power ?? NaN),
      sourceVoltage: source?.voltage ?? NaN,
      sourceCurrent: Math.abs(source?.current ?? NaN),
      maxTemp,
      failReasons
    };
  }

  function percentile(values, q) {
    const clean = values.filter(Number.isFinite).sort((a,b)=>a-b);
    if (!clean.length) return NaN;
    const pos = (clean.length - 1) * q;
    const base = Math.floor(pos), rest = pos - base;
    return clean[base + 1] !== undefined ? clean[base] + rest * (clean[base + 1] - clean[base]) : clean[base];
  }

  function runEnvelope(components, nets, env) {
    const rng = mulberry32(env.seed);
    const rows = [];
    const failures = new Map();
    for (let i = 0; i < env.trials; i++) {
      try {
        const models = buildTrialModels(components, env, rng);
        const result = solveElectroThermal(components, nets, env, models);
        const s = trialSummary(result, models);
        rows.push({ ...s, result });
        for (const reason of s.failReasons) failures.set(reason, (failures.get(reason) || 0) + 1);
      } catch (error) {
        failures.set(error?.message || 'solver error', (failures.get(error?.message || 'solver error') || 0) + 1);
      }
    }
    const metric = (key) => rows.map((r) => r[key]).filter(Number.isFinite);
    return {
      rows,
      failures,
      successful: rows.length,
      failed: env.trials - rows.length,
      ledCurrent: { p05:percentile(metric('ledCurrent'),.05), p50:percentile(metric('ledCurrent'),.5), p95:percentile(metric('ledCurrent'),.95) },
      ledVoltage: { p05:percentile(metric('ledVoltage'),.05), p50:percentile(metric('ledVoltage'),.5), p95:percentile(metric('ledVoltage'),.95) },
      resistorPower: { p05:percentile(metric('resistorPower'),.05), p50:percentile(metric('resistorPower'),.5), p95:percentile(metric('resistorPower'),.95) },
      maxTemp: { p05:percentile(metric('maxTemp'),.05), p50:percentile(metric('maxTemp'),.5), p95:percentile(metric('maxTemp'),.95) },
      sourceVoltage: { p05:percentile(metric('sourceVoltage'),.05), p50:percentile(metric('sourceVoltage'),.5), p95:percentile(metric('sourceVoltage'),.95) }
    };
  }

  function histogram(values, bins = 22) {
    const clean = values.filter(Number.isFinite);
    if (!clean.length) return [];
    const min = Math.min(...clean), max = Math.max(...clean);
    if (Math.abs(max - min) < 1e-15) return [{ x:min, count:clean.length }];
    const counts = new Array(bins).fill(0);
    for (const v of clean) counts[Math.min(bins - 1, Math.floor((v - min) / (max - min) * bins))]++;
    return counts.map((count, i) => ({ x:min + (i + .5) * (max-min)/bins, count }));
  }

  function histogramSvg(values) {
    const bins = histogram(values, 24);
    if (!bins.length) return '<div class="reality-empty">No distribution data.</div>';
    const W = 900, H = 230, pad = 32;
    const maxCount = Math.max(...bins.map((b)=>b.count), 1);
    const barW = (W - pad*2) / bins.length;
    return `<svg class="reality-hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <g class="rh-grid">${[0,1,2,3,4].map((n)=>`<line x1="${pad}" y1="${pad+n*(H-pad*2)/4}" x2="${W-pad}" y2="${pad+n*(H-pad*2)/4}"/>`).join('')}</g>
      ${bins.map((b,i)=>{const h=(b.count/maxCount)*(H-pad*2);return `<rect x="${(pad+i*barW+2).toFixed(1)}" y="${(H-pad-h).toFixed(1)}" width="${Math.max(2,barW-4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`;}).join('')}
    </svg>`;
  }

  function readEnv(panel) {
    const num = (name, fallback) => {
      const v = Number(panel.querySelector(`[name="${name}"]`)?.value);
      return Number.isFinite(v) ? v : fallback;
    };
    return {
      trials: Math.max(50, Math.min(1500, Math.round(num('trials', 400)))),
      ambient: Math.max(-40, Math.min(125, num('ambient', 35))),
      resTol: Math.max(0, Math.min(.20, num('resTol', 1) / 100)),
      sourceTol: Math.max(0, Math.min(.20, num('sourceTol', 2) / 100)),
      sourceR: Math.max(0, num('sourceR', 100) / 1000),
      traceR: Math.max(0, num('traceR', 50) / 1000),
      fault: panel.querySelector('[name="fault"]')?.value || 'none',
      seed: Math.round(num('seed', 45)) || 45
    };
  }

  function faultOptions(components) {
    const candidates = components.filter((c) => ['R','LED','D','V'].includes(c.code));
    const rows = ['<option value="none">No injected fault</option>'];
    for (const c of candidates) {
      rows.push(`<option value="${escapeHtml(c.id)}:open">${escapeHtml(c.id)} open-circuit</option>`);
      rows.push(`<option value="${escapeHtml(c.id)}:short">${escapeHtml(c.id)} short-circuit</option>`);
      if (c.code === 'V') rows.push(`<option value="${escapeHtml(c.id)}:brownout">${escapeHtml(c.id)} brownout 72%</option>`);
    }
    return rows.join('');
  }

  function renderEnvelope(panel, envelope, env, elapsed) {
    const passRows = envelope.rows.filter((r) => !r.failReasons.length).length;
    const failChecks = envelope.rows.length - passRows;
    const successRate = envelope.rows.length ? (passRows / envelope.rows.length * 100) : 0;
    const iRows = envelope.rows.map((r) => r.ledCurrent);
    const failureRows = [...envelope.failures.entries()].sort((a,b)=>b[1]-a[1]);
    panel.querySelector('.reality-results').innerHTML = `
      <div class="reality-metrics">
        <article><span>LED CURRENT ENVELOPE · P05 / P50 / P95</span><strong>${fmt(envelope.ledCurrent.p05,'A')} · ${fmt(envelope.ledCurrent.p50,'A')} · ${fmt(envelope.ledCurrent.p95,'A')}</strong><small>component tolerance + temperature + supply/source impedance</small></article>
        <article><span>RESISTOR POWER · P95</span><strong>${fmt(envelope.resistorPower.p95,'W')}</strong><small>generic package limit checked against nominal footprint class</small></article>
        <article><span>HOTTEST COMPONENT · P95</span><strong>${Number.isFinite(envelope.maxTemp.p95) ? envelope.maxTemp.p95.toFixed(1)+' °C' : '—'}</strong><small>lumped θJA electro-thermal estimate</small></article>
        <article><span>FIELD MARGIN CHECKS</span><strong>${successRate.toFixed(1)}%</strong><small>${failChecks} of ${envelope.rows.length} solved trials crossed configured generic limits</small></article>
      </div>
      <div class="reality-chart"><div class="reality-chart-head"><span>Monte Carlo distribution · LED current</span><b>${env.trials} trials · ${elapsed.toFixed(1)} ms</b></div>${histogramSvg(iRows)}<div class="reality-axis"><span>P05 ${fmt(envelope.ledCurrent.p05,'A')}</span><span>Median ${fmt(envelope.ledCurrent.p50,'A')}</span><span>P95 ${fmt(envelope.ledCurrent.p95,'A')}</span></div></div>
      <div class="reality-grid2">
        <section><div class="reality-section-title">PREDICTION ENVELOPE</div><table><tbody>
          <tr><th>LED voltage</th><td>${fmt(envelope.ledVoltage.p05,'V')}</td><td>${fmt(envelope.ledVoltage.p50,'V')}</td><td>${fmt(envelope.ledVoltage.p95,'V')}</td></tr>
          <tr><th>Source loaded voltage</th><td>${fmt(envelope.sourceVoltage.p05,'V')}</td><td>${fmt(envelope.sourceVoltage.p50,'V')}</td><td>${fmt(envelope.sourceVoltage.p95,'V')}</td></tr>
          <tr><th>Resistor power</th><td>${fmt(envelope.resistorPower.p05,'W')}</td><td>${fmt(envelope.resistorPower.p50,'W')}</td><td>${fmt(envelope.resistorPower.p95,'W')}</td></tr>
          <tr><th>Max temperature</th><td>${Number.isFinite(envelope.maxTemp.p05)?envelope.maxTemp.p05.toFixed(1)+'°C':'—'}</td><td>${Number.isFinite(envelope.maxTemp.p50)?envelope.maxTemp.p50.toFixed(1)+'°C':'—'}</td><td>${Number.isFinite(envelope.maxTemp.p95)?envelope.maxTemp.p95.toFixed(1)+'°C':'—'}</td></tr>
        </tbody><thead><tr><th>Metric</th><th>P05</th><th>P50</th><th>P95</th></tr></thead></table></section>
        <section><div class="reality-section-title">FAULT / LIMIT FINDINGS</div>${failureRows.length ? `<div class="findings">${failureRows.map(([name,count])=>`<div><b>${escapeHtml(name)}</b><span>${count} trials</span></div>`).join('')}</div>` : '<div class="reality-ok">No solver/limit findings in this envelope.</div>'}</section>
      </div>`;
    const status = panel.querySelector('.reality-status');
    status.className = 'reality-status ok';
    status.textContent = `Field envelope solved · ${envelope.successful}/${env.trials} numerical trials · seed ${env.seed}`;
  }

  function run(panel) {
    const button = panel.querySelector('.reality-run');
    const status = panel.querySelector('.reality-status');
    const results = panel.querySelector('.reality-results');
    button.disabled = true;
    button.textContent = 'Running envelope…';
    status.className = 'reality-status';
    status.textContent = 'Building field model: tolerances → electro-thermal iteration → source/trace droop → fault checks…';
    requestAnimationFrame(() => {
      const t0 = performance.now();
      try {
        const components = loadComponents();
        const nets = loadNets();
        const env = readEnv(panel);
        const envelope = runEnvelope(components, nets, env);
        lastEnvelope = { envelope, env, components, nets };
        renderEnvelope(panel, envelope, env, performance.now() - t0);
      } catch (error) {
        status.className = 'reality-status error';
        status.textContent = error?.message || 'Field simulation failed.';
        results.innerHTML = `<div class="reality-error"><b>Reality engine stopped</b><span>${escapeHtml(error?.message || error)}</span><small>Check ground/net connectivity and component values. A field model must fail loudly instead of fabricating results.</small></div>`;
      } finally {
        button.disabled = false;
        button.textContent = '▶ Run field envelope';
      }
    });
  }

  function exportSpice(panel) {
    const components = loadComponents();
    const nets = loadNets();
    const pmap = pinMap(nets);
    const lines = ['* PCB Pro 0045 Reality Lab export', '* Browser envelope model; replace generic models with vendor .model/.lib for sign-off'];
    for (const c of components) {
      const n1 = pmap.get(`${c.id}.1`) || 'NC1';
      const n2 = pmap.get(`${c.id}.2`) || 'NC2';
      if (c.code === 'R') lines.push(`${c.id} ${n1} ${n2} ${parseEng(c.value) || 1}`);
      else if (c.code === 'C') lines.push(`${c.id} ${n1} ${n2} ${parseEng(c.value) || 1e-6}`);
      else if (c.code === 'L') lines.push(`${c.id} ${n1} ${n2} ${parseEng(c.value) || 10e-6}`);
      else if (c.code === 'V') lines.push(`${c.id} ${n1} ${n2} DC ${parseEng(c.value) || 5}`);
      else if (c.code === 'D' || c.code === 'LED') lines.push(`${c.id} ${n1} ${n2} D_${c.code}`);
    }
    lines.push('.model D_D D(Is=2.52n N=1.752 Rs=0.568 Cjo=4p M=0.4 tt=4n)');
    lines.push('.model D_LED D(Is=1e-20 N=2 Rs=18 Cjo=25p)');
    lines.push('.op', '.end');
    const blob = new Blob([lines.join('\n')], { type:'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='pcbpro0045-reality.cir'; a.click(); URL.revokeObjectURL(url);
  }

  function installStyles() {
    if (document.getElementById('pcbpro-reality-style')) return;
    const style = document.createElement('style');
    style.id = 'pcbpro-reality-style';
    style.textContent = `
      .reality-lab{padding:15px!important;background:linear-gradient(155deg,#0a151f,#071018)!important;overflow:auto!important}.reality-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.reality-head .eyebrow{font:800 7px ui-monospace;letter-spacing:.14em;color:#5f7b90}.reality-head h2{margin:4px 0 4px;font-size:20px}.reality-head p{margin:0;max-width:720px;color:#6e8496;font-size:8px;line-height:1.55}.reality-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.reality-badge{border:1px solid #2f6858;background:#0c241e;color:#64d8ba;border-radius:6px;padding:6px 8px;font:800 7px ui-monospace}.reality-actions button{border:1px solid #2a4051;background:#0d1924;color:#a7bac7;border-radius:7px;padding:8px 10px;font-size:8px}.reality-actions .reality-run{background:#159b86;border-color:#35bea6;color:#fff;font-weight:800}.reality-actions button:disabled{opacity:.55}.reality-note{margin:9px 0;border:1px solid #554828;background:#221d11;color:#cdb975;border-radius:7px;padding:8px 9px;font-size:7px;line-height:1.5}.reality-config{display:grid;grid-template-columns:repeat(7,minmax(96px,1fr));gap:6px;margin-bottom:8px}.reality-config label{border:1px solid #203544;background:#0c1822;border-radius:7px;padding:7px}.reality-config span{display:block;color:#617c90;font-size:6.5px;margin-bottom:4px}.reality-config input,.reality-config select{width:100%;border:1px solid #2b4050;background:#07131d;color:#c9d7df;border-radius:5px;padding:6px;font-size:8px;outline:0}.reality-status{border:1px solid #2b4050;background:#0c1721;color:#8197a8;border-radius:7px;padding:8px 10px;margin-bottom:8px;font:7px ui-monospace}.reality-status.ok{border-color:#2a5e50;background:#0b211c;color:#5fd1b4}.reality-status.error{border-color:#6a4038;background:#281714;color:#e99a84}.reality-metrics{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:7px}.reality-metrics article{border:1px solid #203544;background:#0c1923;border-radius:9px;padding:10px}.reality-metrics span{font-size:6.5px;color:#667f92}.reality-metrics strong{display:block;margin:7px 0 4px;font:800 13px ui-monospace;color:#e0ebf1;line-height:1.35}.reality-metrics small{font-size:6.3px;color:#60788a;line-height:1.4}.reality-chart{margin-top:8px;border:1px solid #203342;background:#071119;border-radius:9px;overflow:hidden}.reality-chart-head{height:33px;border-bottom:1px solid #1b2d3b;display:flex;align-items:center;justify-content:space-between;padding:0 9px;color:#6f8799;font-size:7px}.reality-chart-head b{font:700 7px ui-monospace;color:#52cdb5}.reality-hist{display:block;width:100%;height:210px}.reality-hist rect{fill:#3fcdb5;opacity:.75}.rh-grid line{stroke:#142631;stroke-width:1}.reality-axis{display:flex;justify-content:space-between;padding:0 10px 8px;color:#668093;font:7px ui-monospace}.reality-grid2{display:grid;grid-template-columns:1.25fr .75fr;gap:8px;margin-top:8px}.reality-grid2 section{border:1px solid #203442;background:#0b1721;border-radius:9px;overflow:hidden}.reality-section-title{padding:9px;border-bottom:1px solid #1b2d3a;color:#698397;font-size:7px;letter-spacing:.1em}.reality-grid2 table{width:100%;border-collapse:collapse;font-size:7px}.reality-grid2 th,.reality-grid2 td{padding:7px 9px;border-bottom:1px solid #172733;text-align:left}.reality-grid2 th{color:#657e91}.reality-grid2 td{color:#b5c6d1;font-family:ui-monospace,monospace}.findings{padding:8px}.findings div{display:flex;justify-content:space-between;gap:8px;border:1px solid #403625;background:#1c1810;border-radius:6px;padding:7px;margin-bottom:5px}.findings b{font-size:7px;color:#d6be72}.findings span{font:7px ui-monospace;color:#907f55}.reality-ok{padding:13px;color:#58c7ad;font-size:8px}.reality-error{border:1px solid #68423a;background:#281714;color:#e99a84;border-radius:8px;padding:10px;display:grid;gap:5px;font-size:8px}.reality-error small{color:#98746b}.reality-coverage{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.reality-coverage div{border:1px solid #203443;background:#0d1923;border-radius:7px;padding:8px}.reality-coverage b{display:block;font-size:7px}.reality-coverage span{display:block;font-size:6.5px;color:#657d90;margin-top:3px}.reality-coverage .on b{color:#59d0b5}.reality-coverage .next b{color:#d0b268}.reality-empty{height:170px;display:grid;place-items:center;color:#60798c;font-size:8px}
      @media(max-width:1150px){.reality-config{grid-template-columns:repeat(4,1fr)}.reality-metrics{grid-template-columns:repeat(2,1fr)}.reality-coverage{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:760px){.reality-head{flex-direction:column}.reality-actions{justify-content:flex-start}.reality-config{grid-template-columns:repeat(2,1fr)}.reality-metrics,.reality-grid2,.reality-coverage{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function mount(panel) {
    if (!panel || panel.dataset.realityMounted === '1') return;
    const title = panel.querySelector('.panel-title span')?.textContent?.trim();
    if (title !== 'SIMULATION') return;
    installStyles();
    captureFromDom();
    const components = loadComponents();
    panel.dataset.realityMounted = '1';
    panel.classList.add('reality-lab');
    panel.innerHTML = `
      <div class="reality-head">
        <div><div class="eyebrow">FIELD REALITY LAB · VIRTUAL BRING-UP</div><h2>Prediction Envelope, not a single ideal number</h2><p>Runs the current project through component tolerance, temperature coefficient, self-heating, source impedance, PCB DC trace resistance, statistical variation and injected faults. This is the first field-correlation layer before vendor SPICE/IBIS/Touchstone and hardware-in-the-loop calibration.</p></div>
        <div class="reality-actions"><span class="reality-badge">REALITY ENGINE · v${ENGINE_VERSION}</span><button class="reality-spice">Export SPICE</button><button class="reality-run">▶ Run field envelope</button></div>
      </div>
      <div class="reality-note"><b>Engineering rule:</b> no simulator can promise a fabricated board will be identical to software unless the models cover the actual component, PCB parasitics, temperature, manufacturing spread and measured hardware correlation. This page therefore shows an envelope and model coverage instead of a fake “100% accurate” result.</div>
      <div class="reality-config">
        <label><span>Monte Carlo trials</span><input name="trials" type="number" min="50" max="1500" value="400"/></label>
        <label><span>Ambient °C</span><input name="ambient" type="number" min="-40" max="125" value="35"/></label>
        <label><span>Resistor tolerance %</span><input name="resTol" type="number" min="0" max="20" step="0.1" value="1"/></label>
        <label><span>Supply tolerance %</span><input name="sourceTol" type="number" min="0" max="20" step="0.1" value="2"/></label>
        <label><span>Source resistance mΩ</span><input name="sourceR" type="number" min="0" step="10" value="100"/></label>
        <label><span>PCB trace loop mΩ</span><input name="traceR" type="number" min="0" step="10" value="50"/></label>
        <label><span>Fault injection</span><select name="fault">${faultOptions(components)}</select></label>
      </div>
      <input name="seed" type="hidden" value="45"/>
      <div class="reality-status">Ready · reading live project netlist…</div>
      <div class="reality-results"></div>
      <div class="reality-coverage">
        <div class="on"><b>ACTIVE · DC + nonlinear PWL</b><span>MNA network solve, resistor/diode/LED/source models.</span></div>
        <div class="on"><b>ACTIVE · Uncertainty + thermal</b><span>Monte Carlo, tolerance, TCR/Vf tempco, self-heating and droop.</span></div>
        <div class="on"><b>ACTIVE · Fault injection</b><span>Open, short and source brownout virtual bring-up cases.</span></div>
        <div class="next"><b>NEXT · Vendor models + HIL</b><span>ngspice 47 .model/.lib, IBIS 8.0, Touchstone 2.1, measured-board correlation.</span></div>
      </div>`;
    panel.querySelector('.reality-run').addEventListener('click', () => run(panel));
    panel.querySelector('.reality-spice').addEventListener('click', () => exportSpice(panel));
    mountedPanel = panel;
    run(panel);
  }

  function scan() {
    captureFromDom();
    for (const panel of document.querySelectorAll('.panel')) mount(panel);
  }

  const observer = new MutationObserver(scan);
  function start() {
    observer.observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    scan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.PCBProReality = {
    version:ENGINE_VERSION,
    parseEng,
    solveDc,
    runEnvelope,
    rerun(){ if (mountedPanel?.isConnected) run(mountedPanel); },
    get lastEnvelope(){ return lastEnvelope; }
  };
})();