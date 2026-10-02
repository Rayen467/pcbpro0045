import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** @param {string} path */
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const browserScripts = [
  'static/runtime-loader.js',
  'static/workspace-repair.js',
  'static/database-engine-v117.js',
  'static/stability-engine-v119.js',
  'static/project-command-bus-v115.js',
  'static/professional-engine-v118.js',
  'static/pcb-layout-engine.js',
  'static/board-advanced-engine.js',
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
    'database-engine-v117.js',
    'professional-engine-v118.js',
    'project-command-bus-v115.js',
    'assistant-brain-v115.js',
    'assistant-engine-v115.js',
    'stability-engine-v119.js'
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
});

test('typed command bus exposes professional checks and real PCB routing', () => {
  const bus = read('static/project-command-bus-v115.js');
  assert.match(bus, /'pcb\.route'/);
  assert.match(bus, /'pcb\.runDRC'/);
  assert.match(bus, /'professional\.audit'/);
  assert.match(bus, /'simulation\.run'/);
});
