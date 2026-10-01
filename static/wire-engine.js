(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const VERSION = '0.3.0';
  let scheduled = false;
  let overlay = null;
  let lastWorld = null;

  const makeSvg = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };

  function byRef(world, ref) {
    return [...world.querySelectorAll('.node')].find((node) => node.querySelector('.ref')?.textContent?.trim() === ref) || null;
  }

  function liveNets() {
    return [...document.querySelectorAll('.inspector .net')].map((button) => ({
      name: button.querySelector('b')?.textContent?.trim() || '',
      pins: button.querySelector('small')?.textContent?.trim() || ''
    })).filter((n) => n.name && n.pins);
  }

  function pinRefs(net) {
    return String(net.pins).split(/[·,\s]+/).map((x) => x.trim()).filter((x) => /^[A-Za-z]+\d+\.\d+$/.test(x));
  }

  function liveConnections() {
    const rows = [];
    for (const net of liveNets()) {
      const refs = [...new Set(pinRefs(net).map((p) => p.split('.')[0]))];
      for (let i = 0; i < refs.length - 1; i++) rows.push({ id: net.name, from: refs[i], to: refs[i + 1] });
    }
    return rows;
  }

  function box(node) {
    return { x: node.offsetLeft, y: node.offsetTop, w: node.offsetWidth, h: node.offsetHeight };
  }

  function anchors(aNode, bNode) {
    const a = box(aNode), b = box(bNode);
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? { a:{x:a.x+a.w/2,y:a.y}, b:{x:b.x-b.w/2,y:b.y}, axis:'x' }
        : { a:{x:a.x-a.w/2,y:a.y}, b:{x:b.x+b.w/2,y:b.y}, axis:'x' };
    }
    return dy >= 0
      ? { a:{x:a.x,y:a.y+a.h/2}, b:{x:b.x,y:b.y-b.h/2}, axis:'y' }
      : { a:{x:a.x,y:a.y-a.h/2}, b:{x:b.x,y:b.y+b.h/2}, axis:'y' };
  }

  function path(start, end, axis) {
    if (axis === 'x') {
      const mid = start.x + (end.x - start.x) / 2;
      return `M ${start.x} ${start.y} H ${mid} V ${end.y} H ${end.x}`;
    }
    const mid = start.y + (end.y - start.y) / 2;
    return `M ${start.x} ${start.y} V ${mid} H ${end.x} V ${end.y}`;
  }

  function ensureOverlay(world) {
    if (world === lastWorld && overlay?.isConnected) return overlay;
    lastWorld = world;
    overlay = world.querySelector('[data-dynamic-wires]');
    if (!overlay) {
      overlay = makeSvg('svg', { 'data-dynamic-wires':'true', class:'dynamic-wires', preserveAspectRatio:'none' });
      Object.assign(overlay.style, { position:'absolute', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'3', overflow:'visible' });
      world.prepend(overlay);
    }
    const fixed = world.querySelector('svg.wires');
    if (fixed) fixed.style.display = 'none';
    return overlay;
  }

  function draw() {
    scheduled = false;
    const world = document.querySelector('.schematic .world');
    if (!world) { overlay = null; lastWorld = null; return; }
    const svg = ensureOverlay(world);
    svg.setAttribute('viewBox', `0 0 ${Math.max(1,world.clientWidth)} ${Math.max(1,world.clientHeight)}`);
    svg.replaceChildren();

    for (const c of liveConnections()) {
      const from = byRef(world, c.from), to = byRef(world, c.to);
      if (!from || !to) continue;
      const { a, b, axis } = anchors(from, to);
      const d = path(a,b,axis);
      const wire = makeSvg('path', { d, fill:'none', stroke:'#58d7c0', 'stroke-width':'2', 'stroke-linecap':'square', 'stroke-linejoin':'miter', 'vector-effect':'non-scaling-stroke', 'data-net':c.id });
      const start = makeSvg('circle', { cx:a.x, cy:a.y, r:'3.2', fill:'#09131c', stroke:'#71e3cf', 'stroke-width':'1.5', 'vector-effect':'non-scaling-stroke' });
      const end = makeSvg('circle', { cx:b.x, cy:b.y, r:'3.2', fill:'#09131c', stroke:'#71e3cf', 'stroke-width':'1.5', 'vector-effect':'non-scaling-stroke' });
      svg.append(wire,start,end);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(draw);
  }

  document.addEventListener('pointermove', schedule, {passive:true});
  document.addEventListener('pointerup', schedule, {passive:true});
  document.addEventListener('click', () => setTimeout(schedule,0), {passive:true});
  window.addEventListener('resize', schedule, {passive:true});

  const observer = new MutationObserver(() => schedule());
  const start = () => {
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();

  window.PCBProWireEngine = { version:VERSION, liveNets, liveConnections, redraw:schedule };
})();
