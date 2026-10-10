import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../static/portable-backup-v124.js', import.meta.url), 'utf8');
const samplePart = {
  id: 'R1', code: 'R', name: 'Resistor', value: '1k',
  footprint: 'R_0805', sx: 20, sy: 30, px: 40, py: 50, rot: 0
};

function fixture() {
  return {
    format: 'pcbpro0045-encrypted-project',
    schemaVersion: '1.21.0',
    capturedAt: '2026-10-10T00:00:00.000Z',
    core: { components: [{ ...samplePart }], ui: { leftWidth: 250, rightWidth: 300 } },
    wiring: { version: '2.1.0', routes: [{ id: 'W1', from: 'R1.1', to: 'R1.2', corners: [] }] },
    board: { version: '1.4.0', tracks: [{ id: 'T1', net: 'N1', widthMm: 0.25 }], outline: [], pads: [], placements: [] },
    advancedBoard: { vias: [{ id: 'V1', x: 5, y: 5 }], zones: [], keepouts: [] },
    professional: { rules: { minimumClearanceMm: 0.2 } },
    manufacturing: { widthMm: 40, heightMm: 30 }
  };
}

function harness(bundle = fixture()) {
  const data = new Map();
  const storage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: key => { data.delete(key); }
  };
  const w = {
    PCBProDatabase: { capture: () => bundle },
    PCBProUX: { lang: 'id' }
  };
  const d = { readyState: 'loading', addEventListener() {}, querySelector() { return null; } };
  vm.runInNewContext(source, {
    window: w, document: d, localStorage: storage,
    crypto: webcrypto, TextEncoder, Uint8Array,
    Blob, Date, URL, setTimeout,
    confirm: () => false, alert() {}
  }, { filename: 'portable-backup-v124.js' });
  return { api: w.PCBProPortableBackup, data, storage };
}

test('full portable backup preserves wiring and board instead of layout-only data', async () => {
  const h = harness();
  const pkg = await h.api.createPackage();
  assert.equal(pkg.format, 'pcbpro0045-portable-project');
  assert.match(pkg.sha256, /^[0-9a-f]{64}$/);
  const checked = await h.api.inspect(JSON.stringify(pkg));
  assert.equal(checked.counts.components, 1);
  assert.equal(checked.counts.wires, 1);
  assert.equal(checked.counts.tracks, 1);
  assert.equal(checked.counts.vias, 1);

  h.storage.setItem('pcbpro0045-cloud-active-project', 'old-cloud-id');
  const restored = h.api.restore(checked);
  assert.equal(restored.ok, true);
  assert.equal(h.storage.getItem('pcbpro0045-cloud-active-project'), null);
  assert.equal(h.storage.getItem('pcbpro0045-cloud-create-new'), '1');
  assert.equal(JSON.parse(h.storage.getItem('pcbpro0045-project-v11')).components[0].id, 'R1');
  assert.equal(JSON.parse(h.storage.getItem('pcbpro0045-wiregraph-v2')).routes[0].id, 'W1');
  assert.equal(JSON.parse(h.storage.getItem('pcbpro0045-board-v1')).tracks[0].id, 'T1');
  assert.equal(JSON.parse(h.storage.getItem('pcbpro0045-board-advanced-v1')).vias[0].id, 'V1');
});

test('tampered backups fail integrity check before storage writes', async () => {
  const h = harness();
  const pkg = await h.api.createPackage();
  pkg.bundle.core.components[0].value = 'forged';
  await assert.rejects(h.api.inspect(JSON.stringify(pkg)), /checksum mismatch/);
  assert.equal(h.data.size, 0);
});

test('duplicate components and malformed geometry are rejected at export', async () => {
  const bundle = fixture();
  bundle.core.components.push({ ...samplePart });
  await assert.rejects(harness(bundle).api.createPackage(), /duplicate component/);
  const badBoard = fixture();
  badBoard.board.tracks = 'not-an-array';
  await assert.rejects(harness(badBoard).api.createPackage(), /Invalid PCB board/);
});

test('import failure rolls localStorage back without clearing previous cloud identity', async () => {
  const h = harness();
  const checked = await h.api.inspect(JSON.stringify(await h.api.createPackage()));
  h.storage.setItem('pcbpro0045-cloud-active-project', 'old-cloud-id');
  h.storage.setItem('pcbpro0045-project-v11', 'old-local-project');
  const originalSetItem = h.storage.setItem;
  let failed = false;
  h.storage.setItem = (key, value) => {
    if (!failed && key === 'pcbpro0045-board-v1') {
      failed = true;
      throw new Error('Quota exceeded');
    }
    return originalSetItem(key, value);
  };
  assert.throws(() => h.api.restore(checked), /Could not save imported project/);
  assert.equal(h.storage.getItem('pcbpro0045-project-v11'), 'old-local-project');
  assert.equal(h.storage.getItem('pcbpro0045-cloud-active-project'), 'old-cloud-id');
});

test('restore clears stale optional settings instead of mixing projects', async () => {
  const bundle = fixture();
  bundle.advancedBoard = null;
  bundle.professional = null;
  bundle.manufacturing = null;
  const h = harness(bundle);
  h.storage.setItem('pcbpro0045-board-advanced-v1', '{"vias":[{"id":"OLD"}]}');
  h.storage.setItem('pcbpro0045-professional-v118', '{"old":true}');
  const checked = await h.api.inspect(JSON.stringify(await h.api.createPackage()));
  h.api.restore(checked);
  assert.equal(h.storage.getItem('pcbpro0045-board-advanced-v1'), null);
  assert.equal(h.storage.getItem('pcbpro0045-professional-v118'), null);
});
