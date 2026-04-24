// @ts-check

import { resolveTextLayout } from './text-layout.ts';
import { drawTextFrame } from './text-draw.ts';
import type { BaseConfig, LayoutCache, SequenceState } from './types.ts';

interface TextRenderHost {
  _cfg: BaseConfig | null;
  _visualDirty: boolean;
  _layoutDirty: boolean;
  _layoutCache: LayoutCache | null;
  _sequence: SequenceState | null;
  _canvas: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  _readConfig: () => BaseConfig;
  _isPaintSuppressed: () => boolean;
  _refreshIntersectionIfStale: () => void;
  _applyAutoAriaLabel: (labelText: string) => void;
  hasAttribute: (name: string) => boolean;
}

function renderText(host: TextRenderHost, now: number, fromRaf = false) {
  if (host._isPaintSuppressed()) {
    host._refreshIntersectionIfStale();
    if (host._isPaintSuppressed()) {
      // Defer all heavy work until we become visible again.
      host._layoutDirty = true;
      host._visualDirty = true;
      return;
    }
  }

  const cfg = (fromRaf && host._cfg && !host._visualDirty) ? host._cfg : host._readConfig();
  host._cfg = cfg;
  host._visualDirty = false;

  const v = cfg.visual;

  const layout = host.hasAttribute('stack') ? 'stack' : 'row';
  const alignWidth = host.hasAttribute('align-width');

  const halfHead = Math.max(0, Math.floor(cfg.halfHead || 0));
  const halfTail = Math.max(0, Math.floor(cfg.halfTail || 0));

  const ctx = host._ctx;
  const applyTextState = () => {
    ctx.font = `${v.font.weight} ${v.font.sizePx}px ${v.font.family}`;
    const align = v.text.align;
    ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
    // textBaseline='middle' can drift visually depending on font metrics.
    // Use 'alphabetic' and compute the y-position from ascent/descent.
    ctx.textBaseline = 'alphabetic';
  };

  applyTextState();

  const { geomParts, totalW, totalH, outerPadX, partsItems, useParts } = resolveTextLayout({
    host,
    cfg,
    fromRaf,
    layout,
    alignWidth,
    halfHead,
    halfTail,
    ctx,
  });
  const isSequencing = !!host._sequence;
  const dpr = window.devicePixelRatio || 1;

  const pxW = Math.max(1, Math.floor(totalW * dpr));
  const pxH = Math.max(1, Math.floor(totalH * dpr));
  const needsResize = host._canvas.width !== pxW || host._canvas.height !== pxH;
  const cssW = `${totalW}px`;
  const cssH = `${totalH}px`;
  const needsStyle = host._canvas.style.width !== cssW || host._canvas.style.height !== cssH;
  if (needsResize) {
    host._canvas.width = pxW;
    host._canvas.height = pxH;
    host._canvas.style.width = cssW;
    host._canvas.style.height = cssH;
    host._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    applyTextState();
  } else if (needsStyle) {
    host._canvas.style.width = cssW;
    host._canvas.style.height = cssH;
  } else {
    host._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  ctx.clearRect(0, 0, totalW, totalH);
  drawTextFrame({
    host,
    cfg,
    layout,
    geomParts,
    outerPadX,
    partsItems,
    useParts,
    now,
    ctx,
    dpr,
  });
}

export { renderText };
