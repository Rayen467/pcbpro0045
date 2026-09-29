<script>
  import { onMount } from 'svelte';

  const version = '1.0.0';
  const views = ['Schematic', 'PCB', 'Simulator', '3D', 'BOM', 'Fabrication', 'Rules', 'Release'];
  const menuItems = ['File', 'Edit', 'View', 'Place', 'Route', 'Inspect', 'Tools', 'Manufacture'];
  const toolsets = {
    Schematic: ['Select', 'Place', 'Wire', 'Bus', 'Net label', 'Junction', 'No connect', 'Power', 'Measure', 'Annotate'],
    PCB: ['Select', 'Route', 'Via', 'Zone', 'Keepout', 'Dimension', 'Measure', 'Tune', 'Layer swap', 'Ratsnest'],
    Simulator: ['Run', 'Stop', 'Probe', 'Cursor A', 'Cursor B', 'Trace', 'Measure'],
    '3D': ['Orbit', 'Pan', 'Zoom', 'Measure', 'Section', 'Explode', 'Reset'],
    BOM: ['Refresh', 'Group', 'MPN', 'Supplier', 'Cost', 'Export CSV'],
    Fabrication: ['Preflight', 'Gerber', 'Drill', 'Pick & Place', 'Assembly', 'Archive'],
    Rules: ['Electrical', 'Clearance', 'Track width', 'Via', 'Differential', 'Mask', 'Silkscreen'],
    Release: ['Snapshot', 'Compare', 'Tag', 'Notes', 'Package']
  };

  const library = [
    { key: 'dc', prefix: 'V', code: 'V', name: 'DC Source', value: '5 V', group: 'Sources', footprint: 'TerminalBlock_2P' },
    { key: 'r', prefix: 'R', code: 'R', name: 'Resistor', value: '330 Ω', group: 'Passives', footprint: 'R_0805' },
    { key: 'c', prefix: 'C', code: 'C', name: 'Capacitor', value: '1 µF', group: 'Passives', footprint: 'C_0805' },
    { key: 'l', prefix: 'L', code: 'L', name: 'Inductor', value: '10 µH', group: 'Passives', footprint: 'L_0805' },
    { key: 'd', prefix: 'D', code: 'D', name: 'Diode', value: '1N4148', group: 'Semiconductors', footprint: 'SOD-123' },
    { key: 'led', prefix: 'D', code: 'LED', name: 'LED', value: 'Red 2 V', group: 'Semiconductors', footprint: 'LED_0603' },
    { key: 'q', prefix: 'Q', code: 'Q', name: 'N-MOSFET', value: '2N7002', group: 'Semiconductors', footprint: 'SOT-23' },
    { key: 'u', prefix: 'U', code: 'U', name: 'Op-Amp', value: 'LM358', group: 'IC', footprint: 'SOIC-8' },
    { key: 'sw', prefix: 'SW', code: 'SW', name: 'Switch', value: 'SPST', group: 'Input', footprint: 'SW_THT' },
    { key: 'j', prefix: 'J', code: 'J', name: 'Connector', value: '2 Pin', group: 'Connectors', footprint: 'HDR_1x02' },
    { key: 'gnd', prefix: 'G', code: 'GND', name: 'Ground', value: '0 V', group: 'Power', footprint: '—' },
    { key: 'tp', prefix: 'TP', code: 'TP', name: 'Test Point', value: 'TP', group: 'Debug', footprint: 'TestPoint_1mm' }
  ];

  let activeView = 'Schematic';
  let activeTool = 'Select';
  let activeLayer = 'F.Cu';
  let leftOpen = true;
  let rightOpen = true;
  let leftTab = 'Library';
  let query = '';
  let selectedId = 'R2';
  let consoleOpen = true;
  let toast = '';
  let savedAt = 'Unsaved';
  let zoom = 100;
  let grid = 10;
  let drcFindings = 2;
  let routed = false;
  let layerVisibility = { 'F.Cu': true, 'B.Cu': true, 'F.Silk': true, 'Edge.Cuts': true, Ratsnest: true };

  let components = [
    { id: 'V1', code: 'V', name: 'DC Source', value: '5 V', footprint: 'TerminalBlock_2P', sx: 18, sy: 52, px: 18, py: 57, rot: 0 },
    { id: 'R2', code: 'R', name: 'Resistor', value: '330 Ω', footprint: 'R_0805', sx: 47, sy: 29, px: 45, py: 29, rot: 0 },
    { id: 'D3', code: 'LED', name: 'LED', value: 'Red 2 V', footprint: 'LED_0603', sx: 78, sy: 51, px: 76, py: 60, rot: 0 },
    { id: 'G4', code: 'GND', name: 'Ground', value: '0 V', footprint: '—', sx: 49, sy: 74, px: 50, py: 76, rot: 0 }
  ];

  const nets = [
    { name: 'VCC', pins: 'V1.1 · R2.1' },
    { name: 'LED_A', pins: 'R2.2 · D3.1' },
    { name: 'GND', pins: 'D3.2 · V1.2' }
  ];

  $: filteredParts = library.filter((part) => `${part.code} ${part.name} ${part.value} ${part.group}`.toLowerCase().includes(query.toLowerCase()));
  $: selected = components.find((part) => part.id === selectedId) || null;
  $: pcbParts = components.filter((part) => part.footprint && part.footprint !== '—');
  $: currentTools = toolsets[activeView] || [];

  onMount(() => {
    try {
      const raw = localStorage.getItem('pcbpro0045-project');
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (Array.isArray(saved.components)) components = saved.components;
      if (saved.savedAt) savedAt = saved.savedAt;
    } catch (error) {
      console.warn('Restore skipped', error);
    }
  });

  function notify(message) {
    toast = message;
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => (toast = ''), 2200);
  }

  function nextRef(prefix) {
    const nums = components
      .filter((part) => part.id.startsWith(prefix))
      .map((part) => Number(part.id.slice(prefix.length)))
      .filter(Number.isFinite);
    return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`;
  }

  function makePart(part, x = 50, y = 50, surface = 'schematic') {
    const id = nextRef(part.prefix);
    const created = {
      id,
      code: part.code,
      name: part.name,
      value: part.value,
      footprint: part.footprint,
      sx: surface === 'schematic' ? x : 50,
      sy: surface === 'schematic' ? y : 50,
      px: surface === 'pcb' ? x : 50,
      py: surface === 'pcb' ? y : 50,
      rot: 0
    };
    components = [...components, created];
    selectedId = id;
    notify(`${id} added · click canvas or drag it to reposition`);
  }

  function addPart(part) {
    makePart(part, 50, 50, activeView === 'PCB' ? 'pcb' : 'schematic');
  }

  function dragStart(event, part) {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/pcbpro-part', part.key);
  }

  function dropPart(event, surface) {
    event.preventDefault();
    const key = event.dataTransfer.getData('text/pcbpro-part');
    const part = library.find((item) => item.key === key);
    if (!part) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100));
    makePart(part, x, y, surface);
  }

  function moveSelected(event, surface) {
    if (!selected || event.target.closest('.node,.footprint,.floating-card,.layer-strip')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100));
    components = components.map((part) =>
      part.id === selectedId
        ? { ...part, [surface === 'pcb' ? 'px' : 'sx']: x, [surface === 'pcb' ? 'py' : 'sy']: y }
        : part
    );
  }

  function updateSelected(field, value) {
    if (!selected) return;
    components = components.map((part) => (part.id === selectedId ? { ...part, [field]: value } : part));
  }

  function rotateSelected() {
    if (!selected) return;
    updateSelected('rot', (selected.rot + 90) % 360);
  }

  function deleteSelected() {
    if (!selected) return;
    components = components.filter((part) => part.id !== selectedId);
    selectedId = components[0]?.id || '';
    notify('Component removed');
  }

  function selectView(view) {
    activeView = view;
    activeTool = toolsets[view]?.[0] || 'Select';
  }

  function saveProject() {
    savedAt = `Saved ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    localStorage.setItem('pcbpro0045-project', JSON.stringify({ components, savedAt }));
    notify('Project saved locally');
  }

  function download(name, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportProject() {
    download('pcbpro0045-project.json', JSON.stringify({ version, components, nets }, null, 2));
  }

  function exportBom() {
    const rows = [['Ref', 'Part', 'Value', 'Footprint'], ...components.map((p) => [p.id, p.name, p.value, p.footprint])];
    download('pcbpro0045-bom.csv', rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n'), 'text/csv');
  }

  function runDrc() {
    drcFindings = routed ? 0 : Math.max(1, pcbParts.length - 2);
    notify(drcFindings === 0 ? 'DRC clean' : `${drcFindings} DRC findings`);
  }

  function toolAction(tool) {
    activeTool = tool;
    if (tool === 'Export CSV') exportBom();
    if (tool === 'Run') notify('SPICE engine bridge is not connected yet');
    if (['Gerber', 'Drill', 'Pick & Place'].includes(tool)) notify(`${tool} exporter is staged, engine not connected yet`);
  }

  function handleKey(event) {
    if (['input', 'textarea', 'select'].includes(event.target?.tagName?.toLowerCase())) return;
    if (event.key === 'Delete') deleteSelected();
    if (event.key.toLowerCase() === 'r') rotateSelected();
    if (event.key.toLowerCase() === 'w') { activeView = 'Schematic'; activeTool = 'Wire'; }
    if (event.key.toLowerCase() === 'x') activeLayer = activeLayer === 'F.Cu' ? 'B.Cu' : 'F.Cu';
    if (event.ctrlKey && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(); }
  }
</script>

<svelte:window onkeydown={handleKey} />

<svelte:head>
  <title>PCB Pro 0045 — EDA Workspace</title>
  <meta name="description" content="Professional PCB design workspace prototype with schematic, PCB, rules, BOM and manufacturing flows." />
</svelte:head>

<div class="app">
  <header class="topbar">
    <div class="brand-group">
      <button class="icon-btn" onclick={() => (leftOpen = !leftOpen)} title="Toggle library">☰</button>
      <div class="logo">⌁</div>
      <div class="brand"><strong>PCB Pro</strong><span>0045</span></div>
      <span class="version">ENGINEERING BUILD · v{version}</span>
      <button class="project-pill"><i></i><b>LED Driver · Rev A</b><span>⌄</span></button>
    </div>
    <div class="top-actions">
      <span class="save-state">{savedAt}</span>
      <button onclick={() => notify('New workspace ready')}>New</button>
      <button onclick={saveProject}>Save</button>
      <button onclick={exportProject}>Export</button>
      <button class="primary" onclick={() => selectView('Simulator')}>▶ Simulate</button>
      <button class="icon-btn" onclick={() => (rightOpen = !rightOpen)} title="Toggle inspector">☷</button>
    </div>
  </header>

  <div class="menubar">
    <div class="menus">{#each menuItems as item}<button onclick={() => notify(`${item} command palette`)}>{item}</button>{/each}</div>
    <div class="workspace-state"><i></i> Local project <span>•</span> Grid {grid} mil <span>•</span> {activeLayer}</div>
  </div>

  <div class:no-left={!leftOpen} class:no-right={!rightOpen} class="shell">
    <aside class="leftbar">
      <div class="side-tabs">
        {#each ['Library', 'Project', 'History'] as tab}<button class:active={leftTab === tab} onclick={() => (leftTab = tab)}>{tab}</button>{/each}
      </div>

      {#if leftTab === 'Library'}
        <div class="side-title"><div><span>COMPONENT LIBRARY</span><h2>Parts</h2></div><b>{library.length}</b></div>
        <label class="search"><span>⌕</span><input bind:value={query} placeholder="Search symbol, value, group" /></label>
        <div class="hint"><b>Click</b> to add instantly · <b>drag</b> if you prefer precise placement.</div>
        <div class="parts">
          {#each filteredParts as part}
            <button class="part" draggable="true" ondragstart={(e) => dragStart(e, part)} onclick={() => addPart(part)}>
              <span class="part-symbol">{part.code}</span>
              <span class="part-copy"><b>{part.name}</b><small>{part.value} · {part.group}</small></span>
              <em>＋</em>
            </button>
          {/each}
        </div>
      {:else if leftTab === 'Project'}
        <div class="tree">
          <label>PROJECT TREE</label>
          <button class="root">▾ ◫ LED Driver · Rev A</button>
          <button>⌁ Main schematic</button><button>▦ Main board</button><button>◈ Assembly 3D</button><button>☷ BOM · {components.length} items</button><button>⬡ Manufacturing</button>
          <label>OUTPUTS</label><button>Gerber X2</button><button>NC Drill</button><button>BOM / CPL</button>
        </div>
      {:else}
        <div class="history">
          <label>PATCH HISTORY</label>
          <article><b>v1.0.0</b><h4>Clean repo baseline</h4><p>Responsive workspace, click-to-place, optional drag-and-drop, rule and release workspaces.</p></article>
          <article><b>next</b><h4>EDA core</h4><p>Connectivity graph, ERC, undo/redo, real routing geometry and manufacturing engines.</p></article>
        </div>
      {/if}
    </aside>

    <main class="workbench">
      <nav class="views">
        {#each views as view}
          <button class:active={activeView === view} onclick={() => selectView(view)}><span>{view === 'Schematic' ? '⌁' : view === 'PCB' ? '▦' : view === 'Simulator' ? '∿' : view === '3D' ? '◈' : view === 'BOM' ? '☷' : view === 'Fabrication' ? '⬡' : view === 'Rules' ? '⚙' : '↟'}</span>{view}</button>
        {/each}
      </nav>

      <div class="toolbar-wrap">
        <div class="toolbar">
          <div class="tools">
            {#each currentTools as tool}
              <button class:active={activeTool === tool} onclick={() => toolAction(tool)}><span>{tool === 'Select' ? '↖' : tool === 'Wire' || tool === 'Route' ? '⌁' : tool === 'Via' ? '◉' : tool === 'Zone' ? '▧' : tool === 'Run' ? '▶' : tool === 'Stop' ? '■' : tool === 'Measure' ? '⌖' : '◇'}</span><small>{tool}</small></button>
            {/each}
          </div>
          <div class="checks"><button onclick={runDrc}><i class:bad={drcFindings > 0}></i>DRC {drcFindings}</button><button onclick={() => notify('ERC shell ready · connectivity engine next')}>✓ ERC</button><button onclick={() => (zoom = 100)}>⛶ Fit</button></div>
        </div>
      </div>

      <div class="content">
        {#if activeView === 'Schematic'}
          <section class="canvas" ondragover={(e) => e.preventDefault()} ondrop={(e) => dropPart(e, 'schematic')} onclick={(e) => moveSelected(e, 'schematic')}>
            <div class="canvas-head"><span>SCHEMATIC / MAIN</span><div><b>Snap {grid} mil</b><b>Orthogonal</b><b>Click / Drop placement</b></div></div>
            <svg class="wire-layer" viewBox="0 0 1000 620" preserveAspectRatio="none"><polyline points="180,315 315,315 315,185 470,185"/><polyline points="530,185 710,185 710,315 810,315"/><polyline points="810,315 810,455 500,455 180,455 180,315"/><circle cx="315" cy="315" r="4"/><circle cx="710" cy="315" r="4"/></svg>
            {#each components as part}
              <button class="node" class:selected={selectedId === part.id} style={`left:${part.sx}%;top:${part.sy}%;transform:translate(-50%,-50%) rotate(${part.rot}deg)`} onclick={(e) => { e.stopPropagation(); selectedId = part.id; }}>
                <span class="ref">{part.id}</span><div class="symbol">{part.code === 'R' ? '─[▰]─' : part.code === 'C' ? '─│ │─' : part.code === 'GND' ? '⏚' : part.code === 'LED' ? '─▷│↗' : part.code === 'V' ? '⊕' : part.code}</div><b>{part.value}</b><small>{part.name}</small>
              </button>
            {/each}
            <div class="canvas-help"><span><b>Click part</b> add instantly</span><span><b>Drag</b> optional</span><span><b>Canvas click</b> move selected</span><span><b>R</b> rotate</span><span><b>Del</b> remove</span></div>
          </section>
        {:else if activeView === 'PCB'}
          <section class="canvas pcb-stage" ondragover={(e) => e.preventDefault()} ondrop={(e) => dropPart(e, 'pcb')} onclick={(e) => moveSelected(e, 'pcb')}>
            <div class="canvas-head"><span>PCB / MAIN BOARD</span><div><b>{activeLayer}</b><b>2 Layer</b><b>FR-4 1.6 mm</b></div></div>
            <div class="layer-strip">
              {#each ['F.Cu', 'B.Cu', 'F.Silk', 'Edge.Cuts', 'Ratsnest'] as layer}
                <button class:active={activeLayer === layer} class:off={!layerVisibility[layer]} onclick={(e) => { e.stopPropagation(); layerVisibility = { ...layerVisibility, [layer]: !layerVisibility[layer] }; if (layer === 'F.Cu' || layer === 'B.Cu') activeLayer = layer; }}><i class={layer.replace('.', '-')}></i>{layer}</button>
              {/each}
            </div>
            <div class="board" onclick={(e) => moveSelected(e, 'pcb')}>
              <i class="mount a"></i><i class="mount b"></i><i class="mount c"></i><i class="mount d"></i>
              {#each pcbParts as part}
                <button class="footprint" class:selected={selectedId === part.id} style={`left:${part.px}%;top:${part.py}%;transform:translate(-50%,-50%) rotate(${part.rot}deg)`} onclick={(e) => { e.stopPropagation(); selectedId = part.id; }}><span>{part.id}</span><i></i><i></i><small>{part.footprint}</small></button>
              {/each}
              {#if layerVisibility['F.Cu']}<div class="trace t1"></div><div class="trace t2"></div>{/if}
              {#if layerVisibility['B.Cu']}<div class="trace bottom t3"></div>{/if}
              {#if layerVisibility.Ratsnest && !routed}<svg class="rats" viewBox="0 0 700 390"><line x1="125" y1="225" x2="330" y2="115"/><line x1="330" y1="115" x2="555" y2="235"/></svg>{/if}
            </div>
            <div class="floating-card"><span>ROUTING</span><strong>{routed ? '100%' : '42%'}</strong><small>{routed ? '0 unrouted' : 'Connectivity engine pending'}</small><button onclick={(e) => { e.stopPropagation(); routed = true; drcFindings = 0; notify('Demo route state completed'); }}>Complete demo route</button></div>
          </section>
        {:else if activeView === 'Simulator'}
          <section class="panel"><div class="panel-title"><div><span>SIMULATION</span><h2>SPICE Workbench</h2><p>Professional shell is ready; native/WASM SPICE engine is not connected yet.</p></div><button class="primary" onclick={() => notify('SPICE integration is the next engine milestone')}>Connect engine</button></div><div class="engine-grid"><article><b>Operating Point</b><span>UI ready</span><p>DC node voltages and branch currents.</p></article><article><b>Transient</b><span>UI ready</span><p>Time-domain waveform analysis.</p></article><article><b>AC Sweep</b><span>UI ready</span><p>Frequency response and phase.</p></article><article><b>Model Library</b><span>Pending engine</span><p>Vendor SPICE models and model assignment.</p></article></div><div class="scope"><div><b>Waveform viewer</b><span>No fabricated result is shown until the solver is integrated.</span></div><svg viewBox="0 0 900 250"><path d="M0 180 C130 180 145 80 260 80 S430 80 520 80 S700 80 900 80"/></svg></div></section>
        {:else if activeView === '3D'}
          <section class="panel"><div class="panel-title"><div><span>3D ASSEMBLY</span><h2>Mechanical viewport</h2><p>Board and component envelope preview; STEP model engine comes later.</p></div></div><div class="scene"><div class="board3d"><i class="chip p1">J1</i><i class="chip p2">R2</i><i class="chip p3">LED</i><i class="chip p4">U1</i></div><div class="axis">Z ↑<br/>Y ↙ · X ↗</div></div></section>
        {:else if activeView === 'BOM'}
          <section class="panel"><div class="panel-title"><div><span>BILL OF MATERIALS</span><h2>{components.length} project items</h2><p>Editable part mapping and manufacturing metadata.</p></div><button onclick={exportBom}>Export CSV</button></div><div class="table-wrap"><table><thead><tr><th>Ref</th><th>Part</th><th>Value</th><th>Footprint</th><th>Status</th></tr></thead><tbody>{#each components as part}<tr><td>{part.id}</td><td>{part.name}</td><td>{part.value}</td><td>{part.footprint}</td><td><span class:warn={part.footprint === '—'}>{part.footprint === '—' ? 'Virtual' : 'Mapped'}</span></td></tr>{/each}</tbody></table></div></section>
        {:else if activeView === 'Fabrication'}
          <section class="panel"><div class="panel-title"><div><span>MANUFACTURING</span><h2>Fabrication package</h2><p>Export pipeline status is explicit so prototype output is never confused with production files.</p></div><button class="primary" onclick={runDrc}>Run preflight</button></div><div class="engine-grid"><article><b>DRC / Preflight</b><span>{drcFindings} findings</span><p>Rules UI active; geometry-grade DRC is next.</p></article><article><b>Gerber X2</b><span>Engine pending</span><p>Copper, mask, silk and paste layers.</p></article><article><b>Excellon Drill</b><span>Engine pending</span><p>Plated and non-plated drill output.</p></article><article><b>BOM + CPL</b><span>Partial</span><p>BOM CSV works; placement export comes with board geometry.</p></article></div></section>
        {:else if activeView === 'Rules'}
          <section class="panel"><div class="panel-title"><div><span>DESIGN RULES</span><h2>Board constraints</h2><p>Central place for electrical, physical and manufacturing rules.</p></div><button class="primary" onclick={runDrc}>Run DRC</button></div><div class="rule-grid"><label><span>Minimum clearance</span><input value="0.20 mm" /></label><label><span>Minimum track width</span><input value="0.20 mm" /></label><label><span>Preferred track width</span><input value="0.25 mm" /></label><label><span>Via diameter / drill</span><input value="0.60 / 0.30 mm" /></label><label><span>Copper to edge</span><input value="0.30 mm" /></label><label><span>Silkscreen clearance</span><input value="0.15 mm" /></label></div></section>
        {:else}
          <section class="panel"><div class="panel-title"><div><span>RELEASE CENTER</span><h2>PCB Pro 0045 · v{version}</h2><p>New clean repository baseline for all development from today onward.</p></div><button onclick={() => notify('Snapshot marker created in UI')}>Create snapshot</button></div><div class="release"><article><span>CURRENT APP</span><h3>Engineering Workspace</h3><p>Responsive editor shell, dual placement mode, workspace tabs, inspector, rules, BOM and manufacturing status.</p><div><b>SvelteKit</b><b>Vercel ready</b><b>Local save</b></div></article><article><span>NEXT CORE PATCH</span><h3>Connectivity Engine</h3><p>Real pins, nets, wires, undo/redo, ERC graph, selection model and project serialization.</p><div><b>Core model</b><b>ERC</b><b>History</b></div></article></div></section>
        {/if}
      </div>

      <footer class="statusbar"><div><i></i><b>PCB Pro Core</b><span>{activeView}</span><span>{components.length} symbols</span><span>{nets.length} nets</span></div><div><button onclick={() => (grid = grid === 10 ? 5 : 10)}>Grid {grid}</button><button onclick={() => (zoom = Math.max(50, zoom - 10))}>−</button><b>{zoom}%</b><button onclick={() => (zoom = Math.min(200, zoom + 10))}>＋</button><button onclick={() => (consoleOpen = !consoleOpen)}>{consoleOpen ? 'Hide log' : 'Show log'}</button></div></footer>
      {#if consoleOpen}<div class="console"><span>[core]</span> v{version} <span>[project]</span> {components.length} symbols / {pcbParts.length} footprints <span>[drc]</span> {drcFindings} findings <span>[sim]</span> engine pending <span>[fab]</span> exporters pending</div>{/if}
    </main>

    <aside class="rightbar">
      <section><div class="inspector-title"><span>PROPERTIES</span><b>⋯</b></div>{#if selected}<div class="selection"><small>SELECTED</small><h3>{selected.id}</h3><span>{selected.name}</span></div><label class="field"><span>Value</span><input value={selected.value} oninput={(e) => updateSelected('value', e.currentTarget.value)} /></label><label class="field"><span>Footprint</span><input value={selected.footprint} oninput={(e) => updateSelected('footprint', e.currentTarget.value)} /></label><div class="property-actions"><button onclick={rotateSelected}>↻ Rotate</button><button onclick={() => updateSelected('rot', 0)}>0°</button><button class="danger" onclick={deleteSelected}>Delete</button></div>{:else}<p class="empty">Select a component.</p>{/if}</section>
      <section><div class="inspector-title"><span>DESIGN CHECKS</span><b>{drcFindings}</b></div><button class="check" onclick={() => notify('ERC connectivity graph is next milestone')}><i>✓</i><span><b>ERC shell</b><small>UI mapped</small></span></button><button class="check" onclick={runDrc}><i class:warn={drcFindings > 0}>{drcFindings > 0 ? '!' : '✓'}</i><span><b>DRC</b><small>{drcFindings} findings</small></span></button></section>
      <section><div class="inspector-title"><span>NET INSPECTOR</span><b>{nets.length}</b></div>{#each nets as net}<button class="net" onclick={() => notify(`${net.name}: ${net.pins}`)}><i></i><span><b>{net.name}</b><small>{net.pins}</small></span><em>›</em></button>{/each}</section>
      <section><div class="inspector-title"><span>LAYER STACK</span><b>2 Cu</b></div>{#each ['F.Cu', 'B.Cu', 'F.Silk', 'Edge.Cuts', 'Ratsnest'] as layer}<button class="layer" class:off={!layerVisibility[layer]} onclick={() => (layerVisibility = { ...layerVisibility, [layer]: !layerVisibility[layer] })}><i class={layer.replace('.', '-')}></i><span>{layer}</span><b>{layerVisibility[layer] ? 'ON' : 'OFF'}</b></button>{/each}</section>
    </aside>
  </div>

  {#if toast}<div class="toast">✓ {toast}</div>{/if}
</div>

<style>
  :global(*){box-sizing:border-box} :global(html),:global(body){margin:0;width:100%;height:100%;background:#060b11;color:#dbe7f1;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif} :global(body){overflow:hidden} :global(button),:global(input),:global(select){font:inherit} :global(button){cursor:pointer} :global(:root){color-scheme:dark}
  .app{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:radial-gradient(circle at 48% -18%,#15354a 0,#09141e 33%,#070c12 62%)}
  .topbar{height:56px;flex:0 0 56px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-bottom:1px solid #1b2b38;background:#08121cde;backdrop-filter:blur(18px);z-index:30}.brand-group,.top-actions{display:flex;align-items:center;gap:7px;min-width:0}.icon-btn,.top-actions>button{border:1px solid #273949;background:#0e1924;color:#b8c8d6;border-radius:7px;height:31px;padding:0 9px;font-size:9px;font-weight:750}.icon-btn{width:31px;padding:0}.top-actions>button:hover,.icon-btn:hover{background:#142434;border-color:#416078}.top-actions .primary,.primary{background:linear-gradient(180deg,#1db399,#0f8372);border:1px solid #2ac9b0;color:#fff;border-radius:7px;padding:7px 10px;font-size:9px;font-weight:800}.logo{width:31px;height:31px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(145deg,#2de3c4,#0c8e82);color:#05231e;font-size:20px;font-weight:900;box-shadow:0 0 22px #18d6bd33}.brand{display:flex;gap:4px;align-items:baseline;white-space:nowrap}.brand strong{font-size:15px;letter-spacing:-.04em}.brand span{font:800 8px ui-monospace;color:#55d9c2}.version{font-size:7px;letter-spacing:.12em;font-weight:850;border:1px solid #285146;background:#0b211b;color:#5cdbbd;padding:4px 6px;border-radius:5px;white-space:nowrap}.project-pill{border:0;background:transparent;color:#afc1cf;display:flex;gap:7px;align-items:center;padding:7px;border-radius:7px;min-width:0}.project-pill:hover{background:#101d28}.project-pill i{width:6px;height:6px;border-radius:50%;background:#43d4aa;box-shadow:0 0 8px #43d4aa}.project-pill b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.save-state{font-size:8px;color:#5e7487;white-space:nowrap}.menubar{height:29px;flex:0 0 29px;padding:0 10px;border-bottom:1px solid #172531;background:#08111a;display:flex;align-items:center;justify-content:space-between;gap:10px}.menus{display:flex;min-width:0;overflow-x:auto;scrollbar-width:none}.menus button{border:0;background:transparent;color:#71869a;padding:6px 8px;font-size:8px;white-space:nowrap}.menus button:hover{background:#101c27;color:#d4e1ea}.workspace-state{display:flex;align-items:center;gap:6px;color:#566d80;font-size:7px;white-space:nowrap}.workspace-state i{width:6px;height:6px;background:#46d3aa;border-radius:50%;box-shadow:0 0 8px #46d3aa}
  .shell{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:245px minmax(0,1fr) 260px;transition:grid-template-columns .2s ease}.shell.no-left{grid-template-columns:0 minmax(0,1fr) 260px}.shell.no-right{grid-template-columns:245px minmax(0,1fr) 0}.shell.no-left.no-right{grid-template-columns:0 minmax(0,1fr) 0}.leftbar,.rightbar{background:#09121bf4;min-width:0;min-height:0;overflow:auto}.leftbar{border-right:1px solid #1b2a37}.rightbar{border-left:1px solid #1b2a37}.no-left .leftbar,.no-right .rightbar{overflow:hidden;border:0}.side-tabs{display:flex;position:sticky;top:0;z-index:2;background:#09131d;border-bottom:1px solid #1b2a37}.side-tabs button{flex:1;border:0;border-bottom:2px solid transparent;background:transparent;color:#60768a;padding:10px 4px;font-size:8px;font-weight:800}.side-tabs button.active{color:#dce8ef;border-color:#39cdb6}.side-title{display:flex;justify-content:space-between;align-items:end;padding:15px 13px 8px}.side-title span,.tree label,.history label,.panel-title span,.inspector-title span{font-size:7px;letter-spacing:.13em;font-weight:850;color:#5c7589}.side-title h2{margin:3px 0 0;font-size:15px}.side-title>b,.inspector-title>b{font-size:8px;padding:2px 6px;border:1px solid #253d4e;border-radius:10px;background:#102130;color:#88a6bc}.search{margin:6px 11px 8px;padding:0 8px;display:flex;align-items:center;gap:6px;border:1px solid #213747;background:#0d1823;border-radius:8px;color:#698398}.search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:#d6e2eb;padding:8px 0;font-size:9px}.hint{margin:0 11px 9px;padding:7px;border:1px solid #1e443b;background:#0c211d;color:#70cdb9;border-radius:6px;font-size:7px;line-height:1.4}.parts{padding:0 7px 14px}.part{width:100%;display:grid;grid-template-columns:34px 1fr 18px;align-items:center;text-align:left;border:1px solid transparent;background:transparent;color:#bdcad6;padding:6px;border-radius:7px}.part:hover{background:#0f1d29;border-color:#22394a}.part-symbol{width:29px;height:29px;display:grid;place-items:center;border:1px solid #29485a;background:#102330;color:#6cddc8;border-radius:6px;font:750 8px ui-monospace}.part-copy{min-width:0}.part-copy b{display:block;font-size:9px}.part-copy small{display:block;font-size:7px;color:#62798c;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.part em{font-style:normal;color:#58758a}.tree,.history{padding:14px 10px}.tree label,.history label{display:block;margin:4px 4px 8px}.tree label:not(:first-child){margin-top:18px}.tree button{width:100%;border:1px solid transparent;background:transparent;color:#889fb0;border-radius:6px;padding:7px 9px;text-align:left;font-size:8px}.tree button:hover,.tree .root{background:#0f1d29;border-color:#203647;color:#d8e4ed}.tree button:not(.root){padding-left:20px}.history article{border:1px solid #1f3141;background:#0d1822;border-radius:8px;padding:9px;margin-bottom:8px}.history article>b{font:800 8px ui-monospace;color:#50d5bd}.history h4{margin:5px 0 3px;font-size:9px}.history p{margin:0;color:#657b8e;font-size:7px;line-height:1.45}
  .workbench{min-width:0;min-height:0;display:flex;flex-direction:column;background:#09111a}.views{height:43px;flex:0 0 43px;display:flex;align-items:end;padding:0 8px;border-bottom:1px solid #1d2b38;background:#0a131d;overflow-x:auto;scrollbar-width:thin}.views button{height:100%;display:flex;align-items:center;gap:6px;border:0;border-bottom:2px solid transparent;background:transparent;color:#6f8599;padding:0 11px;font-size:8px;font-weight:750;white-space:nowrap}.views button span{font-size:12px}.views button.active{color:#e0edf5;border-bottom-color:#36cbb4;background:linear-gradient(0deg,#12332b68,transparent)}.toolbar-wrap{height:47px;flex:0 0 47px;overflow-x:auto;overflow-y:hidden;border-bottom:1px solid #182633;background:#0b141e}.toolbar{min-width:max-content;height:46px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 9px}.tools,.checks{display:flex;align-items:center;gap:3px}.tools button,.checks button{height:31px;min-width:34px;border:1px solid transparent;background:transparent;color:#758b9e;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px}.tools button small{font-size:7px;white-space:nowrap}.tools button:hover,.checks button:hover{background:#132331;border-color:#273d50;color:#d3e0e9}.tools button.active{background:#14362f;border-color:#286e60;color:#65dfc7}.checks button{font-size:7px;border-color:#203547;padding:0 8px}.checks i{width:6px;height:6px;background:#4fd2af;border-radius:50%}.checks i.bad{background:#ff826f}.content{flex:1;min-height:0;min-width:0;display:flex;overflow:hidden}.canvas{position:relative;flex:1;min-height:0;min-width:0;overflow:hidden;background-color:#0a131c;background-image:radial-gradient(#253746 1px,transparent 1px),radial-gradient(#162635 .7px,transparent .7px);background-size:20px 20px,10px 10px}.canvas-head{position:absolute;z-index:5;left:12px;top:10px;right:12px;display:flex;justify-content:space-between;color:#607689;font:750 7px ui-monospace;pointer-events:none}.canvas-head div{display:flex;gap:5px}.canvas-head b{padding:4px 6px;border:1px solid #263745;border-radius:5px;background:#0b151fdd}.wire-layer{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.wire-layer polyline{fill:none;stroke:#64d9c4;stroke-width:2}.wire-layer circle{fill:#68dec8}.node{position:absolute;z-index:3;min-width:94px;padding:8px 10px;border:1px solid #20313e;background:#0b1721;color:#d5e2eb;border-radius:8px;box-shadow:0 9px 22px #0006}.node:hover,.node.selected{border-color:#31b7a4;box-shadow:0 0 0 1px #1d5d54,0 14px 34px #0008}.node .ref{position:absolute;top:-14px;left:0;color:#8097a9;font:750 8px ui-monospace}.node .symbol{height:22px;display:grid;place-items:center;color:#73decf;font:800 12px ui-monospace}.node>b{display:block;font:750 9px ui-monospace;color:#cbe1e6;margin-top:4px}.node small{font-size:7px;color:#60788c}.canvas-help{position:absolute;z-index:6;left:12px;bottom:10px;display:flex;gap:5px;flex-wrap:wrap}.canvas-help span{font-size:7px;color:#5e7487;background:#09131ddd;border:1px solid #213545;border-radius:5px;padding:4px 6px}.canvas-help b{color:#a1b4c3}.pcb-stage{display:flex;align-items:center;justify-content:center}.layer-strip{position:absolute;z-index:8;top:36px;left:12px;display:flex;gap:4px;flex-wrap:wrap;max-width:75%}.layer-strip button,.layer{border:1px solid #213746;background:#0b1721;color:#8094a5;border-radius:5px;font-size:7px;padding:4px 6px;display:flex;align-items:center;gap:5px}.layer-strip button.active{border-color:#c05848;color:#e3ad9d}.layer-strip button.off,.layer.off{opacity:.42}.layer-strip i,.layer i{width:7px;height:7px;border-radius:2px;background:#ca5c4b}.layer-strip i.B-Cu,.layer i.B-Cu{background:#507fd1}.layer-strip i.F-Silk,.layer i.F-Silk{background:#e4e8ea}.layer-strip i.Edge-Cuts,.layer i.Edge-Cuts{background:#d8b759}.layer-strip i.Ratsnest,.layer i.Ratsnest{background:#65d8c3}.board{position:relative;width:min(73%,760px);max-height:72%;aspect-ratio:1.8;border:2px solid #d4b557;border-radius:7px;background:linear-gradient(140deg,#15503e,#0d392e);box-shadow:0 30px 70px #0009,inset 0 0 45px #09261e}.mount{position:absolute;width:12px;height:12px;border:2px solid #c6aa63;border-radius:50%;background:#09100f}.mount.a{left:12px;top:12px}.mount.b{right:12px;top:12px}.mount.c{left:12px;bottom:12px}.mount.d{right:12px;bottom:12px}.footprint{position:absolute;z-index:4;width:90px;height:56px;padding-top:5px;border:1px solid #dbbd66;background:#183f34dd;color:#e3cf8e;border-radius:4px;font:750 8px ui-monospace;text-align:center}.footprint.selected{outline:2px solid #59ddc6;outline-offset:3px}.footprint>i{position:absolute;width:10px;height:10px;border-radius:50%;border:2px solid #e2bd5f;background:#283827;bottom:7px}.footprint>i:first-of-type{left:18px}.footprint>i:last-of-type{right:18px}.footprint small{display:block;color:#9ab6a8;font-size:6px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trace{position:absolute;height:5px;background:#c75d4a;box-shadow:0 0 0 1px #9f4235;border-radius:5px;transform-origin:left center}.trace.bottom{background:#4b72c3;box-shadow:0 0 0 1px #395ea7}.t1{left:19%;top:55%;width:31%;transform:rotate(-34deg)}.t2{left:48%;top:29%;width:34%;transform:rotate(29deg)}.t3{right:22%;bottom:30%;width:27%;transform:rotate(130deg)}.rats{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.rats line{stroke:#ead56a;stroke-width:1;stroke-dasharray:5 4}.floating-card{position:absolute;z-index:8;right:13px;bottom:13px;width:172px;padding:11px;border:1px solid #253b4c;background:#09151fdf;border-radius:9px;backdrop-filter:blur(8px)}.floating-card span{font-size:7px;color:#5e788c}.floating-card strong{display:block;font-size:23px;color:#58dbc1;margin:3px 0}.floating-card small{font-size:7px;color:#778c9e}.floating-card button{width:100%;margin-top:8px;border:1px solid #2a6054;background:#12352c;color:#69dbc3;border-radius:6px;padding:6px;font-size:7px}
  .panel{flex:1;min-width:0;min-height:0;padding:20px;overflow:auto;background:linear-gradient(160deg,#0b141e,#091018)}.panel-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.panel-title h2{margin:4px 0 2px;font-size:20px}.panel-title p{margin:0;color:#607589;font-size:8px;line-height:1.45}.panel-title>button{border:1px solid #293c4d;background:#0f1b27;color:#a7bac9;border-radius:7px;padding:7px 9px;font-size:8px}.engine-grid{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:9px}.engine-grid article{border:1px solid #203243;background:#0d1924;border-radius:10px;padding:13px}.engine-grid article>b{display:block;font-size:10px}.engine-grid article>span{display:inline-block;margin:7px 0;padding:3px 5px;border-radius:5px;background:#0e2a22;color:#61d6b6;font-size:7px}.engine-grid article p{margin:0;color:#5f7689;font-size:8px;line-height:1.45}.scope{margin-top:11px;border:1px solid #1d3040;background:#08111a;border-radius:10px;overflow:hidden}.scope>div{height:38px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1b2c3a}.scope b{font-size:8px}.scope span{font-size:7px;color:#607589}.scope svg{width:100%;height:240px;background-image:linear-gradient(#132330 1px,transparent 1px),linear-gradient(90deg,#132330 1px,transparent 1px);background-size:45px 45px}.scope path{fill:none;stroke:#47e4cb;stroke-width:2;opacity:.55}.scene{height:74%;min-height:360px;display:grid;place-items:center;perspective:900px;position:relative}.board3d{position:relative;width:min(56vw,500px);aspect-ratio:1.85;border:4px solid #bcae5e;border-radius:10px;background:linear-gradient(135deg,#17654a,#0b3d2d);transform:rotateX(58deg) rotateZ(-25deg);box-shadow:25px 45px 40px #0008,inset 0 0 70px #06241a}.chip{position:absolute;background:#111820;border:2px solid #506b5e;color:#9ecbb2;padding:16px 24px;border-radius:4px;box-shadow:12px 18px 14px #0008;font:750 9px ui-monospace;font-style:normal}.chip.p1{left:8%;top:42%}.chip.p2{left:43%;top:16%}.chip.p3{right:9%;bottom:17%;background:#a52924;color:#ffd5ca}.chip.p4{right:38%;bottom:21%;padding:23px 32px}.axis{position:absolute;right:15px;bottom:15px;color:#70879a;font:750 8px ui-monospace}.table-wrap{overflow:auto;border:1px solid #1f3140;border-radius:9px}.table-wrap table{width:100%;min-width:620px;border-collapse:collapse;background:#0c1620;font-size:8px}.table-wrap th,.table-wrap td{padding:10px 12px;border-bottom:1px solid #1b2b38;text-align:left}.table-wrap th{font-size:7px;color:#60778a;background:#0f1b27}.table-wrap td span{padding:3px 5px;border-radius:5px;background:#0e2a22;color:#61d6b6}.table-wrap td span.warn{background:#332915;color:#e1bf6a}.rule-grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:9px}.rule-grid label{border:1px solid #203243;background:#0d1924;border-radius:9px;padding:10px}.rule-grid span{display:block;margin-bottom:7px;font-size:7px;color:#6e8599}.rule-grid input{width:100%;border:1px solid #263c4e;background:#09131d;color:#c8d6e0;border-radius:6px;padding:8px;font:8px ui-monospace}.release{display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:10px}.release article{border:1px solid #213342;background:#0d1823;border-radius:11px;padding:15px}.release article>span{font-size:7px;letter-spacing:.13em;color:#5d778c;font-weight:800}.release h3{margin:6px 0;font-size:14px}.release p{color:#687e90;font-size:8px;line-height:1.5}.release article>div{display:flex;gap:5px;flex-wrap:wrap}.release article>div b{font-size:7px;padding:4px 6px;border:1px solid #285146;background:#0c221d;color:#5fd3b6;border-radius:5px}
  .statusbar{height:28px;flex:0 0 28px;padding:0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;overflow-x:auto;white-space:nowrap;border-top:1px solid #1b2a37;background:#08121a}.statusbar>div{display:flex;align-items:center;gap:8px;color:#61788b;font-size:7px}.statusbar>div>i{width:6px;height:6px;border-radius:50%;background:#42d4aa}.statusbar button{border:0;background:transparent;color:#72899c;font-size:7px}.console{height:27px;flex:0 0 27px;padding:0 9px;display:flex;align-items:center;gap:7px;overflow-x:auto;white-space:nowrap;border-top:1px solid #13212c;background:#050b11;color:#536a7d;font:7px ui-monospace}.console span{color:#4fcdb7}.rightbar section{padding:12px;border-bottom:1px solid #1b2a37}.inspector-title{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.selection{padding:9px;margin-bottom:9px;border:1px solid #223847;background:#0c1822;border-radius:8px}.selection small{font-size:7px;color:#5c7387}.selection h3{margin:4px 0 1px;font:800 16px ui-monospace}.selection span{font-size:8px;color:#6b8194}.field{display:block;margin:8px 0}.field span{display:block;margin-bottom:4px;font-size:7px;color:#60778a}.field input{width:100%;border:1px solid #263b4c;background:#0b1620;color:#c8d7e1;border-radius:6px;padding:7px 8px;font-size:8px}.property-actions{display:flex;gap:5px;margin-top:9px}.property-actions button{flex:1;border:1px solid #263b4b;background:#0d1822;color:#91a6b6;border-radius:6px;padding:6px;font-size:7px}.property-actions .danger{color:#e18a7b;border-color:#51342f}.empty{font-size:8px;color:#61788b}.check,.net{width:100%;border:0;background:transparent;color:#a8bac8;display:flex;align-items:center;gap:8px;text-align:left;padding:6px 0}.check>i{width:18px;height:18px;display:grid;place-items:center;border:1px solid #25594c;background:#0d2a22;color:#59d2b2;border-radius:50%;font-size:8px;font-style:normal}.check>i.warn{background:#332715;border-color:#654e20;color:#e5bd5e}.check span,.net span{flex:1;min-width:0}.check span b,.net span b{display:block;font-size:8px}.check span small,.net span small{display:block;margin-top:2px;color:#60778a;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.net>i{width:6px;height:6px;border-radius:50%;background:#53d5bd}.net em{font-style:normal;color:#536b7e}.layer{width:100%;justify-content:flex-start;margin-bottom:4px;padding:6px}.layer span{flex:1;text-align:left}.layer b{font-size:6px;color:#668196}.toast{position:fixed;right:18px;bottom:45px;z-index:60;padding:9px 12px;border:1px solid #2f6d5e;background:#10251f;color:#75e0c7;border-radius:8px;box-shadow:0 15px 45px #0008;font-size:8px;font-weight:750}
  @media(max-width:1180px){.shell{grid-template-columns:215px minmax(0,1fr) 225px}.shell.no-left{grid-template-columns:0 minmax(0,1fr) 225px}.shell.no-right{grid-template-columns:215px minmax(0,1fr) 0}.version,.save-state{display:none}.engine-grid{grid-template-columns:repeat(2,minmax(150px,1fr))}.rule-grid{grid-template-columns:repeat(2,minmax(170px,1fr))}}
  @media(max-width:900px){.shell,.shell.no-left,.shell.no-right,.shell.no-left.no-right{grid-template-columns:minmax(0,1fr)}.leftbar,.rightbar{position:absolute;top:0;bottom:0;z-index:25;width:min(82vw,280px);box-shadow:20px 0 50px #0009}.leftbar{left:0}.rightbar{right:0;box-shadow:-20px 0 50px #0009}.no-left .leftbar,.no-right .rightbar{display:none}.project-pill{max-width:180px}.workspace-state{display:none}.board{width:86%}.release{grid-template-columns:1fr}}
  @media(max-width:650px){.project-pill,.version{display:none}.topbar{padding:0 6px}.top-actions{gap:4px}.top-actions>button{padding:0 7px}.views button{padding:0 9px}.tools button small{display:none}.engine-grid,.rule-grid{grid-template-columns:1fr}.panel-title{align-items:flex-start;flex-direction:column}.canvas-head div{display:none}.board{width:94%;max-height:64%}.floating-card{right:8px;bottom:8px;width:145px}.console{display:none}.panel{padding:12px}.scene{min-height:300px}.board3d{width:78vw}.scope>div{align-items:flex-start;flex-direction:column;height:auto;padding:8px 10px;gap:3px}}
</style>
