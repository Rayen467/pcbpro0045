(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const CONNECTIONS = [
    { id: 'VCC', from: 'V1', to: 'R2' },
    { id: 'LED_A', from: 'R2', to: 'D3' },
    { id: 'RETURN', from: 'D3', to: 'G4' },
    { id: 'GND', from: 'G4', to: 'V1' }
  ];

  let scheduled = false;
  let lastWorld = null;
  let overlay = null;

  const byRef = (world, ref) => {
    for (const node of world.querySelectorAll('.node')) {
      if (node.querySelector('.ref')?.textContent?.trim() === ref) return node;
    }
    return null;
  };

  const center = (node) => ({
    x: node.offsetLeft,
    y: node.offsetTop,
    w: node.offsetWidth,
    h: node.offsetHeight
  });

  function anchors(aNode, bNode) {
    const a = center(aNode);
    const b = center(bNode);
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0
        ? {
            a: { x: a.x + a.w / 2, y: a.y },
            b: { x: b.x - b.w / 2, y: b.y },
            axis: 'x'
          }
        : {
            a: { x: a.x - a.w / 2, y: a.y },
            b: { x: b.x + b.w / 2, y: b.y },
            axis: 'x'
          };
    }

    return dy >= 0
      ? {
          a: { x: a.x, y: a.y + a.h / 2 },
          b: { x: b.x, y: b.y - b.h / 2 },
          axis: 'y'
        }
      : {
          a: { x: a.x, y: a.y - a.h / 2 },
          b: { x: b.x, y: b.y + b.h / 2 },
          axis: 'y'
        };
  }

  function orthogonalPath(start, end, axis) {
    if (axis === 'x') {
      const midX = start.x + (end.x - start.x) / 2;
      return `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
    }
    const midY = start.y + (end.y - start.y) / 2;
    return `M ${start.x} ${start.y} V ${midY} H ${end.x} V ${end.y}`;
  }

  function makeSvg(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  }

  function ensureOverlay(world) {
    if (lastWorld === world && overlay?.isConnected) return overlay;

    lastWorld = world;
    overlay = world.querySelector('[data-dynamic-wires]');
    if (!overlay) {
      overlay = makeSvg('svg', {
        'data-dynamic-wires': 'true',
        class: 'dynamic-wires',
        preserveAspectRatio: 'none'
      });
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '3';
      overlay.style.overflow = 'visible';
      world.prepend(overlay);
    }

    const fixed = world.querySelector('svg.wires');
    if (fixed) fixed.style.display = 'none';
    return overlay;
  }

  function draw() {
    scheduled = false;
    const world = document.querySelector('.schematic .world');
    if (!world) {
      lastWorld = null;
      overlay = null;
      return;
    }

    const svg = ensureOverlay(world);
    const width = Math.max(1, world.clientWidth);
    const height = Math.max(1, world.clientHeight);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();

    for (const connection of CONNECTIONS) {
      const from = byRef(world, connection.from);
      const to = byRef(world, connection.to);
      if (!from || !to) continue;

      const { a, b, axis } = anchors(from, to);
      const path = makeSvg('path', {
        d: orthogonalPath(a, b, axis),
        fill: 'none',
        stroke: '#58d7c0',
        'stroke-width': '2',
        'stroke-linecap': 'square',
        'stroke-linejoin': 'miter',
        'vector-effect': 'non-scaling-stroke',
        'data-net': connection.id
      });

      const hit = makeSvg('path', {
        d: path.getAttribute('d'),
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': '12',
        'vector-effect': 'non-scaling-stroke'
      });

      const startPin = makeSvg('circle', {
        cx: a.x,
        cy: a.y,
        r: '3.2',
        fill: '#09131c',
        stroke: '#71e3cf',
        'stroke-width': '1.5',
        'vector-effect': 'non-scaling-stroke'
      });

      const endPin = makeSvg('circle', {
        cx: b.x,
        cy: b.y,
        r: '3.2',
        fill: '#09131c',
        stroke: '#71e3cf',
        'stroke-width': '1.5',
        'vector-effect': 'non-scaling-stroke'
      });

      svg.append(hit, path, startPin, endPin);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(draw);
  }

  document.addEventListener('pointermove', schedule, { passive: true });
  document.addEventListener('pointerup', schedule, { passive: true });
  document.addEventListener('pointerdown', () => setTimeout(schedule, 0), { passive: true });
  document.addEventListener('click', () => setTimeout(schedule, 0), { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.type === 'childList')) schedule();
  });

  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();
    setInterval(schedule, 750);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
