// @ts-check

import { attrNumber, parseJsonLoose, splitGraphemes } from '../core/utils.ts';
import { JS_DEFAULTS } from '../render/runtime.ts';
import { Flipper } from '../render/flipper.ts';
import type { BaseConfig, SequencePart, SequenceState } from './types.ts';
import { ensureRandSequence } from './text-sequence-rand.ts';
import { ensureStepSequence } from './text-sequence-steps.ts';

interface TextSequenceHost {
  _sequence: SequenceState | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _readConfig: () => BaseConfig;
  _render: (now: number, fromRaf?: boolean) => void;
  _ensureRaf: () => void;
  hasAttribute: (name: string) => boolean;
}

function applyPartText(part: SequencePart, raw: string, now: number, atomic: boolean) {
  part.currentText = String(raw ?? '');
  const tokens = atomic ? [part.currentText] : (() => {
    const g = splitGraphemes(part.currentText);
    const out = [];
    for (let i = 0; i < part.maxLen; i++) out.push(g[i] ?? '');
    return out;
  })();

  while (part.flippers.length < tokens.length) part.flippers.push(new Flipper(''));
  if (part.flippers.length > tokens.length) part.flippers.length = tokens.length;

  for (let i = 0; i < part.flippers.length; i++) {
    part.flippers[i].transitionTo(tokens[i] ?? '', now);
  }
}

function ensureTextSequence(host: TextSequenceHost) {
  const cfg = host._readConfig();

  const atomic = !!(cfg.visual && cfg.visual.atomic);
  const interval = Math.max(1, cfg.interval || JS_DEFAULTS.interval);
  const repeat = host.hasAttribute('repeat');
  const layout: SequenceState['layout'] = host.hasAttribute('stack') ? 'stack' : 'row';

  const shuffleTimeAttr = attrNumber(host as unknown as Element, 'shuffle-time');
  const shuffleTimeMs = (typeof shuffleTimeAttr === 'number' && Number.isFinite(shuffleTimeAttr) && shuffleTimeAttr > 0)
    ? shuffleTimeAttr
    : 0;

  const parsed = parseJsonLoose(cfg.value);
  if (parsed == null) {
    const handled = ensureRandSequence({
      host,
      atomic,
      interval,
      layout,
      repeat,
      value: String(cfg.value ?? ''),
      applyPartText,
    });
    if (!handled) host._render(performance.now());
    return;
  }

  const handled = ensureStepSequence({
    host,
    atomic,
    interval,
    layout,
    repeat,
    value: String(cfg.value ?? ''),
    shuffleTimeMs,
    applyPartText,
  });
  if (!handled) host._render(performance.now());
}

export type { TextSequenceHost };
export { applyPartText, ensureTextSequence };
