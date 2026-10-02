import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProject, MAX_PROJECT_BYTES } from './project.js';

const part = { id: 'R1', code: 'R', name: 'Resistor', value: '330 Ω', footprint: 'R_0805', sx: 20, sy: 30, px: 40, py: 50, rot: 0 };
/** @param {unknown[]} components @param {Record<string, unknown>} extra */
const encode = (components = [part], extra = {}) => JSON.stringify({ components, ...extra });

test('legacy and current exports round trip without losing component fields', () => {
  for (const extra of [{}, { version: '1.2.0', nets: [] }]) {
    assert.deepEqual(parseProject(encode([part], extra)).components, [part]);
  }
});
test('empty projects are valid', () => assert.deepEqual(parseProject(encode([])).components, []));
test('rejects corrupt or ambiguous projects before replacing existing state', () => {
  for (const raw of ['null', '{}', '{', encode([part, part]), encode([{ ...part, sx: '20' }]), encode([{ ...part, py: 101 }]), encode([{ ...part, rot: null }]), encode([{ ...part, id: '' }]), encode([{ ...part, name: {} }])]) {
    assert.throws(() => parseProject(raw));
  }
});
test('bounds file size and component count', () => {
  assert.throws(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1)), /2 MB/);
  assert.throws(() => parseProject(encode(Array(5001).fill(part))), /component list/);
});
test('normalizes rotations and clamps restored panels', () => {
  const result = parseProject(encode([{ ...part, rot: -90 }], { leftWidth: -100, rightWidth: 10000 }));
  assert.equal(result.components[0].rot, 270);
  assert.equal(result.leftWidth, 190);
  assert.equal(result.rightWidth, 430);
});
