// @ts-check

import { normalizePartsFromValue, parseJsonLoose, splitGraphemes } from '../core/utils.ts';
import { calcAtomicCardWidthPx } from '../render/draw.ts';
import type { BaseConfig, GeomPart, LayoutCache, SequenceState, VisualConfig } from './types.ts';

interface LayoutHost {
  _layoutDirty: boolean;
  _layoutCache: LayoutCache | null;
  _sequence: SequenceState | null;
}

interface LayoutResult {
  geomParts: GeomPart[];
  totalW: number;
  totalH: number;
  outerPadX: number;
  partsItems: string[][];
  useParts: boolean;
}

function buildHalfScales(v: VisualConfig, halfHead: number, halfTail: number, count: number) {
  const n = Math.max(0, Math.floor(count || 0));
  if (n <= 0) return [];
  if (v.atomic) {
    const enable = halfHead > 0 || halfTail > 0;
    return Array.from({ length: n }, () => (enable ? 0.5 : 1));
  }
  const out = Array.from({ length: n }, () => 1);
  const hHead = Math.min(n, halfHead);
  const hTail = Math.min(n, halfTail);
  for (let i = 0; i < hHead; i++) out[i] = 0.5;
  for (let i = n - hTail; i < n; i++) {
    if (i >= 0 && i < n) out[i] = 0.5;
  }
  return out;
}

function buildOffsetsAndWidth(v: VisualConfig, count: number, cardWidthPx: number, scales: number[]) {
  const n = Math.max(0, Math.floor(count || 0));
  const s = Array.isArray(scales) && scales.length === n ? scales : Array.from({ length: n }, () => 1);
  const offsets = new Array(n);
  let x = 0;
  for (let i = 0; i < n; i++) {
    offsets[i] = x;
    const w = cardWidthPx * (s[i] || 1);
    if (i < n - 1) {
      const g = v.gap * Math.min((s[i] || 1), (s[i + 1] || 1));
      x += w + g;
    } else {
      x += w;
    }
  }
  return { offsets, partW: x };
}

function resolveTextLayout(opts: {
  host: LayoutHost;
  cfg: BaseConfig;
  fromRaf: boolean;
  layout: 'row' | 'stack';
  alignWidth: boolean;
  halfHead: number;
  halfTail: number;
  ctx: CanvasRenderingContext2D;
}): LayoutResult {
  const { host, cfg, fromRaf, layout, alignWidth, halfHead, halfTail, ctx } = opts;
  const v = cfg.visual;
  const isSequencing = !!host._sequence;

  const cachedLayout = (() => {
    if (!(fromRaf && !host._layoutDirty && host._layoutCache)) return null;
    const c = host._layoutCache;
    if (!isSequencing || !host._sequence) return c;

    // If flipper counts changed (e.g. diff digits grow/shrink, '-' appears),
    // the cached geometry can clip the right edge. Validate counts before reuse.
    if (!c.geomParts || c.geomParts.length !== host._sequence.parts.length) return null;
    for (let i = 0; i < host._sequence.parts.length; i++) {
      const expected = v.atomic ? 1 : host._sequence.parts[i].flippers.length;
      if ((c.geomParts[i]?.count ?? 0) !== expected) return null;
    }
    return c;
  })();
  const partsItems = cachedLayout ? cachedLayout.partsItems : normalizePartsFromValue(cfg.value);
  const isJsonValue = cachedLayout ? cachedLayout.isJsonValue : (parseJsonLoose(cfg.value) != null);
  const useParts = isJsonValue;

  let geomParts: GeomPart[];
  let totalW: number;
  let totalH: number;
  let outerPadX: number;

  if (cachedLayout) {
    ({ geomParts, totalW, totalH, outerPadX } = cachedLayout);
    return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
  }

  const fontKey = ctx.font;
  const layoutKey = [
    cfg.value,
    v.atomic ? 'a1' : 'a0',
    layout,
    alignWidth ? 'w1' : 'w0',
    `hh${halfHead}`,
    `ht${halfTail}`,
    v.cardWidth,
    v.cardHeight,
    v.gap,
    v.radius,
    fontKey,
  ].join('|');

  if (!host._layoutDirty && host._layoutCache && host._layoutCache.key === layoutKey) {
    ({ geomParts, totalW, totalH, outerPadX } = host._layoutCache);
    return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
  }

  // Compute layout/geometry (expensive) only when needed.
  const globalMaxLen = (!v.atomic && useParts && alignWidth)
    ? Math.max(1, ...partsItems.flat().map((s) => splitGraphemes(String(s ?? '')).length))
    : null;

  const globalAtomicCardWidthPx = (v.atomic && alignWidth)
    ? (() => {
      let best = calcAtomicCardWidthPx(ctx, '', v);
      // For non-JSON (rand/static), partsItems will be [[value]]. For JSON, scan all candidates.
      for (const partArr of partsItems) {
        for (const it of (partArr || [])) {
          const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ''), v);
          if (wpx > best) best = wpx;
        }
      }
      return best;
    })()
    : null;

  outerPadX = v.gap / 2;

  if (isSequencing && host._sequence) {
    // Sequencing mode: geometry is driven by stable flipper counts.
    geomParts = host._sequence.parts.map((sp, idx) => {
      const partItems = partsItems[idx] || [];
      const atomicText = String(sp.currentText ?? (sp.items && sp.items[0] ? sp.items[0] : ''));

      const cardWidthPx = v.atomic
        ? (() => {
          if (typeof globalAtomicCardWidthPx === 'number') return globalAtomicCardWidthPx;
          let best = calcAtomicCardWidthPx(ctx, atomicText, v);
          if (useParts) {
            for (const it of partItems) {
              const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ''), v);
              if (wpx > best) best = wpx;
            }
          }
          return best;
        })()
        : v.cardWidth;

      const count = v.atomic ? 1 : sp.flippers.length;
      const scales = buildHalfScales(v, halfHead, halfTail, count);
      const { offsets, partW } = buildOffsetsAndWidth(v, count, cardWidthPx, scales);
      return { count, cardWidthPx, partW, tokens: null, scales, offsets };
    });
  } else {
    const itemsToDraw = useParts
      ? partsItems.map((arr) => ((Array.isArray(arr) && arr.length) ? (arr[0] ?? '') : ''))
      : [String(cfg.value || '')];

    geomParts = itemsToDraw.map((text, idx) => {
      const partItems = partsItems[idx] || [];
      const atomicText = String(text ?? '');

      const cardWidthPx = v.atomic
        ? (() => {
          if (typeof globalAtomicCardWidthPx === 'number') return globalAtomicCardWidthPx;
          let best = calcAtomicCardWidthPx(ctx, atomicText, v);
          if (useParts) {
            for (const it of partItems) {
              const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ''), v);
              if (wpx > best) best = wpx;
            }
          }
          return best;
        })()
        : v.cardWidth;

      const partMaxLen = (!v.atomic && useParts)
        ? (typeof globalMaxLen === 'number'
          ? globalMaxLen
          : Math.max(1, ...partItems.map((s) => splitGraphemes(String(s ?? '')).length)))
        : null;

      const tokens = v.atomic
        ? [atomicText]
        : (() => {
          const g = splitGraphemes(atomicText);
          if (typeof partMaxLen !== 'number') return g;
          const out = [];
          for (let i = 0; i < partMaxLen; i++) out.push(g[i] ?? '');
          return out;
        })();

      const count = v.atomic
        ? 1
        : (typeof partMaxLen === 'number' ? partMaxLen : Math.max(1, tokens.length));
      const scales = buildHalfScales(v, halfHead, halfTail, count);
      const { offsets, partW } = buildOffsetsAndWidth(v, count, cardWidthPx, scales);
      return { count, cardWidthPx, partW, tokens, scales, offsets };
    });
  }

  totalH = (layout === 'stack' && geomParts.length > 1)
    ? (v.cardHeight * geomParts.length + v.gap * (geomParts.length - 1))
    : v.cardHeight;

  totalW = outerPadX * 2 + ((layout === 'row' && geomParts.length > 1)
    ? (geomParts.reduce((sum, p) => sum + p.partW, 0) + v.gap * (geomParts.length - 1))
    : Math.max(...geomParts.map((p) => p.partW)));

  host._layoutCache = {
    key: layoutKey,
    partsItems,
    isJsonValue,
    geomParts,
    totalW,
    totalH,
    outerPadX,
  };
  host._layoutDirty = false;

  return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
}

export { resolveTextLayout };
