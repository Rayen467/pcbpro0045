<script>
  import { onMount } from 'svelte';
  import { parseProject, MAX_PROJECT_BYTES } from '$lib/project.js';

  /**
   * @typedef {Object} CatalogPart
   * @property {string} key
   * @property {string} prefix
   * @property {string} code
   * @property {string} name
   * @property {string} value
   * @property {string} group
   * @property {string} footprint
   * @property {number | null} [pinCount]
   * @property {string} [kind]
   * @property {string} [manufacturer]
   * @property {string} [mpn]
   * @property {string[]} [tags]
   * @property {string} [description]
   */
  /**
   * @typedef {Object} ProjectComponent
   * @property {string} id
   * @property {string} code
   * @property {string} name
   * @property {string} value
   * @property {string} footprint
   * @property {string} [catalogKey]
   * @property {string} [group]
   * @property {number | null} [pinCount]
   * @property {string} [kind]
   * @property {string} [manufacturer]
   * @property {string} [mpn]
   * @property {string[]} [tags]
   * @property {string} [description]
   * @property {number} sx
   * @property {number} sy
   * @property {number} px
   * @property {number} py
   * @property {number} rot
   */
  /**
   * @typedef {Object} UiState
   * @property {string} [activeView]
   * @property {string} [activeTool]
   * @property {string} [activeLayer]
   * @property {string} [leftTab]
   * @property {boolean} [leftOpen]
   * @property {boolean} [rightOpen]
   * @property {number} [leftWidth]
   * @property {number} [rightWidth]
   * @property {number} [zoom]
   * @property {number} [panX]
   * @property {number} [panY]
   * @property {number} [grid]
   * @property {boolean} [snapEnabled]
   * @property {string} [selectedId]
   */

  const version = '1.22.0';
  /** @type {HTMLInputElement | undefined} */
  let importInput;
  let savedContent = '';
  let projectDisplayName = 'LED Driver · Rev A';
  let dirty = false;
  $: dirty = JSON.stringify(components) !== savedContent;
  const views = ['Schematic', 'PCB', 'Simulator', '3D', 'BOM', 'Fabrication', 'Rules', 'Release'];
  const menus = ['File', 'Edit', 'View', 'Place', 'Route', 'Inspect', 'Tools', 'Manufacture'];
  /** @type {Record<string, string[]>} */
  const toolsets = {
    Schematic: ['Select', 'Place', 'Wire', 'Bus', 'Net label', 'Junction', 'No connect', 'Power', 'Pan', 'Measure', 'Annotate'],
    PCB: ['Select', 'Route', 'Via', 'Zone', 'Keepout', 'Dimension', 'Pan', 'Measure', 'Tune', 'Layer swap', 'Ratsnest'],
    Simulator: ['Run', 'Stop', 'Probe', 'Cursor A', 'Cursor B', 'Trace', 'Measure'],
    '3D': ['Orbit', 'Pan', 'Zoom', 'Measure', 'Section', 'Explode', 'Reset'],
    BOM: ['Refresh', 'Group', 'MPN', 'Supplier', 'Cost', 'Export CSV'],
    Fabrication: ['Preflight', 'Gerber', 'Drill', 'Pick & Place', 'Assembly', 'Archive'],
    Rules: ['Electrical', 'Clearance', 'Track width', 'Via', 'Differential', 'Mask', 'Silkscreen'],
    Release: ['Snapshot', 'Compare', 'Tag', 'Notes', 'Package']
  };

  /** @type {CatalogPart[]} */
  const coreLibrary = [
    { key: 'dc', prefix: 'V', code: 'V', name: 'DC Source', value: '5 V', group: 'Sources', footprint: 'TerminalBlock_2P', pinCount: 2 },
    { key: 'r', prefix: 'R', code: 'R', name: 'Resistor', value: '330 Ω', group: 'Passives', footprint: 'R_0805', pinCount: 2 },
    { key: 'c', prefix: 'C', code: 'C', name: 'Capacitor', value: '1 µF', group: 'Passives', footprint: 'C_0805', pinCount: 2 },
    { key: 'l', prefix: 'L', code: 'L', name: 'Inductor', value: '10 µH', group: 'Passives', footprint: 'L_0805', pinCount: 2 },
    { key: 'd', prefix: 'D', code: 'D', name: 'Diode', value: '1N4148', group: 'Semiconductors', footprint: 'SOD-123', pinCount: 2 },
    { key: 'led', prefix: 'D', code: 'LED', name: 'LED', value: 'Red 2 V', group: 'Semiconductors', footprint: 'LED_0603', pinCount: 2 },
    { key: 'q', prefix: 'Q', code: 'Q', name: 'N-MOSFET', value: '2N7002', group: 'Semiconductors', footprint: 'SOT-23', pinCount: 3 },
    { key: 'u', prefix: 'U', code: 'U', name: 'Op-Amp', value: 'LM358', group: 'IC', footprint: 'SOIC-8', pinCount: 8 },
    { key: 'sw', prefix: 'SW', code: 'SW', name: 'Switch', value: 'SPST', group: 'Input', footprint: 'SW_THT', pinCount: 2 },
    { key: 'j', prefix: 'J', code: 'J', name: 'Connector', value: '2 Pin', group: 'Connectors', footprint: 'HDR_1x02', pinCount: 2 },
    { key: 'gnd', prefix: 'G', code: 'GND', name: 'Ground', value: '0 V', group: 'Power', footprint: '—', pinCount: 1 },
    { key: 'tp', prefix: 'TP', code: 'TP', name: 'Test Point', value: 'TP', group: 'Debug', footprint: 'TestPoint_1mm', pinCount: 1 }
  ];

  /** @type {CatalogPart[]} */
  let library = [...coreLibrary];
  let libraryGroup = 'All';
  let libraryLimit = 220;
  let catalogLoaded = false;
  let catalogSummary = { total: coreLibrary.length, groups: [] };

  async function loadExtendedCatalog() {
    try {
      if (!window['PCBProComponentCatalog']) {
        await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-pcbpro-catalog-v116]');
          if (existing) {
            if (window['PCBProComponentCatalog']) return resolve();
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Component catalog failed to load')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = '/component-catalog-v116.js?v=1.16.0';
          script.dataset.pcbproCatalogV116 = '1';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Component catalog failed to load'));
          document.head.appendChild(script);
        }));
      }
      const api = window['PCBProComponentCatalog'];
      const extra = /** @type {CatalogPart[]} */ (Array.isArray(api?.build?.()) ? api.build() : []);
      const keys = new Set(coreLibrary.map((p) => p.key));
      library = [...coreLibrary, ...extra.filter((p) => p?.key && !keys.has(p.key))];
      catalogSummary = api?.summary?.() || { total: library.length, groups: [] };
      catalogLoaded = true;
      window.dispatchEvent(new CustomEvent('pcbpro:catalog-ready', { detail: { ...catalogSummary, libraryTotal: library.length } }));
    } catch (error) {
      console.warn('Extended component catalog unavailable', error);
      catalogLoaded = false;
    }
  }

  let activeView = 'Schematic';
  let activeTool = 'Select';
  let activeLayer = 'F.Cu';
  let leftTab = 'Library';
  let projectTreeOpen = true;
  let leftOpen = true;
  let rightOpen = true;
  let leftWidth = 258;
  let rightWidth = 282;
  let query = '';
  let selectedId = 'R2';
  let consoleOpen = true;
  let toast = '';
  let savedAt = 'Unsaved';
  let zoom = 100;
  let panX = 0;
  let panY = 0;
  let grid = 10;
  let snapEnabled = true;
  /** @type {string | number} */
  let drcFindings = 'Not run';
  let routed = false;
  let boardTrackCount = 0;
  let placementId = '';
  let spaceHeld = false;
  /** @type {Record<string, boolean>} */
  let layerVisibility = { 'F.Cu': true, 'B.Cu': true, 'F.Silk': true, 'Edge.Cuts': true, Ratsnest: true };

  /** @type {ProjectComponent[]} */
  let components = [
    { id: 'V1', code: 'V', name: 'DC Source', value: '5 V', footprint: 'TerminalBlock_2P', pinCount: 2, sx: 18, sy: 52, px: 18, py: 57, rot: 0 },
    { id: 'R2', code: 'R', name: 'Resistor', value: '330 Ω', footprint: 'R_0805', pinCount: 2, sx: 47, sy: 29, px: 45, py: 29, rot: 0 },
    { id: 'D3', code: 'LED', name: 'LED', value: 'Red 2 V', footprint: 'LED_0603', pinCount: 2, sx: 78, sy: 51, px: 76, py: 60, rot: 0 },
    { id: 'G4', code: 'GND', name: 'Ground', value: '0 V', footprint: '—', pinCount: 1, sx: 49, sy: 74, px: 50, py: 76, rot: 0 }
  ];

  /** @type {Array<{name:string,pins:string}>} */
  let nets = [];

  /** @type {{part: (typeof library)[number], pointerId: number, startX: number, startY: number, x: number, y: number, moved: boolean} | null} */
  let libraryDrag = null;
  /** @type {{id: string, surface: string, stage: HTMLElement, element: HTMLElement, pointerId: number, offsetX: number, offsetY: number, x: number, y: number} | null} */
  let nodeDrag = null;
  /** @type {{pointerId: number, startX: number, startY: number, baseX: number, baseY: number} | null} */
  let panDrag = null;
  /** @type {{side: string, pointerId: number, startX: number, left: number, right: number} | null} */
  let resizeDrag = null;
  /** @type {HTMLDivElement | undefined} */
  let dragGhostEl;
  let rafId = 0;
  /** @type {{x: number, y: number, pointerId: number, altKey: boolean} | null} */
  let pendingPointer = null;
  /** @type {string[]} */
  let undoStack = [];
  /** @type {string[]} */
  let redoStack = [];

  $: libraryGroups = ['All', ...Array.from(new Set(library.map((part) => part.group))).sort()];
  $: matchingParts = library.filter((part) => {
    const inGroup = libraryGroup === 'All' || part.group === libraryGroup;
    const haystack = `${part.code} ${part.name} ${part.value} ${part.group} ${part.mpn || ''} ${part.manufacturer || ''} ${(part.tags || []).join(' ')}`.toLowerCase();
    return inGroup && haystack.includes(query.toLowerCase());
  });
  $: filteredTotal = matchingParts.length;
  $: filteredParts = matchingParts.slice(0, libraryLimit);
  $: selected = components.find((part) => part.id === selectedId) || null;
  $: pcbParts = components.filter((part) => part.footprint && part.footprint !== '—');
  $: currentTools = toolsets[activeView] || [];
  $: isInteracting = Boolean(libraryDrag || nodeDrag || panDrag || resizeDrag);

  onMount(() => {
    loadExtendedCatalog();
    savedContent = JSON.stringify(components);
    try {
      const raw = localStorage.getItem('pcbpro0045-project-v11') || localStorage.getItem('pcbpro0045-project');
      if (raw) {
        const saved = parseProject(raw);
        components = saved.components;
        savedContent = JSON.stringify(components);
        savedAt = 'Restored locally';
        leftWidth = saved.leftWidth;
        rightWidth = saved.rightWidth;
      }
    } catch (error) {
      console.warn('Restore skipped', error);
      notify('Saved project could not be restored. Import a valid backup.');
    }

    window.PCBProProject = Object.assign(window.PCBProProject || {}, {
      getComponents: () => structuredClone(components),
      replaceComponents: (/** @type {ProjectComponent[]} */ next) => {
        if (!Array.isArray(next)) return false;
        components = structuredClone(next);
        selectedId = components[0]?.id || '';
        placementId = '';
        savedContent = JSON.stringify(components);
        return true;
      },
      getUiState: () => ({
        activeView, activeTool, activeLayer, leftTab, leftOpen, rightOpen,
        leftWidth, rightWidth, zoom, panX, panY, grid, snapEnabled, selectedId
      }),
      setUiState: (/** @type {UiState} */ state = {}) => {
        if (typeof state.activeView === 'string' && views.includes(state.activeView)) activeView = state.activeView;
        if (typeof state.activeTool === 'string') activeTool = state.activeTool;
        if (typeof state.activeLayer === 'string') activeLayer = state.activeLayer;
        if (typeof state.leftTab === 'string') leftTab = state.leftTab;
        if (typeof state.leftOpen === 'boolean') leftOpen = state.leftOpen;
        if (typeof state.rightOpen === 'boolean') rightOpen = state.rightOpen;
        if (Number.isFinite(Number(state.leftWidth))) leftWidth = Number(state.leftWidth);
        if (Number.isFinite(Number(state.rightWidth))) rightWidth = Number(state.rightWidth);
        if (Number.isFinite(Number(state.zoom))) zoom = Number(state.zoom);
        if (Number.isFinite(Number(state.panX))) panX = Number(state.panX);
        if (Number.isFinite(Number(state.panY))) panY = Number(state.panY);
        if (Number.isFinite(Number(state.grid))) grid = Number(state.grid);
        if (typeof state.snapEnabled === 'boolean') snapEnabled = state.snapEnabled;
        if (typeof state.selectedId === 'string') selectedId = state.selectedId;
        return true;
      }
    });
    try {
      projectDisplayName = localStorage.getItem('pcbpro0045-cloud-project-name') || projectDisplayName;
    } catch {}

    /** @param {Event} event */
    const onNetlist = (event) => {
      const next = /** @type {CustomEvent} */ (event).detail?.nets;
      if (Array.isArray(next)) nets = next.map((net) => ({ name: String(net.name || ''), pins: String(net.pins || '') }));
    };
    const onBoard = () => { boardTrackCount = window.PCBProBoardModel?.tracks?.length || 0; };
    window.addEventListener('pcbpro:netlist-changed', onNetlist);
    window.addEventListener('pcbpro:board-changed', onBoard);
    setTimeout(onBoard, 120);
    window.dispatchEvent(new CustomEvent('pcbpro:project-adapter-ready'));
    return () => {
      window.removeEventListener('pcbpro:netlist-changed', onNetlist);
      window.removeEventListener('pcbpro:board-changed', onBoard);
    };
  });

  /** @param {number} min @param {number} value @param {number} max */
  function clamp(min, value, max) { return Math.max(min, Math.min(max, value)); }
  /** @param {number} value */
  function snap(value, bypass = false) { return !snapEnabled || bypass ? value : Math.round(value * 2) / 2; }

  let toastTimer = 0;
  /** @param {string} message */
  function notify(message) {
    toast = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast = ''), 1800);
  }

  function snapshot() {
    undoStack = [...undoStack.slice(-39), JSON.stringify(components)];
    redoStack = [];
  }

  function undo() {
    if (!undoStack.length) return notify('Nothing to undo');
    redoStack = [...redoStack, JSON.stringify(components)];
    components = JSON.parse(undoStack[undoStack.length - 1]);
    undoStack = undoStack.slice(0, -1);
    selectedId = components.some((p) => p.id === selectedId) ? selectedId : (components[0]?.id || '');
  }

  function redo() {
    if (!redoStack.length) return notify('Nothing to redo');
    undoStack = [...undoStack, JSON.stringify(components)];
    components = JSON.parse(redoStack[redoStack.length - 1]);
    redoStack = redoStack.slice(0, -1);
  }

  /** @param {string} prefix */
  function nextRef(prefix) {
    const nums = components.filter((p) => p.id.startsWith(prefix)).map((p) => Number(p.id.slice(prefix.length))).filter(Number.isFinite);
    return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`;
  }

  /** @param {(typeof library)[number]} part */
  function makePart(part, x = 50, y = 50, surface = 'schematic', armPlacement = false) {
    snapshot();
    const id = nextRef(part.prefix);
    const created = {
      id, code: part.code, name: part.name, value: part.value, footprint: part.footprint,
      catalogKey: part.key || '', group: part.group || '', pinCount: part.pinCount == null ? null : Number(part.pinCount),
      kind: part.kind || 'template', manufacturer: part.manufacturer || '', mpn: part.mpn || '',
      tags: Array.isArray(part.tags) ? [...part.tags] : [], description: part.description || '',
      sx: surface === 'schematic' ? x : 50, sy: surface === 'schematic' ? y : 50,
      px: surface === 'pcb' ? x : 50, py: surface === 'pcb' ? y : 50, rot: 0
    };
    components = [...components, created];
    selectedId = id;
    placementId = armPlacement ? id : '';
    notify(armPlacement ? `${id} added · click workspace to place` : `${id} placed`);
  }

  /** @param {number} clientX @param {number} clientY @param {HTMLElement} stage */
  function pointToPercent(clientX, clientY, stage, bypassSnap = false) {
    const rect = stage.getBoundingClientRect();
    const scale = zoom / 100;
    const worldX = (clientX - rect.left - panX) / scale;
    const worldY = (clientY - rect.top - panY) / scale;
    return {
      x: clamp(3, snap((worldX / rect.width) * 100, bypassSnap), 97),
      y: clamp(5, snap((worldY / rect.height) * 100, bypassSnap), 95)
    };
  }

  /** @param {string} id @param {string} surface @param {number} x @param {number} y */
  function updatePartPosition(id, surface, x, y) {
    components = components.map((p) => p.id === id
      ? { ...p, [surface === 'pcb' ? 'px' : 'sx']: x, [surface === 'pcb' ? 'py' : 'sy']: y }
      : p);
  }

  /** @param {PointerEvent} event @param {(typeof library)[number]} part */
  function startLibraryPointer(event, part) {
    if (event.button !== 0) return;
    event.preventDefault();
    libraryDrag = { part, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false };
  }

  /** @param {PointerEvent} event @param {string} id @param {string} surface */
  function startNodeDrag(event, id, surface) {
    if (event.button !== 0 || spaceHeld || !['Select', 'Place'].includes(activeTool)) return;
    event.preventDefault();
    event.stopPropagation();
    const element = /** @type {HTMLElement} */ (event.currentTarget);
    const stage = /** @type {HTMLElement | null} */ (element.closest('[data-surface]'));
    const part = components.find((p) => p.id === id);
    if (!stage || !part) return;
    snapshot();
    selectedId = id;
    placementId = '';
    const pointer = pointToPercent(event.clientX, event.clientY, stage, event.altKey);
    const currentX = surface === 'pcb' ? part.px : part.sx;
    const currentY = surface === 'pcb' ? part.py : part.sy;
    nodeDrag = {
      id, surface, stage, element, pointerId: event.pointerId,
      offsetX: currentX - pointer.x, offsetY: currentY - pointer.y, x: currentX, y: currentY
    };
    (/** @type {HTMLElement} */ (event.currentTarget)).setPointerCapture?.(event.pointerId);
  }

  /** @param {PointerEvent} event @param {string} surface */
  function stagePointerDown(event, surface) {
    if (event.button === 1 || spaceHeld || activeTool === 'Pan') {
      event.preventDefault();
      panDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseX: panX, baseY: panY };
      (/** @type {HTMLElement} */ (event.currentTarget)).setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    if (placementId) {
      const point = pointToPercent(event.clientX, event.clientY, /** @type {HTMLElement} */ (event.currentTarget), event.altKey);
      snapshot();
      updatePartPosition(placementId, surface, point.x, point.y);
      placementId = '';
      return;
    }
    if (!(/** @type {Element} */ (event.target)).closest('.node,.footprint,.layer-strip,.floating-card')) selectedId = '';
  }

  /** @param {PointerEvent} event @param {string} side */
  function startResize(event, side) {
    event.preventDefault();
    resizeDrag = { side, pointerId: event.pointerId, startX: event.clientX, left: leftWidth, right: rightWidth };
    (/** @type {HTMLElement} */ (event.currentTarget)).setPointerCapture?.(event.pointerId);
  }

  /** @param {PointerEvent} event */
  function handleGlobalPointerMove(event) {
    if (!libraryDrag && !nodeDrag && !panDrag && !resizeDrag) return;
    pendingPointer = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, altKey: event.altKey };
    if (!rafId) rafId = requestAnimationFrame(flushPointerFrame);
  }

  function flushPointerFrame() {
    rafId = 0;
    const p = pendingPointer;
    if (!p) return;

    if (libraryDrag && p.pointerId === libraryDrag.pointerId) {
      const moved = libraryDrag.moved || Math.hypot(p.x - libraryDrag.startX, p.y - libraryDrag.startY) > 5;
      libraryDrag = { ...libraryDrag, x: p.x, y: p.y, moved };
      if (dragGhostEl) dragGhostEl.style.transform = `translate3d(${p.x + 14}px,${p.y + 14}px,0)`;
    }

    if (nodeDrag && p.pointerId === nodeDrag.pointerId) {
      const point = pointToPercent(p.x, p.y, nodeDrag.stage, p.altKey);
      const x = clamp(3, point.x + nodeDrag.offsetX, 97);
      const y = clamp(5, point.y + nodeDrag.offsetY, 95);
      nodeDrag.x = x;
      nodeDrag.y = y;
      nodeDrag.element.style.left = `${x}%`;
      nodeDrag.element.style.top = `${y}%`;
    }

    if (panDrag && p.pointerId === panDrag.pointerId) {
      panX = panDrag.baseX + p.x - panDrag.startX;
      panY = panDrag.baseY + p.y - panDrag.startY;
    }

    if (resizeDrag && p.pointerId === resizeDrag.pointerId) {
      const dx = p.x - resizeDrag.startX;
      if (resizeDrag.side === 'left') leftWidth = clamp(190, resizeDrag.left + dx, 430);
      else rightWidth = clamp(220, resizeDrag.right - dx, 430);
    }
  }

  /** @param {PointerEvent} event */
  function handleGlobalPointerUp(event) {
    if (rafId) cancelAnimationFrame(rafId);
    pendingPointer = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, altKey: event.altKey };
    flushPointerFrame();
    pendingPointer = null;
    if (libraryDrag && event.pointerId === libraryDrag.pointerId) {
      const d = libraryDrag;
      libraryDrag = null;
      if (!d.moved) {
        makePart(d.part, 50, 50, activeView === 'PCB' ? 'pcb' : 'schematic', true);
      } else {
        const hit = /** @type {HTMLElement | null | undefined} */ (document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-surface]'));
        if (hit) {
          const surface = hit.dataset.surface || 'schematic';
          const point = pointToPercent(event.clientX, event.clientY, hit, event.altKey);
          makePart(d.part, point.x, point.y, surface, false);
        } else notify('Drop inside Schematic or PCB workspace');
      }
    }

    if (nodeDrag && event.pointerId === nodeDrag.pointerId) {
      updatePartPosition(nodeDrag.id, nodeDrag.surface, nodeDrag.x, nodeDrag.y);
      nodeDrag = null;
    }
    if (panDrag && event.pointerId === panDrag.pointerId) panDrag = null;
    if (resizeDrag && event.pointerId === resizeDrag.pointerId) resizeDrag = null;
  }

  /** @param {WheelEvent} event */
  function zoomWheel(event) {
    event.preventDefault();
    const stage = /** @type {HTMLElement} */ (event.currentTarget);
    const rect = stage.getBoundingClientRect();
    const oldScale = zoom / 100;
    const nextZoom = Math.round(clamp(35, zoom * (event.deltaY < 0 ? 1.1 : 0.9), 300));
    const nextScale = nextZoom / 100;
    const vx = event.clientX - rect.left;
    const vy = event.clientY - rect.top;
    const wx = (vx - panX) / oldScale;
    const wy = (vy - panY) / oldScale;
    panX = vx - wx * nextScale;
    panY = vy - wy * nextScale;
    zoom = Math.round(nextZoom);
  }

  function fitView() { zoom = 100; panX = 0; panY = 0; }

  /** @param {'value' | 'footprint'} field @param {string} value */
  function updateSelected(field, value) {
    if (!selected) return;
    snapshot();
    components = components.map((p) => p.id === selectedId ? { ...p, [field]: value } : p);
  }

  function rotateSelected() {
    if (!selected) return;
    snapshot();
    components = components.map((p) => p.id === selectedId ? { ...p, rot: (p.rot + 90) % 360 } : p);
  }

  function deleteSelected() {
    if (!selected) return;
    snapshot();
    const ref = selectedId;
    for (const route of window.PCBProWireEngine?.routes || []) {
      if (String(route.from).startsWith(`${ref}.`) || String(route.to).startsWith(`${ref}.`)) window.PCBProProject?.deleteWire?.(route.id);
    }
    for (const track of window.PCBProBoardModel?.tracks || []) {
      if (String(track.from).startsWith(`${ref}.`) || String(track.to).startsWith(`${ref}.`)) window.PCBProBoardModel?.deleteTrack?.(track.id);
    }
    components = components.filter((p) => p.id !== ref);
    selectedId = components[0]?.id || '';
    window.dispatchEvent(new CustomEvent('pcbpro:project-components-changed', { detail: { action:'delete', ref } }));
  }

  /** @param {string} view */
  function selectView(view) {
    activeView = view;
    activeTool = toolsets[view]?.[0] || 'Select';
    placementId = '';
    if (!['Schematic', 'PCB'].includes(view)) fitView();
  }

  /** @param {string} view */
  function openProjectView(view) {
    leftOpen = true;
    leftTab = 'Project';
    selectView(view);
  }

  function saveProject() {
    try {
      const timestamp = `Saved ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
      localStorage.setItem('pcbpro0045-project-v11', JSON.stringify({ version, components, savedAt: timestamp, leftWidth, rightWidth }));
      savedContent = JSON.stringify(components);
      savedAt = timestamp;
      window.dispatchEvent(new CustomEvent('pcbpro:project-local-saved', { detail: { source: 'save-button', at: timestamp } }));
      notify('Project saved locally · cloud sync queued');
    } catch {
      notify('Save failed. Export a JSON backup to keep your work.');
    }
  }

  /** @param {Event} event */
  async function importProject(event) {
    const input = /** @type {HTMLInputElement} */ (event.currentTarget);
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 2 MB limit.');
      const project = parseProject(await file.text());
      if (!window.confirm('Import this component layout? This replaces components and clears all current wiring and PCB geometry. Export your full project from File first if needed.')) return;
      const reset = new CustomEvent('pcbpro:reset-layout', { cancelable: true });
      window.dispatchEvent(reset);
      if (!reset.defaultPrevented) throw new Error('Project engines are not ready. Please retry shortly.');
      cancelInteraction();
      undoStack = [];
      redoStack = [];
      selectView('Schematic');
      components = project.components;
      selectedId = components[0]?.id || '';
      placementId = '';
      fitView();
      notify('Component layout imported. Save to keep it in this browser.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      input.value = '';
    }
  }

  function cancelInteraction() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    pendingPointer = null;
    if (nodeDrag) {
      const part = components.find((p) => p.id === nodeDrag?.id);
      if (part) {
        nodeDrag.element.style.left = `${nodeDrag.surface === 'pcb' ? part.px : part.sx}%`;
        nodeDrag.element.style.top = `${nodeDrag.surface === 'pcb' ? part.py : part.sy}%`;
      }
    }
    libraryDrag = null;
    nodeDrag = null;
    panDrag = null;
    resizeDrag = null;
    spaceHeld = false;
  }

  /** @param {BeforeUnloadEvent} event */
  function beforeUnload(event) {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  /** @param {string} name @param {string} content */
  function download(name, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }

  function exportProject() { download('pcbpro0045-layout.json', JSON.stringify({ format: 'pcbpro0045-component-layout', version, components }, null, 2)); }
  function exportBom() {
    const rows = [['Ref','Part','Value','Footprint'], ...components.map((p) => [p.id,p.name,p.value,p.footprint])];
    download('pcbpro0045-bom.csv', rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'), 'text/csv');
  }

  function newProject() {
    if (!window.confirm('Create a new empty PCB project? The current project remains in encrypted database/history if it has been synced.')) return;
    try {
      localStorage.setItem('pcbpro0045-project-v11', JSON.stringify({ version, components:[], savedAt:'New project', leftWidth, rightWidth }));
      localStorage.setItem('pcbpro0045-cloud-create-new', '1');
      localStorage.setItem('pcbpro0045-cloud-project-name', 'Untitled PCB');
      window.dispatchEvent(new CustomEvent('pcbpro:reset-layout', { cancelable:true }));
      location.reload();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not create project.');
    }
  }

  function runErc() {
    const raw = window.PCBProWorkflow?.runErc?.();
    if (!Array.isArray(raw)) {
      notify('ERC engine is still loading. Try again in a moment.');
      return [];
    }
    notify(raw.length ? `ERC: ${raw.length} finding(s)` : 'ERC passed for the checks currently implemented.');
    return raw;
  }

  function runDrc() {
    const hasBase = typeof window.PCBProBoardModel?.drc === 'function';
    const hasAdvanced = typeof window.PCBProAdvancedBoard?.drc === 'function';
    if (!hasBase && !hasAdvanced) {
      drcFindings = 'Loading';
      notify('PCB DRC engines are still loading.');
      return [];
    }
    const physical = window.PCBProPhysicalDRC?.run?.();
    const physicalFindings = /** @type {Array<{severity:string,message:string}>} */ (physical?.findings || []);
    const findings = [
      ...(hasBase ? (window.PCBProBoardModel.drc() || []) : []),
      ...(hasAdvanced ? (window.PCBProAdvancedBoard.drc() || []) : []),
      ...((physical?.calibrated ? physicalFindings.filter((x) => x.severity === 'error' || x.severity === 'blocker').map((x) => x.message) : []))
    ];
    drcFindings = findings.length;
    const physicalNote = physical?.calibrated ? ' · physical mm checks included' : ' · physical mm checks unresolved until board dimensions are set';
    notify(findings.length ? `DRC: ${findings.length} finding(s)${physicalNote}` : `DRC passed for the implemented checks${physicalNote}.`);
    return findings;
  }

  function runSimulation() {
    selectView('Simulator');
    setTimeout(async () => {
      if (window.PCBProCommandBus?.execute) {
        const result = await window.PCBProCommandBus.execute('simulation.run', {});
        if (!result?.ok) notify(`Simulator unavailable: ${result?.error || 'solver not ready'}`);
        return;
      }
      if (window.PCBProLiveSimulation?.start) window.PCBProLiveSimulation.start();
      else notify('Live Circuit solver is loading. Try Run again in a moment.');
    }, 80);
  }

  /** @param {string} tool */
  function toolAction(tool) {
    activeTool = tool;
    if (tool === 'Export CSV') exportBom();
    if (tool === 'Run') runSimulation();
    if (tool === 'Stop') window.PCBProCommandBus?.execute?.('simulation.pause', {});
    if (tool === 'Preflight') activeView === 'Fabrication' ? window.PCBProManufacturing?.preflight?.() : runDrc();
    if (tool === 'Electrical') runErc();
    if (['Clearance','Track width','Via','Differential','Mask','Silkscreen'].includes(tool)) window.PCBProProfessional?.open?.('constraints');
    if (tool === 'Gerber') window.PCBProManufacturing?.downloadGerbers?.();
    if (tool === 'Drill') window.PCBProManufacturing?.downloadDrill?.();
    if (tool === 'Pick & Place') window.PCBProManufacturing?.downloadCpl?.();
    if (tool === 'Assembly') window.PCBProManufacturing?.downloadAssembly?.();
    if (tool === 'Archive') window.PCBProManufacturing?.buildPackage?.();
    if (tool === 'Zoom' && activeView === '3D') window.PCBProGeometry3D?.zoomBy?.(1.15);
    if (tool === 'Reset' && activeView === '3D') window.PCBProGeometry3D?.reset?.();
  }

  /** @param {KeyboardEvent} event */
  function handleKeyDown(event) {
    if (['input','textarea','select'].includes((/** @type {HTMLElement | null} */ (event.target))?.tagName?.toLowerCase() || '')) return;
    if (event.code === 'Space') { spaceHeld = true; event.preventDefault(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); return; }
    if (event.key === 'Delete') deleteSelected();
    if (event.key.toLowerCase() === 'r') rotateSelected();
    if (event.key.toLowerCase() === 'w') { activeView = 'Schematic'; activeTool = 'Wire'; }
    if (event.key.toLowerCase() === 'x') activeLayer = activeLayer === 'F.Cu' ? 'B.Cu' : 'F.Cu';
    if (event.key === 'Escape') { placementId = ''; cancelInteraction(); }
  }
  /** @param {KeyboardEvent} event */
  function handleKeyUp(event) { if (event.code === 'Space') spaceHeld = false; }
</script>

<svelte:window onpointermove={handleGlobalPointerMove} onpointerup={handleGlobalPointerUp} onpointercancel={cancelInteraction} onblur={cancelInteraction} onbeforeunload={beforeUnload} onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

<svelte:head>
  <title>PCB Pro 0045 — EDA Workspace</title>
  <meta name="description" content="PCB Pro engineering workspace for schematic capture, PCB layout, rules, BOM and fabrication." />
</svelte:head>

<div class:interacting={isInteracting} class="app">
  <header class="topbar">
    <div class="brand-group">
      <button class="icon-btn" onclick={() => leftOpen = !leftOpen}>☰</button>
      <div class="logo">⌁</div><div class="brand"><strong>PCB Pro</strong><span>0045</span></div>
      <span class="version">POINTER ENGINE · v{version}</span>
      <button class="project-pill" onclick={() => { leftOpen = true; leftTab = 'Project'; }} title="Open project panel"><i></i><b>{projectDisplayName}</b><span>⌄</span></button>
    </div>
    <div class="top-actions">
      <span class="save-state">{dirty ? 'Unsaved changes' : savedAt}</span>
      <button onclick={newProject}>New</button>
      <input hidden type="file" accept=".json,application/json" bind:this={importInput} onchange={importProject} aria-label="Import project JSON" />
      <button onclick={() => importInput?.click()}>Import layout</button>
      <button onclick={saveProject}>Save</button>
      <button onclick={exportProject}>Export layout</button>
      <button class="primary" onclick={runSimulation}>▶ Simulate</button>
      <button class="icon-btn" onclick={() => rightOpen = !rightOpen}>☷</button>
    </div>
  </header>

  <div class="menubar">
    <div class="menus">{#each menus as item}<button onclick={() => notify(`${item} command palette`)}>{item}</button>{/each}</div>
    <div class="workspace-state"><i></i> rAF pointer engine <span>•</span> Grid {grid} mil <span>•</span> {snapEnabled ? 'Snap ON' : 'Snap OFF'}</div>
  </div>

  <div class="shell" style={`--left:${leftOpen ? leftWidth : 0}px;--right:${rightOpen ? rightWidth : 0}px;--ls:${leftOpen ? 5 : 0}px;--rs:${rightOpen ? 5 : 0}px`}>
    <aside class="leftbar">
      <div class="side-tabs">{#each ['Library','Project','History'] as tab}<button class:active={leftTab===tab} onclick={() => leftTab=tab}>{tab}</button>{/each}</div>
      {#if leftTab === 'Library'}
        <div class="side-title"><div><span>COMPONENT LIBRARY</span><h2>Parts</h2></div><b>{library.length}</b></div>
        <label class="search"><span>⌕</span><input bind:value={query} placeholder="Search 1,000+ components" /></label>
        <div class="library-filter">
          <select bind:value={libraryGroup} aria-label="Component category">
            {#each libraryGroups as group}<option value={group}>{group}</option>{/each}
          </select>
          <span>{catalogLoaded ? `${filteredTotal} match` : 'Loading catalog…'}</span>
        </div>
        <div class="hint"><b>Click</b> → add then click workspace · <b>Drag</b> → precise place. Generic templates do not invent electrical ratings; exact MPN data still requires datasheet verification.</div>
        <div class="parts">
          {#each filteredParts as part}
            <button class="part" onpointerdown={(e) => startLibraryPointer(e, part)} title={part.description || part.name}>
              <span class="part-symbol">{part.code}</span><span class="part-copy"><b>{part.name}</b><small>{part.value} · {part.group}{part.mpn ? ` · ${part.mpn}` : ''}</small></span><em>＋</em>
            </button>
          {/each}
          {#if filteredTotal > filteredParts.length}
            <button class="load-more" onclick={() => libraryLimit += 250}>Load more · {filteredTotal-filteredParts.length} remaining</button>
          {/if}
        </div>
      {:else if leftTab === 'Project'}
        <div class="tree"><span>PROJECT TREE</span><button class="root" onclick={() => projectTreeOpen = !projectTreeOpen}>{projectTreeOpen ? '▾' : '▸'} ◫ {projectDisplayName}</button>{#if projectTreeOpen}<button class:active={activeView==='Schematic'} onclick={() => openProjectView('Schematic')}>⌁ Main schematic</button><button class:active={activeView==='PCB'} onclick={() => openProjectView('PCB')}>▦ Main PCB</button><button class:active={activeView==='3D'} onclick={() => openProjectView('3D')}>◈ 3D Assembly</button><button class:active={activeView==='BOM'} onclick={() => openProjectView('BOM')}>☷ BOM · {components.length}</button><button class:active={activeView==='Fabrication'} onclick={() => openProjectView('Fabrication')}>⬡ Fabrication</button>{/if}</div>
      {:else}
        <div class="history"><article><b>v1.1.0</b><strong>Smooth Pointer Engine</strong><p>rAF-batched pointer drag, direct DOM positioning, panel resize, pan/zoom, undo/redo.</p></article><article><b>v1.0.0</b><strong>PCB Pro baseline</strong><p>New repository and clean SvelteKit/Vercel baseline.</p></article></div>
      {/if}
    </aside>

    {#if leftOpen}<button class="splitter" aria-label="Resize library" onpointerdown={(e) => startResize(e,'left')}></button>{/if}

    <main class="workbench">
      <nav class="tabs">{#each views as view}<button class:active={activeView===view} onclick={() => selectView(view)}>{view}</button>{/each}</nav>
      <div class="toolbar-scroll"><div class="toolbar"><div class="tools">
        {#each currentTools as tool}<button class:active={activeTool===tool} onclick={() => toolAction(tool)}><span>{tool==='Select'?'↖':tool==='Pan'?'✥':tool==='Wire'||tool==='Route'?'⌁':tool==='Via'?'◉':tool==='Run'?'▶':'◇'}</span><small>{tool}</small></button>{/each}
      </div><div class="tool-right"><button onclick={undo}>↶ Undo</button><button onclick={redo}>↷ Redo</button><button onclick={() => snapEnabled=!snapEnabled}>Snap {snapEnabled?'ON':'OFF'}</button><button onclick={runDrc}>DRC {drcFindings}</button><button onclick={fitView}>Fit</button></div></div></div>

      <div class="content">
        {#if activeView === 'Schematic'}
          <section class:placing={Boolean(placementId)} class="stage schematic" aria-label="Schematic canvas" data-surface="schematic" onpointerdown={(e)=>stagePointerDown(e,'schematic')} onwheel={zoomWheel}>
            <div class="stage-info"><span>SCHEMATIC / MAIN</span><div><b>{zoom}%</b><b>{snapEnabled?'SNAP':'FREE'}</b><b>{spaceHeld?'PAN':''}</b></div></div>
            <div class="world" style={`transform:translate3d(${panX}px,${panY}px,0) scale(${zoom/100})`}>
              
              {#each components as part}
                <button class:selected={selectedId===part.id} class:pending={placementId===part.id} class="node" data-pin-count={part.pinCount == null ? '' : part.pinCount} data-catalog-key={part.catalogKey || ''} data-part-kind={part.kind || ''} style={`left:${part.sx}%;top:${part.sy}%;--rot:${part.rot}deg`} onpointerdown={(e)=>startNodeDrag(e,part.id,'schematic')}>
                  <span class="ref">{part.id}</span><div class="symbol">{part.code==='R'?'─[▰]─':part.code==='C'?'─│ │─':part.code==='GND'?'⏚':part.code==='LED'?'─▷│↗':part.code==='V'?'⊕':part.code}</div><b>{part.value}</b><small>{part.name}</small>
                </button>
              {/each}
            </div>
            <div class="stage-help"><span>Wheel: zoom</span><span>Space/middle: pan</span><span>Alt: bypass snap</span><span>Ctrl+Z/Y: undo/redo</span></div>
          </section>
        {:else if activeView === 'PCB'}
          <section class:placing={Boolean(placementId)} class="stage pcbstage" aria-label="PCB canvas" data-surface="pcb" onpointerdown={(e)=>stagePointerDown(e,'pcb')} onwheel={zoomWheel}>
            <div class="stage-info"><span>PCB / MAIN · {activeLayer}</span><div><b>{zoom}%</b><b>2 LAYER</b><b>FR-4</b></div></div>
            <div class="layer-strip">{#each ['F.Cu','B.Cu','F.Silk','Edge.Cuts','Ratsnest'] as layer}<button class:off={!layerVisibility[layer]} class:active={activeLayer===layer} onclick={() => { if(layer==='F.Cu'||layer==='B.Cu') activeLayer=layer; layerVisibility={...layerVisibility,[layer]:!layerVisibility[layer]}; }}><i class={`dot ${layer.replace('.','-')}`}></i>{layer}</button>{/each}</div>
            <div class="world" style={`transform:translate3d(${panX}px,${panY}px,0) scale(${zoom/100})`}>
              <div class="board"><i class="hole h1"></i><i class="hole h2"></i><i class="hole h3"></i><i class="hole h4"></i></div>
              {#each pcbParts as part}
                <button class:selected={selectedId===part.id} class="footprint" data-pin-count={part.pinCount == null ? '' : part.pinCount} data-catalog-key={part.catalogKey || ''} style={`left:${part.px}%;top:${part.py}%;--rot:${part.rot}deg`} onpointerdown={(e)=>startNodeDrag(e,part.id,'pcb')}><span>{part.id}</span><i></i><i></i><small>{part.footprint}</small></button>
              {/each}
              
            </div>
            <div class="floating-card"><span>ROUTING</span><strong>{boardTrackCount} tracks</strong><small>Use Route/Via/Zone tools; DRC verifies the checks currently implemented.</small><button onclick={() => { activeTool='Route'; window.PCBProCommand?.clickTool?.('route'); }}>Activate Route</button></div>
          </section>
        {:else if activeView === 'Simulator'}
          <section class="panel"><div class="panel-title"><div><span>SIMULATION</span><h2>Live Circuit Solver</h2><p>The live solver mounts from the active netlist. No placeholder voltages/currents are shown.</p></div><button class="primary" onclick={runSimulation}>▶ Run</button></div><div class="cards"><article><b>LIVE</b><h3>Solver state</h3><p>Use Run/Stop/Probe after the runtime solver finishes loading. Unsupported device models are reported instead of guessed.</p></article><article><b>MODEL</b><h3>Current scope</h3><p>DC operating-point style solving is available for supported devices; this is not transient/SPICE sign-off.</p></article></div></section>
        {:else if activeView === '3D'}
          <section class="panel"><div class="panel-title"><div><span>3D ASSEMBLY</span><h2>Geometry-driven board viewer</h2><p>Interactive board geometry from the active project. STEP bodies remain explicitly unverified until a real body provider is connected.</p></div><button class="primary" onclick={() => window.PCBProGeometry3D?.mount?.()}>Refresh 3D</button></div><div class="cards"><article><b>LOADING 3D ENGINE</b><h3>Project geometry</h3><p>The runtime engine will mount the board outline, copper, vias and component placements here.</p></article></div></section>
        {:else if activeView === 'BOM'}
          <section class="panel"><div class="panel-title"><div><span>BOM</span><h2>Project components</h2></div><button onclick={exportBom}>Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>Ref</th><th>Part</th><th>Value</th><th>Footprint</th></tr></thead><tbody>{#each components as p}<tr><td>{p.id}</td><td>{p.name}</td><td>{p.value}</td><td>{p.footprint}</td></tr>{/each}</tbody></table></div></section>
        {:else if activeView === 'Fabrication'}
          <section class="panel"><div class="panel-title"><div><span>FABRICATION</span><h2>Manufacturing & CAM package</h2><p>Gerber/Excellon/BOM/CPL export is gated by deterministic preflight and explicit geometry coverage.</p></div><button class="primary" onclick={() => window.PCBProManufacturing?.preflight?.()}>Run preflight</button></div><div class="cards"><article><b>CAM ENGINE</b><h3>Loading manufacturing runtime</h3><p>Physical board dimensions and verified geometry are required before export. Missing footprint pad geometry is never fabricated.</p></article></div></section>
        {:else if activeView === 'Rules'}
          <section class="panel"><div class="panel-title"><div><span>DESIGN RULES</span><h2>Professional board constraints</h2><p>Deterministic geometry checks plus calibrated physical DRC in millimeters.</p></div><button class="primary" onclick={() => window.PCBProProfessional?.open?.('constraints')}>Open Rules</button></div><div class="cards"><article><b>GEOMETRY DRC</b><h3>Logical + board checks</h3><p>Connectivity, routing, outline, via/zone/keepout and implemented geometry rules.</p></article><article><b>PHYSICAL DRC</b><h3>mm-calibrated clearance</h3><p>Track width, copper clearance, via diameter/drill, annular ring and copper-to-edge checks using the physical board dimensions.</p></article><article><b>DOMAIN INTEGRITY</b><h3>Cross-engine source of truth</h3><p>Audits components, wires, nets, PCB tracks, placements, vias, zones, rules and manufacturing state for stale references.</p></article></div><div class="pp-actions"><button onclick={runDrc}>Run DRC</button><button onclick={() => window.PCBProPhysicalDRC?.show?.()}>Physical DRC</button><button class="primary" onclick={() => window.PCBProIntegrity?.show?.()}>Integrity Audit</button></div></section>
        {:else}
          <section class="panel"><div class="panel-title"><div><span>RELEASE CENTER</span><h2>PCB Pro v{version}</h2><p>Cross-engine integrity and calibrated physical DRC extend the manufacturing baseline.</p></div></div><div class="release"><article><b>v1.21.0</b><h3>Domain Integrity + Physical DRC</h3><p>Source-of-truth audit/repair, SHA-256 project fingerprint, mm-calibrated copper clearance, via/drill/annular-ring and copper-edge checks.</p></article><article><b>v1.20.0</b><h3>Manufacturing + 3D Geometry</h3><p>Persisted PCB geometry, interactive 3D viewer and traceable CAM package generation.</p></article></div></section>
        {/if}
      </div>

      <footer class="statusbar"><div><i></i><b>Pointer Engine</b><span>{activeView}</span><span>{components.length} symbols</span><span>{pcbParts.length} footprints</span></div><div><button onclick={() => snapEnabled=!snapEnabled}>Snap {snapEnabled?'ON':'OFF'}</button><button onclick={() => zoom=clamp(35,zoom-10,300)}>−</button><b>{zoom}%</b><button onclick={() => zoom=clamp(35,zoom+10,300)}>＋</button><button onclick={() => consoleOpen=!consoleOpen}>{consoleOpen?'Hide log':'Show log'}</button></div></footer>
      {#if consoleOpen}<div class="console"><span>[perf]</span> rAF pointer updates <span>[ui]</span> resizable panels <span>[input]</span> pointer/touch/mouse unified <span>[project]</span> {components.length} parts <span>[drc]</span> {drcFindings}</div>{/if}
    </main>

    {#if rightOpen}<button class="splitter right" aria-label="Resize inspector" onpointerdown={(e) => startResize(e,'right')}></button>{/if}

    <aside class="inspector">
      <section><div class="ins-title"><span>PROPERTIES</span><b>{selected?.id || '—'}</b></div>{#if selected}<label><span>Reference</span><input value={selected.id} readonly/></label><label><span>Value</span><input value={selected.value} onchange={(e)=>updateSelected('value',e.currentTarget.value)}/></label><label><span>Footprint</span><input value={selected.footprint} onchange={(e)=>updateSelected('footprint',e.currentTarget.value)}/></label><div class="prop-actions"><button onclick={rotateSelected}>↻ Rotate</button><button onclick={deleteSelected}>Delete</button></div>{:else}<p class="empty">Select a component.</p>{/if}</section>
      <section><div class="ins-title"><span>DESIGN CHECKS</span><b>{drcFindings}</b></div><button class="check" onclick={runErc}>ERC <small>Run check</small></button><button class="check" onclick={runDrc}>• DRC <small>{drcFindings}</small></button><button class="check" onclick={() => window.PCBProKiCadBehavior?.footprintPicker?.()}>✓ Footprints <small>{pcbParts.length} mapped</small></button></section>
      <section><div class="ins-title"><span>NET INSPECTOR</span><b>{nets.length}</b></div>{#each nets as net}<button class="net"><i></i><span><b>{net.name}</b><small>{net.pins}</small></span></button>{/each}</section>
      <section><div class="ins-title"><span>WORKSPACE</span><b>FLEX</b></div><div class="workspace-controls"><button onclick={() => leftWidth=clamp(190,leftWidth-20,430)}>Library −</button><button onclick={() => leftWidth=clamp(190,leftWidth+20,430)}>Library +</button><button onclick={() => rightWidth=clamp(220,rightWidth-20,430)}>Inspector −</button><button onclick={() => rightWidth=clamp(220,rightWidth+20,430)}>Inspector +</button></div></section>
    </aside>
  </div>

  {#if libraryDrag}<div bind:this={dragGhostEl} class="drag-ghost"><span>{libraryDrag.part.code}</span><b>{libraryDrag.part.name}</b></div>{/if}
  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>

<style>
  :global(*){box-sizing:border-box} :global(html),:global(body){margin:0;width:100%;height:100%;background:#060b11;color:#d9e5ee;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif} :global(body){overflow:hidden} :global(button),:global(input){font:inherit} :global(button){cursor:pointer} :global(:root){color-scheme:dark}
  .app{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#071019}.app.interacting{user-select:none}.topbar{height:54px;flex:0 0 54px;border-bottom:1px solid #1b2937;background:#08121c;display:flex;align-items:center;justify-content:space-between;padding:0 10px;gap:10px}.brand-group,.top-actions{display:flex;align-items:center;gap:7px;min-width:0}.icon-btn,.top-actions>button,.panel-title button{border:1px solid #273a4a;background:#0e1924;color:#b8c8d5;border-radius:7px;padding:7px 10px;font-size:9px}.icon-btn{width:32px;height:32px;padding:0}.logo{width:31px;height:31px;border-radius:8px;background:#1fc4aa;display:grid;place-items:center;color:#06221d;font-weight:900}.brand{display:flex;align-items:baseline;gap:5px;white-space:nowrap}.brand strong{font-size:14px}.brand span{font:800 8px ui-monospace;color:#4fd7c0}.version{font-size:7px;letter-spacing:.12em;color:#63d7c0;border:1px solid #245548;background:#0b211c;border-radius:5px;padding:4px 6px;white-space:nowrap}.project-pill{border:0;background:transparent;color:#9eb1c0;padding:6px 8px;display:flex;gap:7px;align-items:center}.project-pill i{width:6px;height:6px;border-radius:50%;background:#47d7aa}.project-pill b{font-size:9px}.save-state{font-size:8px;color:#5c7184}.top-actions .primary,.primary{background:#159f89;border-color:#29bba4;color:#fff}
  .menubar{height:29px;flex:0 0 29px;border-bottom:1px solid #182633;background:#080f17;display:flex;align-items:center;justify-content:space-between;padding:0 9px;overflow:hidden}.menus{display:flex;overflow:auto;scrollbar-width:none}.menus button{border:0;background:transparent;color:#72879a;font-size:8px;padding:6px 8px}.menus button:hover{background:#101d29;color:#d5e0e8}.workspace-state{font:7px ui-monospace;color:#5a7082;white-space:nowrap}.workspace-state i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#43d4aa;margin-right:5px}.workspace-state span{margin:0 5px}
  .shell{flex:1;min-height:0;display:grid;grid-template-columns:var(--left) var(--ls) minmax(0,1fr) var(--rs) var(--right);background:#09121b}.leftbar,.inspector{min-width:0;overflow:auto;background:#09131d}.leftbar{border-right:1px solid #1b2a37}.inspector{border-left:1px solid #1b2a37}.splitter{width:5px;border:0;padding:0;background:#0b1721;cursor:col-resize;position:relative;z-index:10}.splitter:hover,.interacting .splitter{background:#1c5a50}.splitter.right{grid-column:4}.side-tabs{display:flex;position:sticky;top:0;background:#09131d;z-index:3;border-bottom:1px solid #1b2a37}.side-tabs button{flex:1;border:0;border-bottom:2px solid transparent;background:transparent;color:#687f92;font-size:7px;font-weight:800;padding:10px 4px}.side-tabs button.active{color:#d8e5ee;border-color:#35c9b2}.side-title{display:flex;justify-content:space-between;align-items:end;padding:14px 12px 7px}.side-title span,.ins-title span,.panel-title span{font-size:7px;letter-spacing:.13em;font-weight:850;color:#5d778b}.side-title h2{font-size:15px;margin:3px 0 0}.side-title>b,.ins-title>b{font:800 8px ui-monospace;border:1px solid #294052;background:#10202d;color:#8ca7ba;border-radius:10px;padding:2px 7px}.search{display:flex;margin:6px 10px;border:1px solid #223747;background:#0d1924;border-radius:7px;padding:0 8px;align-items:center;gap:6px}.search input{width:100%;min-width:0;border:0;background:transparent;color:#d4e0e8;outline:0;padding:8px 0;font-size:9px}.library-filter{display:flex;align-items:center;gap:6px;margin:6px 10px}.library-filter select{min-width:0;flex:1;border:1px solid #223747;background:#0d1924;color:#a9bcc8;border-radius:7px;padding:7px 8px;font-size:8px}.library-filter span{font:800 7px ui-monospace;color:#60798b;white-space:nowrap}.load-more{width:calc(100% - 8px);margin:6px 4px;border:1px solid #2b5a50;background:#102720;color:#73d7c1;border-radius:7px;padding:8px;font-size:8px;font-weight:800}.hint{margin:8px 10px;padding:7px 8px;border:1px solid #1d443a;background:#0c211c;border-radius:6px;color:#6dbfae;font-size:7px;line-height:1.45}.parts{padding:0 6px 12px}.part{width:100%;border:1px solid transparent;background:transparent;color:#b9c8d4;border-radius:7px;padding:6px;display:grid;grid-template-columns:34px 1fr 18px;align-items:center;text-align:left;touch-action:none}.part:hover{background:#101f2b;border-color:#243a4a}.part:active{background:#143027}.part-symbol{width:29px;height:29px;border:1px solid #2c4a5d;background:#102430;border-radius:6px;display:grid;place-items:center;color:#65dac5;font:800 8px ui-monospace}.part-copy b{display:block;font-size:9px}.part-copy small{display:block;color:#637a8d;font-size:7px;margin-top:2px}.part em{font-style:normal;color:#5b7488}.tree,.history{padding:12px 9px}.tree>span{display:block;font-size:7px;color:#5c7488;margin:3px 6px 7px}.tree button{width:100%;border:0;background:transparent;color:#869caf;text-align:left;border-radius:6px;padding:8px;font-size:8px}.tree button:hover,.tree .root{background:#0f1e2a;color:#d2dfe7}.tree button.active{background:#12352f;color:#79e0ca;box-shadow:inset 2px 0 0 #3bd0b7}.history article{border:1px solid #203342;background:#0d1924;border-radius:8px;padding:9px;margin-bottom:8px}.history b{font:800 8px ui-monospace;color:#4fd6bd}.history strong{display:block;font-size:9px;margin-top:3px}.history p{font-size:7px;color:#657d90;line-height:1.45;margin:5px 0 0}
  .workbench{min-width:0;min-height:0;display:flex;flex-direction:column;background:#09121b}.tabs{height:42px;flex:0 0 42px;display:flex;border-bottom:1px solid #1b2a37;overflow-x:auto;scrollbar-width:thin}.tabs button{border:0;border-bottom:2px solid transparent;background:transparent;color:#72879a;padding:0 12px;font-size:8px;font-weight:750;white-space:nowrap}.tabs button.active{color:#dbe7ef;border-color:#38cbb4;background:#0e211d}.toolbar-scroll{height:47px;flex:0 0 47px;overflow-x:auto;border-bottom:1px solid #182633}.toolbar{height:46px;min-width:max-content;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 8px}.tools,.tool-right{display:flex;gap:3px;align-items:center}.tools button,.tool-right button{border:1px solid transparent;background:transparent;color:#758b9e;border-radius:6px;height:31px;display:flex;align-items:center;gap:4px;padding:0 7px}.tools button.active{background:#15372f;border-color:#2a6c60;color:#61dcc5}.tools small,.tool-right button{font-size:7px}.tool-right button{border-color:#203545;background:#0c1721}.content{flex:1;min-height:0;display:flex;overflow:hidden}
  .stage{position:relative;flex:1;min-width:0;min-height:0;overflow:hidden;touch-action:none;background-color:#09131c;background-image:radial-gradient(#243746 1px,transparent 1px),radial-gradient(#142431 .7px,transparent .7px);background-size:20px 20px,10px 10px;contain:layout paint size}.stage.placing{cursor:crosshair}.stage-info{position:absolute;z-index:20;left:12px;top:10px;right:12px;display:flex;justify-content:space-between;color:#637b8f;font:750 7px ui-monospace;pointer-events:none}.stage-info div{display:flex;gap:4px}.stage-info b{padding:4px 6px;border:1px solid #263947;background:#0a151ee6;border-radius:5px}.world{position:absolute;inset:0;transform-origin:0 0;will-change:transform;contain:layout paint}.node,.footprint{position:absolute;z-index:5;touch-action:none;will-change:left,top;transform:translate3d(-50%,-50%,0) rotate(var(--rot));transition:border-color .12s,box-shadow .12s}.node{min-width:90px;border:1px solid #223541;background:#0b1822;color:#d4e1ea;border-radius:8px;padding:8px 10px}.node.selected,.footprint.selected{border-color:#3bd0b7;box-shadow:0 0 0 2px #1c5f53}.node.pending{animation:pulse 1s infinite}.node .ref{position:absolute;top:-13px;left:0;color:#8098aa;font:800 7px ui-monospace}.node .symbol{height:20px;display:grid;place-items:center;color:#71ddca;font:800 11px ui-monospace}.node b{display:block;font-size:8px}.node small{font-size:6px;color:#647d90}.board{position:absolute;left:9%;right:9%;top:12%;bottom:12%;border:2px solid #d2b65f;border-radius:7px;background:linear-gradient(135deg,#155440,#0d382d);box-shadow:0 25px 55px #0008,inset 0 0 50px #07271d}.hole{position:absolute;width:12px;height:12px;border:2px solid #ceb361;border-radius:50%;background:#09110e}.h1{left:12px;top:12px}.h2{right:12px;top:12px}.h3{left:12px;bottom:12px}.h4{right:12px;bottom:12px}.footprint{width:88px;height:54px;border:1px solid #d8ba62;background:#153e32e8;color:#e5cd82;border-radius:4px;font:800 7px ui-monospace;padding-top:5px}.footprint>i{position:absolute;width:10px;height:10px;border-radius:50%;border:2px solid #dab859;background:#263826;bottom:7px}.footprint>i:first-of-type{left:17px}.footprint>i:last-of-type{right:17px}.footprint small{display:block;font-size:6px;color:#9fb5aa;margin-top:3px}.layer-strip{position:absolute;z-index:25;left:12px;top:36px;display:flex;gap:4px;flex-wrap:wrap}.layer-strip button{border:1px solid #223747;background:#0b1721;color:#8095a6;border-radius:5px;padding:4px 6px;font-size:7px;display:flex;align-items:center;gap:4px}.layer-strip button.active{border-color:#c15f4f;color:#e2a999}.layer-strip button.off{opacity:.4}.dot{width:7px;height:7px;border-radius:2px;background:#cb604d}.dot.B-Cu{background:#5682d0}.dot.F-Silk{background:#e3e8ea}.dot.Edge-Cuts{background:#d7b95d}.dot.Ratsnest{background:#58d6c0}.floating-card{position:absolute;z-index:25;right:12px;bottom:12px;width:165px;border:1px solid #263d4d;background:#0a1620f2;border-radius:9px;padding:10px}.floating-card span{font-size:7px;color:#607b8e}.floating-card strong{display:block;font-size:22px;color:#56d8bf;margin:3px 0}.floating-card small{font-size:7px;color:#71879a}.floating-card button{width:100%;margin-top:7px;border:1px solid #2c6658;background:#12372e;color:#69dbc3;border-radius:6px;padding:6px;font-size:7px}.stage-help{position:absolute;z-index:30;left:10px;bottom:9px;display:flex;gap:4px;flex-wrap:wrap;pointer-events:none}.stage-help span{border:1px solid #213545;background:#08131ddd;color:#62798b;border-radius:5px;padding:4px 6px;font-size:6px}
  .panel{flex:1;min-width:0;min-height:0;overflow:auto;padding:18px;background:linear-gradient(155deg,#0b151f,#091018)}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.panel-title h2{margin:4px 0 2px;font-size:19px}.panel-title p{margin:0;color:#63798c;font-size:8px}.cards article,.release article{border:1px solid #203342;background:#0d1924;border-radius:9px;padding:12px}.table-wrap{border:1px solid #203240;border-radius:9px;overflow:auto}.table-wrap table{width:100%;border-collapse:collapse;min-width:600px;background:#0c1721}.table-wrap th,.table-wrap td{padding:10px;border-bottom:1px solid #1b2b38;text-align:left;font-size:8px}.table-wrap th{font-size:7px;color:#637b8e}.cards{display:grid;grid-template-columns:repeat(2,minmax(210px,1fr));gap:8px}.cards b,.release b{color:#4fd5bd;font:800 8px ui-monospace}.cards h3,.release h3{font-size:12px;margin:6px 0}.cards p,.release p{font-size:8px;color:#657c8f;line-height:1.45}.inspector input{width:100%;border:1px solid #263c4d;background:#09141e;color:#c8d6e0;border-radius:6px;padding:7px;font-size:8px}.release{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:9px}
  .statusbar{height:27px;flex:0 0 27px;border-top:1px solid #1b2a37;background:#08121a;display:flex;justify-content:space-between;align-items:center;padding:0 8px;overflow-x:auto;white-space:nowrap}.statusbar>div{display:flex;align-items:center;gap:7px;font-size:7px;color:#61798c}.statusbar i{width:6px;height:6px;border-radius:50%;background:#42d4aa}.statusbar button{border:0;background:transparent;color:#71899c;font-size:7px}.console{height:26px;flex:0 0 26px;border-top:1px solid #14212c;background:#050b11;display:flex;align-items:center;gap:7px;padding:0 8px;overflow-x:auto;white-space:nowrap;color:#536a7d;font:7px ui-monospace}.console span{color:#4fcdb7}
  .inspector section{padding:11px;border-bottom:1px solid #1b2a37}.ins-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.inspector label{display:block;margin:7px 0}.inspector label span{display:block;font-size:7px;color:#60788b;margin-bottom:4px}.prop-actions,.workspace-controls{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.prop-actions button,.workspace-controls button,.check,.net{border:1px solid #263b4b;background:#0d1923;color:#8fa5b6;border-radius:6px;padding:6px;font-size:7px}.check,.net{width:100%;display:flex;justify-content:space-between;margin:4px 0;text-align:left}.check small{color:#5f788b}.net{align-items:center;gap:7px;justify-content:flex-start}.net>i{width:6px;height:6px;border-radius:50%;background:#4fd1b9}.net span{min-width:0}.net b,.net small{display:block}.net small{color:#5f778a;font-size:6px;margin-top:2px}.empty{font-size:8px;color:#61798b}.drag-ghost{position:fixed;z-index:100;left:0;top:0;transform:translate3d(-999px,-999px,0);pointer-events:none;display:flex;align-items:center;gap:8px;border:1px solid #45cdb6;background:#0c211deF;color:#d9e7ef;border-radius:8px;padding:8px 11px;box-shadow:0 12px 35px #0009;will-change:transform}.drag-ghost span{width:27px;height:27px;border-radius:5px;background:#15352e;display:grid;place-items:center;color:#5bd8c1;font:800 8px ui-monospace}.drag-ghost b{font-size:8px}.toast{position:fixed;z-index:110;right:16px;bottom:42px;border:1px solid #2f6c5e;background:#10261f;color:#76dfc7;border-radius:8px;padding:9px 12px;font-size:8px;box-shadow:0 15px 40px #0008}@keyframes pulse{50%{box-shadow:0 0 0 5px #32cdb32a}}
  @media(max-width:1120px){.version,.save-state{display:none}}
  @media(max-width:900px){.shell{grid-template-columns:0 0 minmax(0,1fr) 0 0!important}.leftbar,.inspector,.splitter{display:none}.project-pill{display:none}.panel{padding:12px}.cards,.release{grid-template-columns:1fr}.board{left:5%;right:5%}.floating-card{width:140px}}
  @media(max-width:620px){.top-actions>button:not(.primary):not(.icon-btn){display:none}.menus{max-width:70vw}.tools small{display:none}.panel-title{align-items:flex-start;flex-direction:column}.console{display:none}.stage-help span:nth-child(n+3){display:none}}
</style>