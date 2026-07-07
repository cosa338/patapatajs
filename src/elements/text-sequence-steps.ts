
import { normalizePartsFromValue, splitGraphemes } from '../core/utils.ts';
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

function ensureStepSequence(opts: {
  host: TextSequenceHost;
  atomic: boolean;
  interval: number;
  layout: SequenceState['layout'];
  repeat: boolean;
  value: string;
  shuffleTimeMs: number;
  applyPartText: (part: SequencePart, raw: string, now: number, atomic: boolean) => void;
}): boolean {
  const { host, atomic, interval, layout, repeat, value, shuffleTimeMs, applyPartText } = opts;
  const partsItems = normalizePartsFromValue(value);

  const steps = Math.max(1, ...partsItems.map((arr) => (Array.isArray(arr) ? arr.length : 0)));
  if (steps <= 1) {
    // JSON but only one step -> no sequencing needed.
    return false;
  }
  const paddedParts = partsItems.map((arr) => {
    const out = [];
    for (let i = 0; i < steps; i++) out.push(arr[i] ?? '');
    return out;
  });

  // For shuffle, do NOT include padded empty values as candidates.
  const partsForMode = shuffleTimeMs > 0 ? partsItems : paddedParts;

  const alignWidth = host.hasAttribute('align-width');
  const globalMaxLen = (!atomic && alignWidth)
    ? Math.max(1, ...partsForMode.flat().map((s) => splitGraphemes(String(s ?? '')).length))
    : null;

  // Build/refresh part flippers. Keep counts stable by padding each item to max grapheme length.
  const parts = partsForMode.map((items) => {
    let maxLen = 1;
    if (!atomic) {
      if (typeof globalMaxLen === 'number') {
        maxLen = globalMaxLen;
      } else {
        for (const s of items) {
          const len = splitGraphemes(String(s ?? '')).length;
          if (len > maxLen) maxLen = len;
        }
      }
    }

    const initial = items[0] ?? '';
    const initialTokens = atomic ? [String(initial)] : (() => {
      const g = splitGraphemes(initial);
      const out = [];
      for (let i = 0; i < maxLen; i++) out.push(g[i] ?? '');
      return out;
    })();

    const flippers = [];
    for (let i = 0; i < initialTokens.length; i++) flippers.push(new Flipper(initialTokens[i] ?? ''));
    return { items, maxLen, flippers };
  });

  host._sequence = {
    mode: shuffleTimeMs > 0 ? 'shuffle' : 'sequence',
    layout,
    repeat,
    steps,
    stepIndex: 0,
    shuffleEndAt: shuffleTimeMs > 0 ? (performance.now() + shuffleTimeMs) : null,
    parts: parts.map((p) => ({
      ...p,
      currentText: String(p.items[0] ?? ''),
      lastIndex: 0,
    })),
  };

  const stepSequenceOnce = () => {
    if (!host._sequence) return;
    const nextIndex = host._sequence.stepIndex + 1;
    if (!host._sequence.repeat && nextIndex >= host._sequence.steps) {
      host._sequence.stepIndex = host._sequence.steps - 1;
      // Keep the final frame visible; stop timers but keep sequence state.
      host._timer = null;
      host._render(performance.now());
      return;
    }

    host._sequence.stepIndex = host._sequence.repeat ? (nextIndex % host._sequence.steps) : nextIndex;

    const now = performance.now();
    for (const p of host._sequence.parts) {
      const raw = p.items[host._sequence.stepIndex] ?? '';
      applyPartText(p, raw, now, atomic);
    }

    // Timer-driven stepping shouldn't recompute CSS-derived config every time.
    host._render(now, true);
    host._ensureRaf();
    host._timer = setTimeout(stepSequenceOnce, interval);
  };

  const stepShuffleOnce = () => {
    if (!host._sequence) return;
    const now = performance.now();
    const endAt = host._sequence.shuffleEndAt;
    if (typeof endAt === 'number' && Number.isFinite(endAt) && now >= endAt) {
      // Stop on current result (do not reset / loop automatically).
      host._timer = null;
      host._render(now, true);
      return;
    }

    for (const p of host._sequence.parts) {
      const n = Array.isArray(p.items) ? p.items.length : 0;
      if (n <= 0) continue;
      let idx = Math.floor(Math.random() * n);
      if (n >= 2 && idx === p.lastIndex) idx = (idx + 1 + Math.floor(Math.random() * (n - 1))) % n;
      p.lastIndex = idx;
      const raw = p.items[idx] ?? '';
      applyPartText(p, raw, now, atomic);
    }

    // Timer-driven stepping shouldn't recompute CSS-derived config every time.
    host._render(now, true);
    host._ensureRaf();
    host._timer = setTimeout(stepShuffleOnce, interval);
  };

  // Start stepping from the current (initial) frame.
  host._timer = setTimeout(shuffleTimeMs > 0 ? stepShuffleOnce : stepSequenceOnce, interval);
  return true;
}

export { ensureStepSequence };
