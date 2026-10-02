(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = '2.0.0';
  const STORAGE_KEY = 'pcbpro0045-wiregraph-v2';
  const LEGACY_KEY = 'pcbpro0045-wiregraph-v1';

  let routes = [];
  let current = null;
  let pointerWorld = null;
  let selectedWire = '';
  let wireOverlay = null;
  let pinLayer = null;
  let scheduled = false;
  let refreshTimer = 0;
  let pinPositions = new Map();
  let lastNetSignature = '';
  let loadedFromLegacy = false;

  const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    return el;
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));

  const language = () => window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id';
  const tr = (id, en) => language() === 'id' ? id : en;

  function load() {
    routes = [];
    loadedFromLegacy = false;
    try {
      const primary = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(primary?.routes)) {
        routes = primary.routes;
        return;
      }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (Array.isArray(legacy?.routes)) {
        routes = legacy.routes;
        loadedFromLegacy = true;
      }
    } catch {
      routes = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, routes }));
    } catch {}
  }

  function stage() { return document.querySelector('.stage.schematic'); }
  function world() { return document.querySelector('.stage.schematic .world'); }

  function canonicalTool(raw) {
    const text = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (['wire','kabel'].includes(text)) return 'wire';
    if (['select','pilih'].includes(text)) return 'select';
    if (['place','tempatkan'].includes(text)) return 'place';
    if (['pan','geser'].includes(text)) return 'pan';
    return text;
  }

  function activeTool() {
    const button = document.querySelector('.tools button.active');
    if (!button) return '';
    const stamped = button.dataset.pcbTool;
    if (stamped) return canonicalTool(stamped);
    return canonicalTool(button.querySelector('small')?.textContent || button.textContent || '');
  }

  function wireMode() {
    return Boolean(stage()) && activeTool() === 'wire';
  }

  function componentInfo(node) {
    const ref = node.querySelector('.ref')?.textContent?.trim() || '';
    const name = node.querySelector('small:not(.pcb-pin)')?.textContent?.trim() || node.querySelector('small')?.textContent?.trim() || '';
    const value = node.querySelector('b')?.textContent?.trim() || '';
    const text = `${ref} ${name} ${value}`.toLowerCase();
    let code = ref.replace(/\d.*$/, '').toUpperCase();
    if (/ground/.test(text)) code = 'GND';
    else if (/test point/.test(text)) code = 'TP';
    else if (/mosfet/.test(text) || /^q\d+/i.test(ref)) code = 'Q';
    else if (/op-amp/.test(text) || /^u\d+/i.test(ref)) code = 'U';
    else if (/led/.test(text)) code = 'LED';
    else if (/resistor/.test(text)) code = 'R';
    else if (/capacitor/.test(text)) code = 'C';
    else if (/inductor/.test(text)) code = 'L';
    else if (/dc source|voltage source|source/.test(text) || /^v\d+/i.test(ref)) code = 'V';
    else if (/diode/.test(text)) code = 'D';
    else if (/switch/.test(text)) code = 'SW';
    else if (/connector/.test(text)) code = 'J';
    return { ref, name, value, code };
  }

  function distributedSpecs(count) {
    if (count <= 0) return [];
    if (count === 1) return [{ n:1, side:'top', pos:50 }];
    if (count === 2) return [{ n:1, side:'left', pos:50 }, { n:2, side:'right', pos:50 }];
    const out = [];
    const leftCount = Math.ceil(count / 2);
    const rightCount = Math.floor(count / 2);
    for (let i = 1; i <= count; i++) {
      const left = i <= leftCount;
      const local = left ? i : i - leftCount;
      const total = left ? leftCount : rightCount;
      out.push({ n:i, side:left ? 'left' : 'right', pos:(local / (total + 1)) * 100 });
    }
    return out;
  }

  function specsFor(node) {
    const c = componentInfo(node);
    if (!c.ref) return [];
    const rawCount = node.dataset.pinCount;
    if (rawCount !== undefined && rawCount !== '') {
      const explicit = Number(rawCount);
      if (Number.isFinite(explicit)) return distributedSpecs(explicit);
    }
    if (c.code === 'GND' || c.code === 'TP') return [{ n:1, side:'top', pos:50 }];
    if (c.code === 'Q') return distributedSpecs(3);
    if (c.code === 'U') return distributedSpecs(8);
    return distributedSpecs(2);
  }

  function installStyles() {
    if (document.getElementById('pcbpro-wire-style-v2')) return;
    document.getElementById('pcbpro-wire-style')?.remove();
    const style = document.createElement('style');
    style.id = 'pcbpro-wire-style-v2';
    style.textContent = `
      .schematic.pcb-wire-mode{cursor:crosshair!important}
      [data-wire-pin-layer]{position:absolute;inset:0;z-index:30;pointer-events:none;overflow:visible}
      .pcb-pin{position:absolute;width:18px;height:18px;padding:0;border:2px solid #70e4cf;background:#07131b;border-radius:50%;display:grid;place-items:center;color:#effffc;font:850 8px ui-monospace;box-shadow:0 0 0 3px #07131bdd,0 0 12px #38ceb433;transform:translate(-50%,-50%);opacity:0;pointer-events:none;cursor:crosshair;user-select:none;transition:opacity .08s,background .08s,border-color .08s,box-shadow .08s}
      .schematic.pcb-wire-mode [data-wire-pin-layer]{pointer-events:none}
      .schematic.pcb-wire-mode .pcb-pin{opacity:1;pointer-events:auto}
      .schematic.pcb-wire-mode .pcb-pin:hover,.pcb-pin.wire-start{background:#168d77;border-color:#fff;box-shadow:0 0 0 4px #36d7ba44,0 0 22px #54e3ca88}
      [data-wire-overlay]{position:absolute;inset:0;width:100%;height:100%;z-index:4;overflow:visible;pointer-events:none}
      [data-wire-overlay] .wire-visible{fill:none;stroke:#59dbc3;stroke-width:2.35;vector-effect:non-scaling-stroke;stroke-linecap:square;stroke-linejoin:miter;pointer-events:none}
      [data-wire-overlay] .wire-visible.selected{stroke:#fff;filter:drop-shadow(0 0 4px #57dbc4)}
      [data-wire-overlay] .wire-hit{fill:none;stroke:transparent;stroke-width:15;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
      .schematic.pcb-wire-mode [data-wire-overlay] .wire-hit{pointer-events:none}
      [data-wire-overlay] .wire-preview{fill:none;stroke:#f0cb61;stroke-width:2.2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}
      [data-wire-overlay] .wire-junction{fill:#59dbc3;stroke:#07131b;stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:none}
      .pcb-wire-hud{position:absolute;z-index:70;left:12px;top:38px;display:flex;align-items:center;gap:8px;max-width:min(760px,calc(100% - 24px));border:1px solid #2c6559;background:#09221cf4;color:#9fe9da;border-radius:8px;padding:8px 10px;font:800 10px ui-monospace;box-shadow:0 8px 28px #0007}
      .pcb-wire-hud b{color:#fff}.pcb-wire-hud span{color:#91bbb3}.pcb-wire-hud em{font-style:normal;color:#6f918c;margin-left:auto}
      .pcb-wire-hud button{pointer-events:auto;border:1px solid #356052;background:#102d26;color:#9be9d9;border-radius:6px;padding:5px 8px;font:800 9px ui-monospace;cursor:pointer}
      .pcb-wire-hud button:hover{background:#17463a;color:#fff}.pcb-wire-hud .danger{border-color:#61453d;background:#281813;color:#e9a28f}
      @media(max-width:760px){.pcb-wire-hud{top:34px;right:8px;left:8px;flex-wrap:wrap}.pcb-wire-hud em{margin-left:0;width:100%}}
    `;
    document.head.appendChild(style);
  }

  function ensureLayers() {
    const w = world();
    if (!w) {
      wireOverlay = null;
      pinLayer = null;
      return null;
    }

    if (!wireOverlay?.isConnected || wireOverlay.parentElement !== w) {
      wireOverlay = w.querySelector('[data-wire-overlay]');
      if (!wireOverlay) {
        wireOverlay = svg('svg', { 'data-wire-overlay':'true', preserveAspectRatio:'none' });
        w.prepend(wireOverlay);
      }
    }

    if (!pinLayer?.isConnected || pinLayer.parentElement !== w) {
      pinLayer = w.querySelector('[data-wire-pin-layer]');
      if (!pinLayer) {
        pinLayer = document.createElement('div');
        pinLayer.dataset.wirePinLayer = 'true';
        w.appendChild(pinLayer);
      }
    }

    const fixed = w.querySelector('svg.wires');
    if (fixed) fixed.style.display = 'none';
    return w;
  }

  function pinPosition(node, spec) {
    const cx = node.offsetLeft;
    const cy = node.offsetTop;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const gap = 9;
    if (spec.side === 'left') return { x:cx - width/2 - gap, y:cy - height/2 + (height * spec.pos/100) };
    if (spec.side === 'right') return { x:cx + width/2 + gap, y:cy - height/2 + (height * spec.pos/100) };
    if (spec.side === 'top') return { x:cx - width/2 + (width * spec.pos/100), y:cy - height/2 - gap };
    return { x:cx - width/2 + (width * spec.pos/100), y:cy + height/2 + gap };
  }

  function syncPins() {
    const st = stage();
    const w = ensureLayers();
    pinPositions = new Map();
    if (!st || !w || !pinLayer) return;

    const mode = wireMode();
    st.classList.toggle('pcb-wire-mode', mode);

    const existing = new Map([...pinLayer.querySelectorAll('.pcb-pin')].map((el) => [el.dataset.pin, el]));
    const wanted = new Set();

    for (const node of st.querySelectorAll('.node')) {
      const info = componentInfo(node);
      if (!info.ref) continue;
      for (const spec of specsFor(node)) {
        const id = `${info.ref}.${spec.n}`;
        const point = pinPosition(node, spec);
        wanted.add(id);
        pinPositions.set(id, point);
        let pin = existing.get(id);
        if (!pin) {
          pin = document.createElement('span');
          pin.className = 'pcb-pin';
          pin.dataset.pin = id;
          pin.title = id;
          pin.textContent = String(spec.n);
          pinLayer.appendChild(pin);
        }
        pin.dataset.side = spec.side;
        pin.style.left = `${point.x}px`;
        pin.style.top = `${point.y}px`;
        pin.classList.toggle('wire-start', current?.from === id);
      }
    }

    for (const [id, pin] of existing) {
      if (!wanted.has(id)) pin.remove();
    }
  }

  function clientToWorld(clientX, clientY) {
    const w = world();
    if (!w) return { x:0, y:0 };
    const rect = w.getBoundingClientRect();
    const sx = rect.width / Math.max(1, w.offsetWidth);
    const sy = rect.height / Math.max(1, w.offsetHeight);
    return {
      x:(clientX - rect.left) / Math.max(.0001, sx),
      y:(clientY - rect.top) / Math.max(.0001, sy)
    };
  }

  function pinPoint(pinId) {
    const p = pinPositions.get(pinId);
    return p ? { x:p.x, y:p.y } : null;
  }

  function orthogonal(points, target) {
    const out = [...points];
    const last = out[out.length - 1];
    if (!last) return [target];
    if (Math.abs(last.x-target.x) < .5 || Math.abs(last.y-target.y) < .5) {
      out.push({ x:target.x, y:target.y });
      return out;
    }
    out.push({ x:target.x, y:last.y });
    out.push({ x:target.x, y:target.y });
    return out;
  }

  function routePoints(route, previewEnd = null) {
    const from = pinPoint(route.from);
    if (!from) return [];
    let points = [from, ...(route.corners || [])];
    const to = previewEnd || pinPoint(route.to);
    if (to) points = orthogonal(points, to);
    return points;
  }

  function pathData(points) {
    if (!points.length) return '';
    return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}`;
  }

  function sanitizeRoutes() {
    if (!pinPositions.size) return false;
    const valid = new Set(pinPositions.keys());
    const seen = new Set();
    const next = [];
    for (const raw of routes) {
      const from = String(raw?.from || '');
      const to = String(raw?.to || '');
      if (!valid.has(from) || !valid.has(to) || from === to) continue;
      const pair = [from,to].sort().join('|');
      if (seen.has(pair)) continue;
      seen.add(pair);
      next.push({
        id:String(raw?.id || `W${Date.now()}_${Math.random().toString(36).slice(2,7)}`),
        from,
        to,
        corners:Array.isArray(raw?.corners) ? raw.corners.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)).map((p) => ({x:p.x,y:p.y})) : []
      });
    }
    const changed = JSON.stringify(next) !== JSON.stringify(routes);
    routes = next;
    if (changed || loadedFromLegacy) {
      loadedFromLegacy = false;
      save();
    }
    return changed;
  }

  function draw() {
    scheduled = false;
    const w = ensureLayers();
    if (!w || !wireOverlay) return;
    syncPins();
    sanitizeRoutes();

    wireOverlay.setAttribute('viewBox', `0 0 ${Math.max(1,w.offsetWidth)} ${Math.max(1,w.offsetHeight)}`);
    wireOverlay.replaceChildren();

    for (const route of routes) {
      const points = routePoints(route);
      if (points.length < 2) continue;
      const d = pathData(points);
      wireOverlay.append(
        svg('path', { d, class:`wire-visible${selectedWire===route.id ? ' selected' : ''}`, 'data-wire-id':route.id }),
        svg('path', { d, class:'wire-hit', 'data-wire-id':route.id })
      );
      const end = points[points.length - 1];
      wireOverlay.append(svg('circle', { cx:end.x, cy:end.y, r:3.3, class:'wire-junction' }));
    }

    if (current && pointerWorld) {
      const points = routePoints({ from:current.from, corners:current.corners, to:'' }, pointerWorld);
      if (points.length > 1) wireOverlay.append(svg('path', { d:pathData(points), class:'wire-preview' }));
    }

    updateHud();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(draw);
  }

  function updateHud() {
    const st = stage();
    if (!st) return;
    let hud = st.querySelector('.pcb-wire-hud');
    if (!wireMode()) {
      hud?.remove();
      return;
    }
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'pcb-wire-hud';
      st.appendChild(hud);
    }

    const message = current
      ? `<b>${esc(current.from)}</b><span>${tr('gerakkan mouse · klik kosong untuk belok · klik pin tujuan','move pointer · click canvas for corner · click destination pin')}</span>`
      : `<b>WIRE</b><span>${tr('klik pin pertama untuk mulai','click the first pin to start')}</span>`;
    hud.innerHTML = `${message}<em>${pinPositions.size} PIN · ${routes.length} WIRE</em><button class="wire-cancel">Esc</button><button class="wire-reset danger">${tr('Reset wiring','Reset wiring')}</button>`;
    hud.querySelector('.wire-cancel')?.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); cancelCurrent();
    });
    hud.querySelector('.wire-reset')?.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!routes.length || confirm(tr('Hapus semua wire pada schematic ini?','Delete all wires on this schematic?'))) clearWires();
    });
  }

  function connectPins(from, to, corners = []) {
    if (!from || !to || from === to) return false;
    if (!pinPositions.has(from) || !pinPositions.has(to)) return false;
    const exists = routes.some((r) => (r.from===from && r.to===to) || (r.from===to && r.to===from));
    if (!exists) {
      routes.push({
        id:`W${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        from,
        to,
        corners:[...corners]
      });
    }
    save();
    cancelCurrent(false);
    selectedWire = '';
    publishNetlist();
    schedule();
    return !exists;
  }

  function handlePinPointerDown(event, pin) {
    if (!wireMode() || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const id = pin?.dataset?.pin;
    if (!id || !pinPositions.has(id)) return;

    if (!current) {
      current = { from:id, corners:[] };
      pointerWorld = pinPoint(id);
      selectedWire = '';
      schedule();
      return;
    }

    if (current.from === id && !current.corners.length) {
      cancelCurrent();
      return;
    }
    connectPins(current.from, id, current.corners);
  }

  function addCorner(clientX, clientY) {
    if (!current) return;
    const target = clientToWorld(clientX, clientY);
    const start = current.corners.length ? current.corners[current.corners.length - 1] : pinPoint(current.from);
    if (!start) return;
    if (Math.abs(start.x-target.x) >= .5 && Math.abs(start.y-target.y) >= .5) {
      current.corners.push({ x:target.x, y:start.y });
    }
    current.corners.push({ x:target.x, y:target.y });
    pointerWorld = target;
    schedule();
  }

  function cancelCurrent(redraw = true) {
    current = null;
    pointerWorld = null;
    if (redraw) schedule();
  }

  function clearWires() {
    routes = [];
    current = null;
    selectedWire = '';
    pointerWorld = null;
    save();
    publishNetlist();
    schedule();
  }

  function deleteSelectedWire() {
    if (!selectedWire) return false;
    const before = routes.length;
    routes = routes.filter((r) => r.id !== selectedWire);
    selectedWire = '';
    if (routes.length === before) return false;
    save();
    publishNetlist();
    schedule();
    return true;
  }

  function unionFindNets() {
    const parent = new Map();
    const find = (x) => {
      if (!parent.has(x)) parent.set(x, x);
      let p = parent.get(x);
      if (p !== x) { p = find(p); parent.set(x, p); }
      return p;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(rb, ra);
    };

    for (const route of routes) union(route.from, route.to);

    const groups = new Map();
    for (const pin of parent.keys()) {
      const root = find(pin);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(pin);
    }

    const componentByRef = new Map([...document.querySelectorAll('.stage.schematic .node')].map((node) => {
      const info = componentInfo(node);
      return [info.ref, info];
    }));

    let seq = 1;
    const used = new Set();
    return [...groups.values()].filter((pins) => pins.length >= 2).map((pins) => {
      pins.sort();
      let name = '';
      if (pins.some((p) => componentByRef.get(p.split('.')[0])?.code === 'GND')) name = 'GND';
      else if (pins.some((p) => /^V\d+\.1$/i.test(p))) name = 'VCC';
      else name = `NET_${String(seq++).padStart(3,'0')}`;
      let candidate = name;
      let suffix = 2;
      while (used.has(candidate)) candidate = `${name}_${suffix++}`;
      used.add(candidate);
      return { name:candidate, pins:pins.join(' · '), pinList:pins };
    });
  }

  function inspectorSection() {
    return [...document.querySelectorAll('.inspector section')].find((section) =>
      /NET INSPECTOR|PEMERIKSA NET/i.test(section.querySelector('.ins-title span')?.textContent || '')
    ) || null;
  }

  function netSignature(nets) {
    return nets.map((n) => `${n.name}:${n.pins}`).sort().join('|');
  }

  function syncInspector(nets) {
    const section = inspectorSection();
    if (!section) return false;
    const sig = netSignature(nets);
    const existing = [...section.querySelectorAll('.net')].map((button) => {
      const name = button.querySelector('b')?.textContent?.trim() || '';
      const pins = button.querySelector('small')?.textContent?.trim() || '';
      return `${name}:${pins}`;
    }).sort().join('|');
    if (sig === existing && sig === lastNetSignature) return false;

    section.querySelectorAll('.net').forEach((el) => el.remove());
    const badge = section.querySelector('.ins-title b');
    if (badge) badge.textContent = String(nets.length);
    for (const net of nets) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'net';
      button.dataset.liveNet = '1';
      button.innerHTML = `<i></i><span><b>${esc(net.name)}</b><small>${esc(net.pins)}</small></span>`;
      section.appendChild(button);
    }
    lastNetSignature = sig;
    return true;
  }

  function publishNetlist() {
    const nets = unionFindNets();
    syncInspector(nets);
    window.dispatchEvent(new CustomEvent('pcbpro:netlist-changed', { detail:{ nets, routes:structuredClone(routes) } }));
    try { window.PCBProLiveSimulation?.solveOnce?.(); } catch {}
    try { window.PCBProAssistant?.refresh?.(); } catch {}
    return nets;
  }

  function documentPointerDown(event) {
    const pin = event.target?.closest?.('[data-wire-pin-layer] .pcb-pin');
    if (pin) {
      handlePinPointerDown(event, pin);
      return;
    }

    const wireHit = event.target?.closest?.('[data-wire-overlay] .wire-hit');
    if (wireHit && !wireMode()) {
      event.preventDefault();
      event.stopPropagation();
      selectedWire = wireHit.getAttribute('data-wire-id') || '';
      schedule();
      return;
    }

    if (!wireMode() || !current || event.button !== 0) return;
    const st = stage();
    if (!st || !st.contains(event.target)) return;
    if (event.target.closest?.('.node,.pcb-wire-hud,.stage-info,.stage-help,.layer-strip,.floating-card')) return;
    event.preventDefault();
    event.stopPropagation();
    addCorner(event.clientX, event.clientY);
  }

  function documentPointerMove(event) {
    if (current && wireMode()) {
      pointerWorld = clientToWorld(event.clientX, event.clientY);
      schedule();
      return;
    }
    if (event.buttons && document.querySelector('.app.interacting')) schedule();
  }

  function documentKeyDown(event) {
    if (event.key === 'Escape' && current) {
      event.preventDefault();
      cancelCurrent();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedWire && !['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)) {
      event.preventDefault();
      deleteSelectedWire();
    }
  }

  function refreshSoon(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      syncPins();
      sanitizeRoutes();
      publishNetlist();
      schedule();
    }, delay);
  }

  function diagnostics() {
    return {
      version:VERSION,
      stage:Boolean(stage()),
      tool:activeTool(),
      wireMode:wireMode(),
      pins:pinPositions.size,
      routes:structuredClone(routes),
      nets:unionFindNets(),
      draft:current ? structuredClone(current) : null
    };
  }

  function installProjectBridge() {
    const existing = window.PCBProProject || {};
    window.PCBProProject = Object.assign(existing, {
      getNets: () => unionFindNets().map(({name,pins}) => ({name,pins})),
      getWireGraph: () => ({version:VERSION,routes:structuredClone(routes)}),
      connectPins,
      deleteWire:(id) => { selectedWire = id; return deleteSelectedWire(); },
      clearWires,
      redrawWires:schedule,
      wireDiagnostics:diagnostics
    });
  }

  function start() {
    load();
    installStyles();
    installProjectBridge();
    ensureLayers();
    syncPins();
    sanitizeRoutes();
    publishNetlist();
    schedule();

    document.addEventListener('pointerdown', documentPointerDown, true);
    document.addEventListener('pointermove', documentPointerMove, { passive:true });
    document.addEventListener('pointerup', () => refreshSoon(0), { passive:true });
    document.addEventListener('click', () => refreshSoon(0), { passive:true });
    document.addEventListener('wheel', () => schedule(), { passive:true, capture:true });
    document.addEventListener('keydown', documentKeyDown, true);
    window.addEventListener('resize', schedule, { passive:true });
    window.addEventListener('pcbpro:language', () => refreshSoon(0));
    window.addEventListener('pcbpro:layout-changed', () => refreshSoon(0));

    setTimeout(() => refreshSoon(0), 180);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.PCBProWireEngine = {
    version:VERSION,
    get routes() { return structuredClone(routes); },
    get nets() { return unionFindNets(); },
    get mode() { return wireMode(); },
    get draft() { return current ? structuredClone(current) : null; },
    redraw:schedule,
    refresh:refreshSoon,
    publishNetlist,
    connectPins,
    clear:clearWires,
    cancel:cancelCurrent,
    diagnostics
  };
})();