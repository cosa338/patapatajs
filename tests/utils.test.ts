import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeEasingName,
  normalizePartsFromValue,
  parseJsonLoose,
  pick,
  splitGraphemes,
} from '../src/core/utils.ts';

test('pick returns first non-null value', () => {
  assert.equal(pick<string>(null, undefined, 'a', 'b'), 'a');
  assert.equal(pick(0, 1), 0);
  assert.equal(pick(null, undefined), null);
});

test('normalizeEasingName accepts aliases, rejects junk', () => {
  assert.equal(normalizeEasingName('linear'), 'linear');
  assert.equal(normalizeEasingName(' EASE-IN '), 'ease');
  assert.equal(normalizeEasingName('easein'), 'ease');
  assert.equal(normalizeEasingName('Bounce'), 'bounce');
  assert.equal(normalizeEasingName('ease-bounce'), 'bounce');
  assert.equal(normalizeEasingName('junk'), null);
  assert.equal(normalizeEasingName(null), null);
});

test('splitGraphemes: ascii and emoji clusters', () => {
  assert.deepEqual(splitGraphemes('abc'), ['a', 'b', 'c']);
  // ZWJ family emoji stays a single user-perceived character.
  assert.deepEqual(splitGraphemes('👨‍👩‍👧‍👦x'), ['👨‍👩‍👧‍👦', 'x']);
  // Combining mark stays attached to its base character.
  assert.deepEqual(splitGraphemes('がき'), ['が', 'き']);
  assert.deepEqual(splitGraphemes(''), []);
});

test('parseJsonLoose: only parses JSON-looking strings', () => {
  assert.deepEqual(parseJsonLoose(' [1,2] '), [1, 2]);
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.equal(parseJsonLoose('hello'), null);
  assert.equal(parseJsonLoose('[broken'), null);
  assert.equal(parseJsonLoose(''), null);
  assert.equal(parseJsonLoose(null), null);
});

test('normalizePartsFromValue: plain string becomes single part', () => {
  assert.deepEqual(normalizePartsFromValue('hello'), [['hello']]);
  assert.deepEqual(normalizePartsFromValue(''), [['']]);
});

test('normalizePartsFromValue: flat array is one part with steps', () => {
  assert.deepEqual(normalizePartsFromValue('["a","b"]'), [['a', 'b']]);
});

test('normalizePartsFromValue: nested arrays are multiple parts', () => {
  assert.deepEqual(normalizePartsFromValue('[["a"],["b","c"]]'), [['a'], ['b', 'c']]);
});

test('normalizePartsFromValue: {items:[...]} form', () => {
  assert.deepEqual(normalizePartsFromValue('{"items":["x","y"]}'), [['x', 'y']]);
});

test('normalizePartsFromValue: invalid JSON falls back to raw string', () => {
  assert.deepEqual(normalizePartsFromValue('{broken'), [['{broken']]);
});

test('normalizePartsFromValue: empty array yields one empty part', () => {
  assert.deepEqual(normalizePartsFromValue('[]'), [['']]);
});

test('normalizePartsFromValue: non-string items are stringified', () => {
  assert.deepEqual(normalizePartsFromValue('[1,null,true]'), [['1', '', 'true']]);
});
