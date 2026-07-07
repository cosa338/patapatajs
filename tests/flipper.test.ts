import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Flipper } from '../src/render/flipper.ts';
import { applyPanelTokensToPart, buildSinglePartSequence } from '../src/elements/shared.ts';

test('transitionTo to the same value is a no-op', () => {
  const f = new Flipper('A');
  f.transitionTo('A', 0);
  assert.equal(f.animations.length, 0);
  assert.equal(f.baseValue, 'A');
});

test('transitionTo records from/to and updates baseValue', () => {
  const f = new Flipper('A');
  f.transitionTo('B', 100, 500);
  assert.equal(f.baseValue, 'B');
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].from, 'A');
  assert.equal(f.animations[0].to, 'B');
  assert.equal(f.animations[0].durationMs, 500);
});

test('newest animation sits at the front of the queue', () => {
  const f = new Flipper('A');
  f.transitionTo('B', 0, 1000);
  f.transitionTo('C', 10, 1000);
  assert.equal(f.animations[0].to, 'C');
  assert.equal(f.animations[1].to, 'B');
});

test('update culls expired animations', () => {
  const f = new Flipper('A');
  f.transitionTo('B', 0, 100);
  f.transitionTo('C', 0, 1000);
  f.update(500, 1000);
  assert.equal(f.animations.length, 1);
  assert.equal(f.animations[0].to, 'C');
});

test('transitionTo culls expired animations without waiting for update()', () => {
  const f = new Flipper('0');
  // Simulate a hidden clock: ticks keep feeding values, update() never runs.
  for (let i = 1; i <= 100; i++) {
    f.transitionTo(String(i), i * 1000, 400);
  }
  // Each 400ms flip has expired long before the next 1000ms tick.
  assert.equal(f.animations.length, 1);
  assert.equal(f.baseValue, '100');
});

test('animations without own duration are capped', () => {
  const f = new Flipper('0');
  // Same timestamp so nothing can be culled by elapsed time.
  for (let i = 1; i <= 100; i++) {
    f.transitionTo(String(i), 0);
  }
  assert.ok(f.animations.length <= 64);
  // Newest transition is preserved, oldest ones were dropped.
  assert.equal(f.animations[0].to, '100');
});

test('setValue clears pending animations', () => {
  const f = new Flipper('A');
  f.transitionTo('B', 0, 1000);
  f.setValue('Z');
  assert.equal(f.baseValue, 'Z');
  assert.equal(f.animations.length, 0);
  assert.equal(f.hasActive(), false);
});

test('applyPanelTokensToPart keeps one blank panel for empty tokens', () => {
  const { part } = buildSinglePartSequence('static', 'ABC', ['A', 'B', 'C'], false);
  applyPanelTokensToPart({
    part,
    tokens: [],
    isMsPanel: [],
    atomic: false,
    durationNormal: 1000,
    durationMsFixed: 400,
    nowTs: 0,
    allowRebuild: true,
  });

  assert.equal(part.flippers.length, 1);
  assert.equal(part.flippers[0].baseValue, '');
});
