import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProject, MAX_PROJECT_BYTES, MAX_COMPONENTS } from './project.js';

const part = { id: 'R1', code: 'R', name: 'Resistor', value: '330 Ω', footprint: 'R_0805', sx: 20, sy: 30, px: 40, py: 50, rot: 0 };
/** @param {unknown[]} components @param {Record<string, unknown>} extra */
const encode = (components = [part], extra = {}) => JSON.stringify({ components, ...extra });

test('legacy and current exports preserve core component fields', () => {
  for (const extra of [{}, { version: '1.19.0', nets: [] }]) {
    const restored = parseProject(encode([part], extra)).components[0];
    assert.equal(restored.id, part.id);
    assert.equal(restored.code, part.code);
    assert.equal(restored.name, part.name);
    assert.equal(restored.value, part.value);
    assert.equal(restored.footprint, part.footprint);
    assert.equal(restored.sx, part.sx);
    assert.equal(restored.sy, part.sy);
    assert.equal(restored.px, part.px);
    assert.equal(restored.py, part.py);
    assert.equal(restored.rot, part.rot);
  }
});

test('extended catalog metadata survives import validation', () => {
  const extended = {
    ...part,
    catalogKey:'resistor-0603-10k',
    group:'Passives',
    pinCount:2,
    kind:'template',
    manufacturer:'Example',
    mpn:'EX-10K',
    tags:['resistor','0603'],
    description:'Validated metadata'
  };
  const restored = parseProject(encode([extended])).components[0];
  assert.equal(restored.catalogKey, extended.catalogKey);
  assert.equal(restored.pinCount, 2);
  assert.deepEqual(restored.tags, extended.tags);
  assert.equal(restored.mpn, extended.mpn);
});

test('empty projects are valid', () => assert.deepEqual(parseProject(encode([])).components, []));

test('rejects corrupt or ambiguous projects before replacing existing state', () => {
  for (const raw of [
    'null', '{}', '{', encode([part, part]),
    encode([{ ...part, sx: '20' }]), encode([{ ...part, py: 101 }]),
    encode([{ ...part, rot: null }]), encode([{ ...part, id: '' }]),
    encode([{ ...part, name: {} }]), encode([{ ...part, pinCount:-1 }]),
    encode([{ ...part, tags:['ok', 7] }])
  ]) assert.throws(() => parseProject(raw));
});

test('bounds file size and component count', () => {
  assert.throws(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1)), /2 MB/);
  assert.throws(() => parseProject(encode(Array(MAX_COMPONENTS + 1).fill(part))), /component list/);
});

test('normalizes rotations and clamps restored panels', () => {
  const result = parseProject(encode([{ ...part, rot: -90 }], { leftWidth: -100, rightWidth: 10000 }));
  assert.equal(result.components[0].rot, 270);
  assert.equal(result.leftWidth, 190);
  assert.equal(result.rightWidth, 430);
});
