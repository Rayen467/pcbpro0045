(() => {
  'use strict';
  if (window.PCBProPortableBackup) return;

  const VERSION = '1.24.0';
  const FORMAT = 'pcbpro0045-portable-project';
  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_COMPONENTS = 5000;
  const KEY = {
    project: 'pcbpro0045-project-v11',
    wire: 'pcbpro0045-wiregraph-v2',
    board: 'pcbpro0045-board-v1',
    advanced: 'pcbpro0045-board-advanced-v1',
    professional: 'pcbpro0045-professional-v118',
    manufacturing: 'pcbpro0045-manufacturing-v120',
    electrical: 'pcbpro0045-electrical-v126',
    active: 'pcbpro0045-cloud-active-project',
    newCloud: 'pcbpro0045-cloud-create-new',
    name: 'pcbpro0045-cloud-project-name'
  };

  const tr = (id, en) => (window.PCBProUX?.lang || localStorage.getItem('pcbpro0045-lang') || 'id') === 'id' ? id : en;
  const byteLength = value => new TextEncoder().encode(value).byteLength;
  const requiredText = (value, max = 256) => typeof value === 'string' && value.length > 0 && value.length <= max;
  const limitedArray = (value, max) => Array.isArray(value) && value.length <= max;
  const finitePosition = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

  function validateTree(root) {
    let nodes = 0;
    function walk(value, depth) {
      if (++nodes > 250000 || depth > 32) throw new Error('Project nesting or item limit exceeded.');
      if (value === null || typeof value === 'boolean') return;
      if (typeof value === 'string') {
        if (value.length > 262144) throw new Error('Project string is too large.');
        return;
      }
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('Invalid project number.');
        return;
      }
      if (typeof value !== 'object') throw new Error('Unsupported project value.');
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry, depth + 1);
        return;
      }
      for (const [key, child] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe project property.');
        walk(child, depth + 1);
      }
    }
    walk(root, 0);
  }

  function validateBundle(bundle) {
    if (!bundle || typeof bundle !== 'object' || !bundle.core || !limitedArray(bundle.core.components, MAX_COMPONENTS)) {
      throw new Error('Missing project components.');
    }
    if (bundle.format !== 'pcbpro0045-encrypted-project') throw new Error('Unsupported project bundle.');
    const references = new Set();
    for (const p of bundle.core.components) {
      if (!p || typeof p !== 'object' || !requiredText(p.id) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(p.id) || references.has(p.id)) {
        throw new Error('Invalid or duplicate component reference.');
      }
      references.add(p.id);
      for (const key of ['code', 'name', 'value', 'footprint']) {
        if (typeof p[key] !== 'string' || p[key].length > 256) throw new Error('Invalid component ' + key + '.');
      }
      for (const key of ['sx', 'sy', 'px', 'py']) {
        if (!finitePosition(p[key])) throw new Error('Invalid component position ' + p.id + '.');
      }
      if (typeof p.rot !== 'number' || !Number.isFinite(p.rot)) throw new Error('Invalid component rotation.');
    }
    if (bundle.wiring && !limitedArray(bundle.wiring.routes, 100000)) throw new Error('Invalid wire graph.');
    if (!bundle.board || !limitedArray(bundle.board.tracks, 100000) ||
        !limitedArray(bundle.board.outline, 50000) ||
        !limitedArray(bundle.board.placements || [], MAX_COMPONENTS) ||
        !limitedArray(bundle.board.pads || [], 100000)) throw new Error('Invalid PCB board.');
    if (bundle.advancedBoard && (
      !limitedArray(bundle.advancedBoard.vias || [], 100000) ||
      !limitedArray(bundle.advancedBoard.zones || [], 10000) ||
      !limitedArray(bundle.advancedBoard.keepouts || [], 10000))) throw new Error('Invalid advanced board.');
    for (const key of ['professional', 'manufacturing']) {
      if (bundle[key] != null && (typeof bundle[key] !== 'object' || Array.isArray(bundle[key]))) {
        throw new Error('Invalid ' + key + ' settings.');
      }
    }
    if(bundle.electrical != null){
      if(!window.PCBProElectrical?.validate)throw new Error('Electrical validator unavailable.');
      const v=window.PCBProElectrical.validate(bundle.electrical);
      if(!v.ok)throw new Error('Invalid electrical installation project: '+v.errors.map(x=>x.field).join(', '));
    }
    validateTree(bundle);
  }

  async function sha256(text) {
    if (!crypto?.subtle?.digest) throw new Error('SHA-256 is unavailable in this browser.');
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer), n => n.toString(16).padStart(2, '0')).join('');
  }

  async function createPackage() {
    const bundle = window.PCBProDatabase?.capture?.();
    if (!bundle) throw new Error('Full project capture engine is not available.');
    validateBundle(bundle);
    const payload = JSON.stringify(bundle);
    if (byteLength(payload) > MAX_BYTES) throw new Error('Project exceeds 8 MB; export was not created.');
    const projectName = String(localStorage.getItem(KEY.name) || document.querySelector('.project-pill b')?.textContent || 'PCB Project').slice(0, 120);
    return {
      format: FORMAT, schema: 1, appVersion: VERSION,
      projectName, capturedAt: new Date().toISOString(),
      sha256: await sha256(payload), bundle
    };
  }

  async function inspect(raw) {
    if (typeof raw !== 'string' || byteLength(raw) > MAX_BYTES + 16384) {
      throw new Error('Portable backup is missing or larger than 8 MB.');
    }
    const pkg = JSON.parse(raw);
    if (!pkg || pkg.format !== FORMAT || pkg.schema !== 1 || !/^[0-9a-f]{64}$/.test(pkg.sha256 || '')) {
      throw new Error('Not a supported SirkuitLab full-project backup.');
    }
    validateBundle(pkg.bundle);
    if ((await sha256(JSON.stringify(pkg.bundle))) !== pkg.sha256) {
      throw new Error('Backup checksum mismatch. File has been modified or corrupted.');
    }
    return {
      projectName: typeof pkg.projectName === 'string' ? pkg.projectName.slice(0, 120) : 'Imported PCB Project',
      counts: {
        components: pkg.bundle.core.components.length,
        wires: pkg.bundle.wiring?.routes?.length || 0,
        tracks: pkg.bundle.board.tracks.length,
        vias: pkg.bundle.advancedBoard?.vias?.length || 0
      },
      bundle: pkg.bundle
    };
  }

  function restore(validated) {
    if (!validated || !validated.bundle) throw new Error('Validate the backup before restoring.');
    validateBundle(validated.bundle);
    const bundle = validated.bundle;
    const ui = bundle.core.ui || {};
    const clamp = (x, fallback, min, max) => Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : fallback;
    const replacements = new Map([
      [KEY.project, JSON.stringify({
        version: VERSION, components: bundle.core.components, savedAt: 'Portable project restore',
        leftWidth: clamp(ui.leftWidth, 258, 190, 430),
        rightWidth: clamp(ui.rightWidth, 282, 220, 430)
      })],
      [KEY.wire, JSON.stringify(bundle.wiring || { version: '2.1.0', routes: [] })],
      [KEY.board, JSON.stringify(bundle.board)],
      [KEY.advanced, bundle.advancedBoard ? JSON.stringify(bundle.advancedBoard) : null],
      [KEY.professional, bundle.professional ? JSON.stringify(bundle.professional) : null],
      [KEY.manufacturing, bundle.manufacturing ? JSON.stringify(bundle.manufacturing) : null],
      [KEY.electrical, bundle.electrical ? JSON.stringify(bundle.electrical) : null],
      [KEY.active, null],
      [KEY.newCloud, '1'],
      [KEY.name, validated.projectName.slice(0, 120)]
    ]);
    const before = new Map();
    for (const key of replacements.keys()) before.set(key, localStorage.getItem(key));
    try {
      for (const [key, value] of replacements) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch (error) {
      for (const [key, oldValue] of before) {
        try {
          if (oldValue === null) localStorage.removeItem(key);
          else localStorage.setItem(key, oldValue);
        } catch {}
      }
      throw new Error('Could not save imported project. Previous local data restore was attempted: ' + (error?.message || error));
    }
    return { ok: true, counts: validated.counts, willReload: true };
  }

  function downloadJson(pkg) {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sirkuitlab-full-project-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function exportFile() {
    try { downloadJson(await createPackage()); }
    catch (error) { alert(tr('Ekspor gagal: ', 'Export failed: ') + (error?.message || error)); }
  }

  function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.size > MAX_BYTES + 16384) throw new Error('File larger than 8 MB.');
        const data = await inspect(await file.text());
        const summary = data.counts.components + ' components, ' + data.counts.wires +
          ' wires, ' + data.counts.tracks + ' tracks, ' + data.counts.vias + ' vias.';
        const warning = tr(
          'Impor lengkap "' + data.projectName + '"?\n' + summary +
          '\n\nData proyek LOKAL saat ini akan ditimpa. Proyek cloud yang lama tidak akan ditimpa. Ekspor backup proyek saat ini terlebih dahulu.',
          'Restore complete "' + data.projectName + '"?\n' + summary +
          '\n\nYour current LOCAL project will be overwritten. The previous cloud project will NOT be overwritten. Export the current project first.'
        );
        if (!confirm(warning)) return;
        restore(data);
        location.reload();
      } catch (error) {
        alert(tr('Impor dibatalkan: ', 'Restore canceled: ') + (error?.message || error));
      }
    }, { once: true });
    input.click();
  }

  function mount() {
    const host = document.querySelector('.top-actions');
    if (!host || document.querySelector('#pcbpro-portable-trigger')) return;
    const button = document.createElement('button');
    button.id = 'pcbpro-portable-trigger';
    button.type = 'button';
    button.textContent = 'BACKUP';
    button.title = tr('Ekspor/impor seluruh proyek PCB', 'Export/import full PCB project');
    button.style.cssText = 'border:1px solid #31545b;border-radius:7px;background:#11242e;color:#b4d9d7;padding:7px 9px;font:800 10px sans-serif';
    button.onclick = () => {
      document.querySelector('#pcbpro-portable-dialog')?.remove();
      const dialog = document.createElement('div');
      dialog.id = 'pcbpro-portable-dialog';
      dialog.style.cssText = 'position:fixed;inset:0;z-index:3200;background:#000b;display:grid;place-items:center;padding:16px';
      const card = document.createElement('section');
      card.style.cssText = 'width:min(460px,95vw);background:#0b1923;border:1px solid #32505c;border-radius:12px;color:#e0ebef;padding:20px;display:grid;gap:12px;font:13px/1.6 system-ui';
      const heading = document.createElement('strong');
      heading.textContent = tr('Backup Proyek Lengkap', 'Complete Project Backup');
      heading.style.fontSize = '17px';
      const note = document.createElement('p');
      note.textContent = tr(
        'Menyimpan komponen, kabel/net graph, track, vias, outline, aturan, dan kalibrasi dalam file lokal. Ini BUKAN backup kunci cloud.',
        'Saves components, wire/net graph, tracks, vias, outline, rules, and calibration into a local file. This is NOT a cloud recovery key.'
      );
      const buttons = document.createElement('div');
      buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
      for (const [caption, fn] of [
        [tr('Ekspor lengkap', 'Export full project'), exportFile],
        [tr('Impor lengkap', 'Restore full project'), importFile],
        [tr('Tutup', 'Close'), () => dialog.remove()]
      ]) {
        const b = document.createElement('button');
        b.textContent = caption;
        b.style.cssText = 'padding:9px 11px;border:1px solid #3a626f;border-radius:7px;background:#112c37;color:#e3f2f4;font-weight:700;cursor:pointer';
        b.onclick = fn;
        buttons.append(b);
      }
      card.append(heading, note, buttons);
      dialog.append(card);
      dialog.onclick = e => { if (e.target === dialog) dialog.remove(); };
      document.body.append(dialog);
    };
    host.append(button);
  }

  window.PCBProPortableBackup = {
    version: VERSION, createPackage, inspect, restore, exportFile, importFile, mount
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();