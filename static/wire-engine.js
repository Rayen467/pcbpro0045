(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = '1.1.0';
  const STORAGE_KEY = 'pcbpro0045-wiregraph-v1';

  let routes = [];
  let current = null;
  let pointerWorld = null;
  let selectedWire = '';
  let overlay = null;
  let scheduled = false;
  let refreshTimer = 0;

  const svg = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      routes = Array.isArray(parsed?.routes) ? parsed.routes.filter((r) => r?.from && r?.to) : [];
    } catch { routes = []; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, routes })); } catch {}
  }

  function stage() { return document.querySelector('.stage.schematic'); }
  function world() { return document.querySelector('.stage.schematic .world'); }

  function canonicalTool(raw) {
    const text = String(raw || '').trim().toLowerCase();
    if (['wire', 'kabel'].includes(text)) return 'wire';
    if (['select', 'pilih'].includes(text)) return 'select';
    if (['place', 'tempatkan'].includes(text)) return 'place';
    if (['pan', 'geser'].includes(text)) return 'pan';
    return text;
  }

  function activeTool() {
    const b = document.querySelector('.tools button.active');
    if (!b) return '';
    if (b.dataset.pcbTool) return b.dataset.pcbTool;
    const raw = b.querySelector('small')?.textContent?.trim() || b.textContent?.trim() || '';
    const canonical = canonicalTool(raw);
    b.dataset.pcbTool = canonical;
    return canonical;
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
    else if (/source/.test(text)) code = 'V';
    else if (/diode/.test(text)) code = 'D';
    else if (/switch/.test(text)) code = 'SW';
    return { ref, name, value, code };
  }

  function specsFor(node) {
    const c = componentInfo(node);
    if (!c.ref) return [];
    if (c.code === 'GND' || c.code === 'TP') return [{ n:1, side:'top', pos:50 }];
    if (c.code === 'Q') return [
      { n:1, side:'left', pos:30 }, { n:2, side:'left', pos:70 }, { n:3, side:'right', pos:50 }
    ];
    if (c.code === 'U') return [
      { n:1,side:'left',pos:20 }, { n:2,side:'left',pos:40 }, { n:3,side:'left',pos:60 }, { n:4,side:'left',pos:80 },
      { n:5,side:'right',pos:80 }, { n:6,side:'right',pos:60 }, { n:7,side:'right',pos:40 }, { n:8,side:'right',pos:20 }
    ];
    return [{ n:1, side:'left', pos:50 }, { n:2, side:'right', pos:50 }];
  }

  function installStyles() {
    if (document.getElementById('pcbpro-wire-style')) return;
    const s = document.createElement('style');
    s.id = 'pcbpro-wire-style';
    s.textContent = `
      .pcb-pin{position:absolute;width:17px;height:17px;padding:0;border:2px solid #71e3cf;background:#07131b;border-radius:50%;z-index:50;opacity:0;pointer-events:none;display:grid;place-items:center;color:#dffaf4;font:800 8px ui-monospace;box-shadow:0 0 0 3px #07131bcc;transition:opacity .1s,border-color .1s,box-shadow .1s;transform:translate(-50%,-50%);cursor:crosshair}
      .pcb-pin[data-side="left"]{left:-8px}.pcb-pin[data-side="right"]{left:calc(100% + 8px)}.pcb-pin[data-side="top"]{top:-8px!important;left:50%}
      .schematic.pcb-wire-mode .pcb-pin{opacity:1;pointer-events:auto}.schematic.pcb-wire-mode .node{overflow:visible}.schematic.pcb-wire-mode{cursor:crosshair}
      .schematic.pcb-wire-mode .pcb-pin:hover,.pcb-pin.wire-start{border-color:#fff;background:#167a68;box-shadow:0 0 0 4px #2ad3b747,0 0 18px #4fe1c777}
      .pcb-wire-hud{position:absolute;z-index:60;left:12px;top:38px;max-width:420px;border:1px solid #2c6559;background:#09221cf2;color:#9fe9da;border-radius:7px;padding:8px 10px;font:800 10px ui-monospace;pointer-events:none;box-shadow:0 8px 26px #0006}
      .pcb-wire-hud b{color:#fff}.pcb-wire-hud span{color:#88b8af;margin-left:7px}
      [data-wire-overlay]{position:absolute;inset:0;width:100%;height:100%;z-index:4;overflow:visible;pointer-events:none}
      [data-wire-overlay] .wire-visible{fill:none;stroke:#59dbc3;stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linecap:square;stroke-linejoin:miter;pointer-events:none}
      [data-wire-overlay] .wire-visible.selected{stroke:#fff;filter:drop-shadow(0 0 3px #5ae0c7)}
      [data-wire-overlay] .wire-hit{fill:none;stroke:transparent;stroke-width:14;vector-effect:non-scaling-stroke;pointer-events:stroke;cursor:pointer}
      [data-wire-overlay] .wire-preview{fill:none;stroke:#e4cb70;stroke-width:2;stroke-dasharray:6 4;vector-effect:non-scaling-stroke;pointer-events:none}
      [data-wire-overlay] .wire-junction{fill:#59dbc3;stroke:#07131b;stroke-width:1.5;vector-effect:non-scaling-stroke;pointer-events:none}
    `;
    document.head.appendChild(s);
  }

  function ensurePins() {
    const st = stage();
    if (!st) return;
    st.classList.toggle('pcb-wire-mode', wireMode());

    for (const node of st.querySelectorAll('.node')) {
      const info = componentInfo(node);
      if (!info.ref) continue;
      const wanted = specsFor(node);
      const existing = [...node.querySelectorAll('.pcb-pin')];
      const existingIds = new Set(existing.map((p) => p.dataset.pin));

      for (const spec of wanted) {
        const id = `${info.ref}.${spec.n}`;
        if (existingIds.has(id)) continue;
        const pin = document.createElement('span');
        pin.className = 'pcb-pin';
        pin.dataset.pin = id;
        pin.dataset.side = spec.side;
        pin.setAttribute('role', 'button');
        pin.setAttribute('aria-label', `Pin ${id}`);
        pin.tabIndex = 0;
        pin.title = id;
        pin.textContent = spec.n;
        if (spec.side === 'left' || spec.side === 'right') pin.style.top = `${spec.pos}%`;
        pin.addEventListener('pointerdown', onPinPointerDown);
        pin.addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && wireMode()) {
            e.preventDefault();
            onPinPointerDown({ ...e, button:0, currentTarget:pin, preventDefault:()=>e.preventDefault(), stopPropagation:()=>e.stopPropagation() });
          }
        });
        node.appendChild(pin);
      }

      for (const pin of existing) {
        if (!wanted.some((x) => `${info.ref}.${x.n}` === pin.dataset.pin)) pin.remove();
      }
    }
    updateHud();
  }

  function clientToWorld(clientX, clientY) {
    const w = world();
    if (!w) return { x:0, y:0 };
    const r = w.getBoundingClientRect();
    const sx = r.width / Math.max(1, w.offsetWidth);
    const sy = r.height / Math.max(1, w.offsetHeight);
    return { x:(clientX-r.left)/Math.max(.0001,sx), y:(clientY-r.top)/Math.max(.0001,sy) };
  }

  function pinPoint(pinId) {
    const pin = [...document.querySelectorAll('.pcb-pin')].find((p) => p.dataset.pin === pinId);
    if (!pin) return null;
    const r = pin.getBoundingClientRect();
    return clientToWorld(r.left + r.width/2, r.top + r.height/2);
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
    const a = pinPoint(route.from);
    if (!a) return [];
    let points = [a, ...(route.corners || [])];
    const b = previewEnd || pinPoint(route.to);
    if (b) points = orthogonal(points, b);
    return points;
  }

  function pathData(points) {
    if (!points.length) return '';
    return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}`;
  }

  function ensureOverlay() {
    const w = world();
    if (!w) { overlay = null; return null; }
    if (overlay?.isConnected && overlay.parentElement === w) return overlay;
    overlay = w.querySelector('[data-wire-overlay]');
    if (!overlay) {
      overlay = svg('svg', { 'data-wire-overlay':'true', preserveAspectRatio:'none' });
      w.prepend(overlay);
    }
    const fixed = w.querySelector('svg.wires');
    if (fixed) fixed.style.display = 'none';
    return overlay;
  }

  function draw() {
    scheduled = false;
    ensurePins();
    const w = world();
    const ov = ensureOverlay();
    if (!w || !ov) return;

    ov.setAttribute('viewBox', `0 0 ${Math.max(1,w.offsetWidth)} ${Math.max(1,w.offsetHeight)}`);
    ov.replaceChildren();

    for (const route of routes) {
      const points = routePoints(route);
      if (points.length < 2) continue;
      const d = pathData(points);
      const visible = svg('path', { d, class:`wire-visible${selectedWire===route.id?' selected':''}`, 'data-wire-id':route.id });
      const hit = svg('path', { d, class:'wire-hit', 'data-wire-id':route.id });
      hit.addEventListener('pointerdown', (e) => {
        if (wireMode()) return;
        e.preventDefault();
        e.stopPropagation();
        selectedWire = route.id;
        schedule();
        updateHud();
      });
      ov.append(visible, hit);
      const end = points[points.length - 1];
      ov.append(svg('circle', { cx:end.x, cy:end.y, r:3.2, class:'wire-junction' }));
    }

    if (current && pointerWorld) {
      const points = routePoints({ from:current.from, corners:current.corners, to:null }, pointerWorld);
      if (points.length > 1) ov.append(svg('path', { d:pathData(points), class:'wire-preview' }));
    }
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
    if (!wireMode()) { hud?.remove(); return; }
    if (!hud) {
      hud = document.createElement('div');
      hud.className = 'pcb-wire-hud';
      st.appendChild(hud);
    }
    if (!current) hud.innerHTML = '<b>WIRE</b><span>klik pin pertama → gerakkan mouse → klik pin tujuan · Esc batal</span>';
    else hud.innerHTML = `<b>${esc(current.from)}</b><span>→ klik area kosong untuk corner · klik pin tujuan</span>`;
  }

  function onPinPointerDown(e) {
    if (!wireMode() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const id = e.currentTarget.dataset.pin;
    if (!id) return;

    if (!current) {
      current = { from:id, corners:[] };
      pointerWorld = pinPoint(id);
      e.currentTarget.classList.add('wire-start');
      selectedWire = '';
      updateHud();
      schedule();
      return;
    }

    if (id === current.from && !current.corners.length) {
      cancelCurrent();
      return;
    }

    connectPins(current.from, id, current.corners);
  }

  function connectPins(from, to, corners = []) {
    if (!from || !to || from === to) return false;
    const exists = routes.some((r) => (r.from===from && r.to===to) || (r.from===to && r.to===from));
    if (!exists) routes.push({ id:`W${Date.now()}_${Math.random().toString(36).slice(2,7)}`, from, to, corners:[...corners] });
    save();
    cancelCurrent(false);
    publishNetlist();
    schedule();
    return !exists;
  }

  function addCorner(clientX, clientY) {
    if (!current) return;
    const target = clientToWorld(clientX, clientY);
    const start = current.corners.length ? current.corners[current.corners.length - 1] : pinPoint(current.from);
    if (!start) return;
    if (Math.abs(start.x-target.x) >= .5 && Math.abs(start.y-target.y) >= .5) current.corners.push({ x:target.x, y:start.y });
    current.corners.push({ x:target.x, y:target.y });
    pointerWorld = target;
    schedule();
    updateHud();
  }

  function cancelCurrent(redraw = true) {
    current = null;
    pointerWorld = null;
    document.querySelectorAll('.pcb-pin.wire-start').forEach((p) => p.classList.remove('wire-start'));
    updateHud();
    if (redraw) schedule();
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
    updateHud();
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

    for (const r of routes) union(r.from, r.to);

    const groups = new Map();
    for (const pin of parent.keys()) {
      const root = find(pin);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(pin);
    }

    const componentByRef = new Map([...document.querySelectorAll('.stage.schematic .node')].map((n) => {
      const c = componentInfo(n);
      return [c.ref, c];
    }));

    let n = 1;
    const used = new Set();
    return [...groups.values()].filter((pins) => pins.length >= 2).map((pins) => {
      pins.sort();
      let name = '';
      if (pins.some((p) => componentByRef.get(p.split('.')[0])?.code === 'GND')) name = 'GND';
      if (!name && pins.some((p) => /^V\d+\.1$/i.test(p))) name = 'VCC';
      if (!name) name = `NET_${String(n++).padStart(3,'0')}`;
      let base = name, i = 2;
      while (used.has(name)) name = `${base}_${i++}`;
      used.add(name);
      return { name, pins:pins.join(' · '), pinList:pins };
    });
  }

  function inspectorSection() {
    return [...document.querySelectorAll('.inspector section')].find((s) => /NET INSPECTOR|PEMERIKSA NET/i.test(s.querySelector('.ins-title span')?.textContent || '')) || null;
  }

  function inspectorSignature(section) {
    if (!section) return '';
    return [...section.querySelectorAll('.net')].map((b) => {
      const name = b.querySelector('b')?.textContent?.trim() || '';
      const pins = b.querySelector('small')?.textContent?.trim() || '';
      return `${name}:${pins}`;
    }).sort().join('|');
  }

  function desiredSignature(nets) {
    return nets.map((n) => `${n.name}:${n.pins}`).sort().join('|');
  }

  function syncInspector(nets = unionFindNets()) {
    const section = inspectorSection();
    if (!section) return false;
    if (inspectorSignature(section) === desiredSignature(nets)) return false;

    section.querySelectorAll('.net').forEach((x) => x.remove());
    const badge = section.querySelector('.ins-title b');
    if (badge) badge.textContent = String(nets.length);

    for (const net of nets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'net';
      b.dataset.liveNet = '1';
      b.innerHTML = `<i></i><span><b>${esc(net.name)}</b><small>${esc(net.pins)}</small></span>`;
      section.appendChild(b);
    }
    return true;
  }

  function publishNetlist() {
    const nets = unionFindNets();
    syncInspector(nets);
    window.dispatchEvent(new CustomEvent('pcbpro:netlist-changed', { detail:{ nets, routes:[...routes] } }));
    try { window.PCBProLiveSimulation?.solveOnce?.(); } catch {}
    return nets;
  }

  function pointerDownCapture(e) {
    if (!wireMode() || !current || e.button !== 0) return;
    const st = stage();
    if (!st || !st.contains(e.target)) return;
    if (e.target.closest?.('.pcb-pin,.node,.pcb-wire-hud,.stage-info,.stage-help')) return;
    e.preventDefault();
    e.stopPropagation();
    addCorner(e.clientX, e.clientY);
  }

  function pointerMove(e) {
    if (current && wireMode()) {
      pointerWorld = clientToWorld(e.clientX, e.clientY);
      schedule();
    } else if (wireMode()) schedule();
  }

  function keyDown(e) {
    if (e.key === 'Escape' && current) {
      e.preventDefault();
      cancelCurrent();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWire && !['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)) {
      e.preventDefault();
      deleteSelectedWire();
    }
  }

  function refreshSoon(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      ensurePins();
      publishNetlist();
      schedule();
    }, delay);
  }

  function installProjectBridge() {
    const existing = window.PCBProProject || {};
    window.PCBProProject = Object.assign(existing, {
      getNets: () => unionFindNets().map(({ name, pins }) => ({ name, pins })),
      getWireGraph: () => ({ version:VERSION, routes:structuredClone(routes) }),
      connectPins,
      deleteWire: (id) => { selectedWire = id; return deleteSelectedWire(); },
      clearWires: () => { routes = []; selectedWire = ''; cancelCurrent(false); save(); publishNetlist(); schedule(); },
      redrawWires: schedule
    });
  }

  function start() {
    load();
    installStyles();
    installProjectBridge();

    document.addEventListener('pointerdown', pointerDownCapture, true);
    document.addEventListener('pointermove', pointerMove, { passive:true });
    document.addEventListener('pointerup', () => refreshSoon(0), { passive:true });
    document.addEventListener('keydown', keyDown, true);
    document.addEventListener('click', () => refreshSoon(0), { passive:true });
    window.addEventListener('resize', schedule, { passive:true });
    window.addEventListener('pcbpro:language', () => refreshSoon(0));

    refreshSoon(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.PCBProWireEngine = {
    version: VERSION,
    get routes() { return structuredClone(routes); },
    get nets() { return unionFindNets(); },
    redraw: schedule,
    publishNetlist,
    connectPins,
    clear() { routes = []; save(); publishNetlist(); schedule(); },
    cancel: cancelCurrent
  };
})();