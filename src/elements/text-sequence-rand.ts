
import { attrBool, attrNumber, splitGraphemes } from '../core/utils.ts';
import { JS_DEFAULTS } from '../render/runtime.ts';
import { randomIntInclusive, RandomText } from '../render/random-text.ts';
import { Flipper } from '../render/flipper.ts';
import type { BaseConfig, SequencePart, SequenceState } from './types.ts';

interface TextSequenceHost {
  _sequence: SequenceState | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _readConfig: () => BaseConfig;
  _render: (now: number, fromRaf?: boolean) => void;
  _ensureRaf: () => void;
  hasAttribute: (name: string) => boolean;
}

function ensureRandSequence(opts: {
  host: TextSequenceHost;
  atomic: boolean;
  interval: number;
  layout: SequenceState['layout'];
  repeat: boolean;
  value: string;
  applyPartText: (part: SequencePart, raw: string, now: number, atomic: boolean) => void;
}): boolean {
  const { host, atomic, interval, layout, repeat, value, applyPartText } = opts;
  const randEnabled = attrBool(host as unknown as Element, 'rand', false);
  if (!randEnabled) {
    return false;
  }

  // Rand effect: show random characters for a while, then settle on the target value.
  const target = String(value ?? '');

  const minAttr = attrNumber(host as unknown as Element, 'rand-min');
  const maxAttr = attrNumber(host as unknown as Element, 'rand-max');
  const hasMin = typeof minAttr === 'number' && Number.isFinite(minAttr) && minAttr >= 0;
  const hasMax = typeof maxAttr === 'number' && Number.isFinite(maxAttr) && maxAttr >= 0;

  let randMin;
  let randMax;
  if (!hasMin && !hasMax) {
    randMin = JS_DEFAULTS.randMin;
    randMax = JS_DEFAULTS.randMax;
  } else if (!hasMin && hasMax) {
    randMax = maxAttr;
    randMin = Math.floor(randMax / 2);
  } else if (hasMin && !hasMax) {
    randMin = minAttr;
    randMax = randMin * 2;
  } else {
    randMin = minAttr;
    randMax = maxAttr;
  }
  randMin = Math.max(0, randMin);
  randMax = Math.max(0, randMax);
  if (randMax < randMin) randMax = randMin;

  const targetTokens = atomic ? [target] : splitGraphemes(target);
  const count = Math.max(1, targetTokens.length);

  const sources = atomic
    ? [target ? RandomText.pickSourceForAtomicString(target) : null]
    : targetTokens.map((t) => RandomText.pickSourceForChar(t));
  const remaining = sources.map((s) => (s ? randomIntInclusive(randMin, randMax) : 0));

  const initialText = atomic
    ? (sources[0] ? RandomText.blankForSource(sources[0]) : target)
    : targetTokens.map((t, idx) => (sources[idx] ? RandomText.blankForSource(sources[idx]) : String(t ?? ''))).join('');

  const flippers = [];
  for (let i = 0; i < count; i++) flippers.push(new Flipper(''));

  const part: SequencePart = {
    items: [target],
    maxLen: atomic ? 1 : count,
    flippers,
    currentText: initialText,
    lastIndex: 0,
  };

  // Apply initial display without animation.
  if (atomic) {
    part.flippers[0].setValue(initialText);
  } else {
    const initTokens = splitGraphemes(initialText);
    for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initTokens[i] ?? '');
  }

  host._sequence = {
    mode: 'rand',
    layout,
    repeat,
    steps: 1,
    stepIndex: 0,
    shuffleEndAt: null,
    parts: [part],
  };

  const stepRandOnce = () => {
    if (!host._sequence || !host._sequence.parts.length) return;
    const now = performance.now();

    if (!remaining.some((n) => n > 0)) {
      applyPartText(part, atomic ? target : targetTokens.join(''), now, atomic);
      host._timer = null;
      host._render(now);
      host._ensureRaf();
      return;
    }

    let nextText;
    if (atomic) {
      const src = sources[0];
      if (src && remaining[0] > 0) {
        remaining[0] = Math.max(0, remaining[0] - 1);
        const len = splitGraphemes(target).length;
        nextText = Array.from({ length: len }, () => RandomText.randomCharFromSource(src)).join('');
      } else {
        nextText = target;
      }
    } else {
      const arr = targetTokens.map((c, idx) => {
        const src = sources[idx];
        if (!src) return c;
        if (remaining[idx] > 0) {
          remaining[idx] = Math.max(0, remaining[idx] - 1);
          return RandomText.randomCharFromSource(src);
        }
        return c;
      });
      nextText = arr.join('');
    }

    applyPartText(part, nextText, now, atomic);
    host._render(now);
    host._ensureRaf();
    host._timer = setTimeout(stepRandOnce, interval);
  };

  host._render(performance.now());
  host._timer = setTimeout(stepRandOnce, interval);
  return true;
}

export { ensureRandSequence };
