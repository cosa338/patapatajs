import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDiffTargetMs,
  clampNonNegativeMs,
  buildClockPanels,
  clockProbeTextFromFormat,
  buildTimerPanels,
  timerProbeTextFromFormat,
} from '../src/core/time-format.ts';

test('parseDiffTargetMs: numeric string is epoch ms', () => {
  assert.equal(parseDiffTargetMs('1700000000000'), 1700000000000);
  assert.equal(parseDiffTargetMs('0'), 0);
});

test('parseDiffTargetMs: YYYY-MM-DD resolves to local midnight', () => {
  assert.equal(parseDiffTargetMs('2030-01-02'), new Date(2030, 0, 2, 0, 0, 0, 0).getTime());
});

test('parseDiffTargetMs: rejects impossible calendar dates', () => {
  assert.equal(parseDiffTargetMs('2026-02-30'), null);
  assert.equal(parseDiffTargetMs('2026-13-01'), null);
  // Leap year handling.
  assert.equal(parseDiffTargetMs('2028-02-29'), new Date(2028, 1, 29).getTime());
  assert.equal(parseDiffTargetMs('2026-02-29'), null);
});

test('parseDiffTargetMs: falls back to Date.parse, null for garbage', () => {
  assert.equal(parseDiffTargetMs('not-a-date'), null);
  assert.equal(parseDiffTargetMs(''), null);
  assert.equal(parseDiffTargetMs(null), null);
  assert.equal(parseDiffTargetMs('2030-01-02T03:04:05Z'), Date.UTC(2030, 0, 2, 3, 4, 5));
});

test('clampNonNegativeMs', () => {
  assert.equal(clampNonNegativeMs(-5), 0);
  assert.equal(clampNonNegativeMs(NaN), 0);
  assert.equal(clampNonNegativeMs(42), 42);
});

test('buildClockPanels: HH:mm:ss splits into one grapheme per panel', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5, 678);
  const { tokens, isMsPanel } = buildClockPanels('HH:mm:ss', date, null);
  assert.deepEqual(tokens, ['0', '3', ':', '0', '4', ':', '0', '5']);
  assert.equal(isMsPanel.some(Boolean), false);
});

test('buildClockPanels: ms tokens are flagged as ms panels', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5, 678);
  const { tokens, isMsPanel } = buildClockPanels('ss.SSS', date, null);
  assert.deepEqual(tokens, ['0', '5', '.', '6', '7', '8']);
  assert.deepEqual(isMsPanel, [false, false, false, true, true, true]);
});

test('buildClockPanels: 12-hour clock and am/pm', () => {
  const am = new Date(2026, 0, 2, 0, 0, 0, 0);
  assert.deepEqual(buildClockPanels('HH12 ampm', am, null).tokens, ['1', '2', ' ', 'A', 'M']);
  const pm = new Date(2026, 0, 2, 13, 0, 0, 0);
  assert.deepEqual(buildClockPanels('HH12 ampm_jp', pm, null).tokens, ['0', '1', ' ', '午', '後']);
});

test('buildClockPanels: day-of-week tokens', () => {
  const sunday = new Date(2026, 0, 4); // 2026-01-04 is a Sunday
  assert.deepEqual(buildClockPanels('ddd', sunday, null).tokens, ['S', 'U', 'N']);
  assert.deepEqual(buildClockPanels('ddd_jp', sunday, null).tokens, ['日']);
});

test('buildClockPanels: diff mode shows sign on total tokens', () => {
  const d = new Date();
  assert.deepEqual(buildClockPanels('sss', d, -5000).tokens, ['-', '5']);
  assert.deepEqual(buildClockPanels('sss', d, 5000).tokens, ['5']);
  // HH/mm/ss stay unsigned absolute values.
  assert.deepEqual(buildClockPanels('ss', d, -5000).tokens, ['0', '5']);
});

test('buildClockPanels: diff mode min-digits padding', () => {
  const d = new Date();
  assert.deepEqual(buildClockPanels('sss', d, 5000, 3).tokens, ['0', '0', '5']);
  assert.deepEqual(buildClockPanels('sss', d, -5000, 3).tokens, ['-', '0', '0', '5']);
});

test('buildClockPanels: grapheme-aware literals (emoji)', () => {
  const date = new Date(2026, 0, 2, 3, 4, 5, 0);
  const { tokens } = buildClockPanels('HH🎌mm', date, null);
  assert.deepEqual(tokens, ['0', '3', '🎌', '0', '4']);
});

test('clockProbeTextFromFormat', () => {
  assert.equal(clockProbeTextFromFormat('HH:mm:ss'), '88:88:88');
  assert.equal(clockProbeTextFromFormat('DDD'), '8888');
  assert.equal(clockProbeTextFromFormat('DDD', 6), '888888');
  assert.equal(clockProbeTextFromFormat('ddd_jp ampm_jp'), '水 午後');
});

test('buildTimerPanels: basic formats', () => {
  assert.deepEqual(buildTimerPanels('HHH:mm:ss', 3661000).tokens, ['1', ':', '0', '1', ':', '0', '1']);
  assert.deepEqual(buildTimerPanels('mm:ss.S', 61234).tokens, ['0', '1', ':', '0', '1', '.', '2']);
});

test('buildTimerPanels: negative elapsed clamps to zero', () => {
  assert.deepEqual(buildTimerPanels('ss', -1000).tokens, ['0', '0']);
});

test('buildTimerPanels: min-digits pads total tokens', () => {
  assert.deepEqual(buildTimerPanels('sss', 5000, 4).tokens, ['0', '0', '0', '5']);
});

test('timerProbeTextFromFormat', () => {
  assert.equal(timerProbeTextFromFormat('HHH:mm:ss'), '8888:88:88');
  assert.equal(timerProbeTextFromFormat('mm:ss.SSS'), '88:88.888');
  assert.equal(timerProbeTextFromFormat('sss', 6), '888888');
});
