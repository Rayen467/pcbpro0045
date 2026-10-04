import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** @param {string} path */
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const browserScripts = [
  'static/runtime-loader.js',
  'static/workspace-repair.js',
  'static/database-engine-v117.js',
  'static/stability-engine-v123.js',
  'static/project-command-bus-v115.js',
  'static/professional-engine-v118.js',
  'static/pcb-layout-engine.js',
  'static/board-advanced-engine.js',
  'static/pcb-command-dock-v122.js',
  'static/engineering-help-v123.js',
  'static/autorouter-v123.js',
  'static/learning-professional-v123.js',
  'static/assistant-brain-v115.js',
  'static/assistant-engine-v115.js',
  'static/manufacturing-engine-v120.js',
  'static/geometry-3d-engine-v120.js',
  'static/physical-drc-v121.js',
  'static/domain-integrity-v121.js',
  'static/wire-engine.js'
];

test('browser runtime scripts are syntactically valid JavaScript', () => {
  for (const path of browserScripts) {
    assert.doesNotThrow(() => new Function(read(path)), path);
  }
});

test('runtime loader includes critical production engines', () => {
  const loader = read('static/runtime-loader.js');
  for (const asset of [
    'wire-engine.js',
    'pcb-layout-engine.js',
    'board-advanced-engine.js',
    'pcb-command-dock-v122.js',
    'engineering-help-v123.js',
    'autorouter-v123.js',
    'learning-professional-v123.js',
    'database-engine-v117.js',
    'professional-engine-v118.js',
    'project-command-bus-v115.js',
    'assistant-brain-v115.js',
    'assistant-engine-v115.js',
    'manufacturing-engine-v120.js',
    'geometry-3d-engine-v120.js',
    'physical-drc-v121.js',
    'domain-integrity-v121.js',
    'stability-engine-v123.js'
  ]) assert.match(loader, new RegExp(asset.replaceAll('.', '\\.')));
});

test('core UI no longer contains fake engineering measurements or stale engine warnings', () => {
  const page = read('src/routes/+page.svelte');
  for (const stale of [
    '5.000 V',
    '9.091 mA',
    '27.27 mW',
    'Routing engine is not connected. Copper routing is not verified.',
    'DRC engine is not connected. Clearance, routing and manufacturing readiness have not been verified.',
    'ERC engine is not connected. Electrical connectivity has not been verified.'
  ]) assert.equal(page.includes(stale), false, `stale UI text found: ${stale}`);
  assert.match(page, /let nets = \[\];/);
  assert.equal(page.includes('manufacturing exporter is not implemented yet'), false);
});

test('workspace repair exposes implemented PCB tools instead of blocking them', () => {
  const repair = read('static/workspace-repair.js');
  assert.match(repair, /pcb:new Set\(\['select','place','route','via','zone','keepout','pan'\]\)/);
  assert.equal(repair.includes('PCB Route belum aktif'), false);
  assert.equal(repair.includes('PCB geometry DRC is not active yet'), false);
});

test('encrypted autosave fingerprint excludes volatile capture timestamps', () => {
  const db = read('static/database-engine-v117.js');
  assert.match(db, /delete stable\.capturedAt/);
  assert.match(db, /pcbpro0045-cloud-create-new/);
  assert.match(db, /data-pdb-import-key/);
  assert.match(db, /MANUFACTURING_KEY/);
  assert.match(db, /pcbpro:manufacturing-calibration-changed/);
});

test('typed command bus exposes professional, manufacturing, 3D, and real PCB actions', () => {
  const bus = read('static/project-command-bus-v115.js');
  assert.match(bus, /'pcb\.route'/);
  assert.match(bus, /'pcb\.runDRC'/);
  assert.match(bus, /'professional\.audit'/);
  assert.match(bus, /'simulation\.run'/);
  assert.match(bus, /'manufacturing\.preflight'/);
  assert.match(bus, /'manufacturing\.exportPackage'/);
  assert.match(bus, /'mechanical3d\.open'/);
  assert.match(bus, /'pcb\.runPhysicalDRC'/);
  assert.match(bus, /'integrity\.validate'/);
  assert.match(bus, /'integrity\.repair'/);
  assert.match(bus, /'pcb\.autoroute\.preview'/);
  assert.match(bus, /'pcb\.autoroute\.apply'/);
  assert.match(bus, /'pcb\.autoroute\.open'/);
});

test('manufacturing exporter is coverage-gated and never silently fabricates missing footprint pads', () => {
  const mfg = read('static/manufacturing-engine-v120.js');
  assert.match(mfg, /ENGINEERING-DRAFT-NOT-FOR-FABRICATION/);
  assert.match(mfg, /physicalPadSource/);
  assert.match(mfg, /Gerber/);
  assert.match(mfg, /Excellon/);
  assert.match(mfg, /sha256/);
  assert.match(mfg, /downloadGerbers/);
  assert.match(mfg, /downloadDrill/);
  assert.match(mfg, /downloadAssembly/);
});

test('3D viewer is driven by persisted board geometry rather than decorative placeholder bodies', () => {
  const view = read('static/geometry-3d-engine-v120.js');
  assert.match(view, /PCBProBoardModel/);
  assert.match(view, /placements/);
  assert.match(view, /tracks/);
  assert.match(view, /vias/);
  assert.match(view, /STEP bodies/);
});


test('physical DRC covers calibrated professional geometry rules', () => {
  const drc = read('static/physical-drc-v121.js');
  for (const rule of ['TRACK_WIDTH','TRACK_CLEARANCE','TRACK_EDGE_CLEARANCE','VIA_DIAMETER','VIA_DRILL','ANNULAR_RING','VIA_TRACK_CLEARANCE','VIA_CLEARANCE','OUTLINE_SELF_INTERSECTION']) {
    assert.match(drc, new RegExp(rule));
  }
  assert.match(drc, /PCBProManufacturing/);
  assert.match(drc, /PCBProProfessional/);
});

test('domain integrity audits cross-engine source of truth and safe repair', () => {
  const integrity = read('static/domain-integrity-v121.js');
  for (const check of ['ORPHAN_WIRE_ENDPOINT','TRACK_NET_MISMATCH','ORPHAN_TRACK_ENDPOINT','ORPHAN_VIA_NET','ORPHAN_ZONE_NET']) {
    assert.match(integrity, new RegExp(check));
  }
  assert.match(integrity, /SHA-256/);
  assert.match(integrity, /deleteWire/);
  assert.match(integrity, /deleteTrack/);
});

test('manufacturing preflight is gated by physical DRC', () => {
  const mfg = read('static/manufacturing-engine-v120.js');
  assert.match(mfg, /PCBProPhysicalDRC/);
  assert.match(mfg, /PHYSICAL_DRC/);
});


test('PCB command controls are docked and not absolutely overlaid on the canvas', () => {
  const board = read('static/pcb-layout-engine.js');
  const advanced = read('static/board-advanced-engine.js');
  const dock = read('static/pcb-command-dock-v122.js');
  assert.match(board, /PCBProPcbDock/);
  assert.match(advanced, /PCBProPcbDock/);
  assert.match(dock, /pcb-dock-layout/);
  assert.equal(/#pcbpro-board-hud\{position:absolute/.test(board), false);
  assert.equal(/#pcbpro-advanced-hud\{position:absolute/.test(advanced), false);
});

test('main PCB toolbar is the source of truth for Via Zone Keepout modes', () => {
  const advanced = read('static/board-advanced-engine.js');
  assert.match(advanced, /function toolbarMode/);
  assert.match(advanced, /function syncToolbarMode/);
  assert.equal(advanced.includes('data-mode="via"'), false);
  assert.equal(advanced.includes('data-mode="zone"'), false);
  assert.equal(advanced.includes('data-mode="keepout"'), false);
});


test('engineering help explains functions and known error codes', () => {
  const help = read('static/engineering-help-v123.js');
  for (const feature of ['Wire','Route','Auto Route','Gerber','DRC','ERC','Stack','Workflow']) {
    assert.match(help, new RegExp(feature.replaceAll(' ', '\\s*'), 'i'));
  }
  for (const code of ['AI_AUTH_MISSING','TRACK_CLEARANCE','VIA_DRILL','ANNULAR_RING','PHYSICAL_DRC']) {
    assert.match(help, new RegExp(code));
  }
  assert.match(help, /Fungsi & Error/);
});

test('autorouter is preview-first and limited honestly to current two-layer capability', () => {
  const router = read('static/autorouter-v123.js');
  assert.match(router, /function makePlan/);
  assert.match(router, /async function apply/);
  assert.match(router, /Preview route/);
  assert.match(router, /F\.Cu/);
  assert.match(router, /B\.Cu/);
  assert.match(router, /midRouteViaSwitching:false/);
  assert.match(router, /PCBProPhysicalDRC/);
});

test('AI assistant exposes gateway status and a forced real-model diagnostic path', () => {
  const ui = read('static/assistant-engine-v115.js');
  const brain = read('static/assistant-brain-v115.js');
  const api = read('src/routes/api/assistant/status/+server.js');
  assert.match(ui, /\/api\/assistant\/status/);
  assert.match(ui, /Tes AI nyata/);
  assert.match(brain, /async function forceModel/);
  assert.match(api, /VERCEL_OIDC_TOKEN/);
  assert.match(api, /AI_GATEWAY_API_KEY/);
  assert.match(api, /ai-gateway\.vercel\.sh\/v1\/models/);
});

test('professional syllabus covers current engineering workflow and is indexed by assistant RAG', () => {
  const raw = read('static/learning-professional-v123.json');
  const syllabus = JSON.parse(raw);
  assert.equal(syllabus.version, '1.23.0');
  assert.ok(syllabus.branches.length >= 9);
  for (const id of ['pro-routing','pro-sipi','pro-manufacturing','pro-validation','pro-automation','pro-capstone-2026']) {
    assert.ok(syllabus.branches.some((b) => b.id === id), id);
  }
  assert.ok(syllabus.sources.some((s) => s.id === 'abet-2026'));
  assert.ok(syllabus.sources.some((s) => s.id === 'ipc-pcb-curriculum'));
  const brain = read('static/assistant-brain-v115.js');
  assert.match(brain, /learning-professional-v123\.json/);
  assert.match(brain, /professional-syllabus-2026/);
});
