// @ts-check

import { normalizeEasingName } from '../core/utils.ts';
import { RUNTIME } from './runtime.ts';

function cfgBgKey(cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  // Only include values that affect the background pixels.
  return [
    v.colors.panelTop,
    v.colors.panelBottom,
    v.radius,
    v.edge.insetShadeStrength,
    v.edge.sizePx,
    v.colors.edge,
  ].join('|');
}

function touchLru(map, key, value) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  if (map.size <= RUNTIME.canvasBgCacheLimit) return;
  const oldestKey = map.keys().next().value;
  if (oldestKey != null) {
    map.delete(oldestKey);
    RUNTIME.cacheStats.evictions++;
  }
}

function makeOffscreenCanvas(wPx, hPx) {
  const c = document.createElement('canvas');
  // Use ceil to avoid clipping a fractional DPR-scaled size.
  // Clipped edges can become transparent seams that reveal underlying layers
  // (most visible with atomic widths derived from measureText()).
  c.width = Math.max(1, Math.ceil(wPx));
  c.height = Math.max(1, Math.ceil(hPx));
  return c;
}

function getCardBackgroundCanvas(w, h, dpr, cfg) {
  const idpr = (typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0) ? dpr : 1;
  const key = `${idpr}|${Math.round(w * 1000) / 1000}|${Math.round(h * 1000) / 1000}|${cfgBgKey(cfg)}`;
  const hit = RUNTIME.cardBgCache.get(key);
  if (hit) {
    RUNTIME.cacheStats.cardHits++;
    touchLru(RUNTIME.cardBgCache, key, hit);
    return hit;
  }

  RUNTIME.cacheStats.cardMisses++;

  const canvas = makeOffscreenCanvas(w * idpr, h * idpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(idpr, 0, 0, idpr, 0, 0);
  drawCard(ctx, 0, 0, w, h, cfg);
  touchLru(RUNTIME.cardBgCache, key, canvas);
  return canvas;
}

function getHalfBackgroundCanvas(w, h, dpr, cfg, half) {
  const idpr = (typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0) ? dpr : 1;
  const key = `${idpr}|${Math.round(w * 1000) / 1000}|${Math.round(h * 1000) / 1000}|${half}|${cfgBgKey(cfg)}`;
  const hit = RUNTIME.halfBgCache.get(key);
  if (hit) {
    RUNTIME.cacheStats.halfHits++;
    touchLru(RUNTIME.halfBgCache, key, hit);
    return hit;
  }

  RUNTIME.cacheStats.halfMisses++;

  const canvas = makeOffscreenCanvas(w * idpr, h * idpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(idpr, 0, 0, idpr, 0, 0);
  drawHalfCardBackground(ctx, 0, 0, w, h, cfg, half);
  touchLru(RUNTIME.halfBgCache, key, canvas);
  return canvas;
}

function calcAtomicCardWidthPx(ctx, text, cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const safeText = String(text || '');
  const metrics = ctx.measureText(safeText || 'H');
  const textW = Number.isFinite(metrics.width) ? metrics.width : 0;
  const sidePad = Math.max(8, v.font.sizePx * 0.35);
  const target = textW + sidePad * 2;
  return Math.max(v.cardWidth, target);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawCard(ctx, x, y, w, h, cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  ctx.save();

  roundRectPath(ctx, x, y, w, h, v.radius);
  ctx.clip();

  ctx.fillStyle = v.colors.panelTop;
  ctx.fillRect(x, y, w, h / 2);
  ctx.fillStyle = v.colors.panelBottom;
  ctx.fillRect(x, y + h / 2, w, h / 2);

  drawInsetShading(ctx, x, y, w, h, cfg);

  strokeCardEdge(ctx, x, y, w, h, cfg);

  ctx.restore();
}

function drawCardBackgroundCached(ctx, x, y, w, h, cfg, dpr) {
  const bg = getCardBackgroundCanvas(w, h, dpr, cfg);
  ctx.drawImage(bg, x, y, w, h);
}

function drawDividerOverlay(ctx, x, y, w, h, cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const dividerSize = Math.max(0, v.divider.sizePx);
  if (dividerSize <= 0) return;

  const cy = y + h / 2;
  const top = cy - dividerSize / 2;

  const mode = (v.divider.mode || 'line').toLowerCase();
  if (mode === 'gap' || mode === 'cutout') {
    ctx.clearRect(x, top, w, dividerSize);
  } else {
    ctx.fillStyle = v.colors.divider;
    ctx.fillRect(x, top, w, dividerSize);
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeFlipProgress01(t, easing) {
  const tt = clamp01(t);
  const e = normalizeEasingName(easing) || 'linear';
  if (e === 'ease' || e === 'bounce') {
    return tt * tt;
  }
  return tt;
}

function easeOutFlipProgress01(t, easing) {
  const tt = clamp01(t);
  const e = normalizeEasingName(easing) || 'linear';
  if (e === 'ease' || e === 'bounce') {
    // (We use this for the bottom flap so the motion continues smoothly
    // from the end of the top flap, without a "pause" at the handoff.)
    const inv = 1 - tt;
    return 1 - inv * inv;
  }
  return tt;
}

function applyBounceToScaleY(scaleY, easedT) {
  const t = clamp01(easedT);
  if (t <= 0.72) return scaleY;

  const u = (t - 0.72) / 0.28; // 0..1
  const amp = 0.18;
  const decay = 1 - u;
  const osc = Math.sin(u * Math.PI * 2.2);
  const k = 1 + amp * osc * decay * decay;
  return Math.max(0, scaleY * k);
}

function drawInsetShading(ctx, x, y, w, h, cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const strength = Number.isFinite(v.edge.insetShadeStrength) ? v.edge.insetShadeStrength : 0;
  if (strength <= 0) return;

  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(255, 255, 255, ${0.12 * strength})`);
  g.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, `rgba(0, 0, 0, ${0.22 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function strokeCardEdge(ctx, x, y, w, h, cfg) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const edge = Math.max(0, v.edge.sizePx || 0);
  const color = v.colors.edge;
  if (edge <= 0 || !color) return;

  ctx.save();
  ctx.lineWidth = edge * 2;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  roundRectPath(ctx, x, y, w, h, v.radius);
  ctx.stroke();
  ctx.restore();
}

function drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const edge = Math.max(0, v.edge.sizePx || 0);
  if (edge <= 0) return;

  const t = clamp01(Math.sin(theta));
  const thickness = edge * 1.4 * t;
  if (thickness <= 0.1) return;

  const cy = y + h / 2;
  const g = ctx.createLinearGradient(0, 0, 0, thickness);
  g.addColorStop(0, `rgba(0, 0, 0, ${0.35 * t})`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.save();
  roundRectPath(ctx, x, y, w, h, v.radius);
  ctx.clip();
  ctx.fillStyle = g;
  if (half === 'top') {
    ctx.translate(0, cy - thickness);
    ctx.fillRect(x, 0, w, thickness);
  } else {
    ctx.translate(0, cy);
    ctx.fillRect(x, 0, w, thickness);
  }
  ctx.restore();
}

// ===== Flap trapezoid (pseudo perspective) =====
// Canvas 2D has no projective transform, so we approximate a trapezoid by drawing
// horizontal slices with per-slice horizontal scaling. This keeps the hinge width
// (center line) unchanged while the far edge expands.
const FLAP_BUFFER = {
  canvas: null,
  ctx: null,
  w: 0,
  h: 0,
  dpr: 1,
};

function getFlapBuffer(w, h, dpr) {
  const iw = Math.max(1, Math.ceil(w));
  const ih = Math.max(1, Math.ceil(h));
  const idpr = (typeof dpr === 'number' && Number.isFinite(dpr) && dpr > 0) ? dpr : 1;

  if (!FLAP_BUFFER.canvas) {
    FLAP_BUFFER.canvas = document.createElement('canvas');
    FLAP_BUFFER.ctx = FLAP_BUFFER.canvas.getContext('2d');
    FLAP_BUFFER.w = 0;
    FLAP_BUFFER.h = 0;
    FLAP_BUFFER.dpr = 1;
  }
  if (FLAP_BUFFER.w !== iw || FLAP_BUFFER.h !== ih || FLAP_BUFFER.dpr !== idpr) {
    FLAP_BUFFER.canvas.width = Math.max(1, Math.floor(iw * idpr));
    FLAP_BUFFER.canvas.height = Math.max(1, Math.floor(ih * idpr));
    FLAP_BUFFER.w = iw;
    FLAP_BUFFER.h = ih;
    FLAP_BUFFER.dpr = idpr;
  } else {
    FLAP_BUFFER.ctx.setTransform(1, 0, 0, 1, 0, 0);
    FLAP_BUFFER.ctx.clearRect(0, 0, FLAP_BUFFER.canvas.width, FLAP_BUFFER.canvas.height);
  }

  // Work in CSS pixels, but render into a DPR-scaled buffer for consistent sharpness.
  FLAP_BUFFER.ctx.setTransform(idpr, 0, 0, idpr, 0, 0);
  return FLAP_BUFFER;
}

function drawFlapTrapezoid(ctx, x, y, w, h, cfg, half, text, shadowAlpha, theta, cx) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const dpr = window.devicePixelRatio || 1;
  const src = getHalfBackgroundCanvas(w, h, dpr, cfg, half);

  const halfH = h / 2;
  const sliceCount = Math.max(14, Math.min(64, Math.round(halfH / 3)));

  // IMPORTANT: Slice in device pixels to avoid tiny gaps from rounding.
  // Gaps can reveal the underlying (next) glyph as faint noise, especially on mobile.
  const srcWpx = src.width;
  const srcHpxTotal = src.height;
  const midYpx = Math.round(srcHpxTotal / 2);
  const baseYpx0 = (half === 'top') ? 0 : midYpx;
  const baseYpx1 = (half === 'top') ? midYpx : srcHpxTotal;
  const halfHpx = Math.max(1, baseYpx1 - baseYpx0);

  const overhang = (typeof v.flip.overhang === 'number' && Number.isFinite(v.flip.overhang))
    ? Math.max(0, Math.min(0.5, v.flip.overhang))
    : 0;
  const t = clamp01(Math.sin(theta));

  // Fast path:
  // - overhang==0 => scaleX is always 1, slicing provides no trapezoid benefit.
  // - t is extremely small => distortion is imperceptible; avoid the slicing loop.
  // Keep edge thickness to preserve the 3D hinge feel.
  if (overhang <= 0 || t < 0.001) {
    drawFlapFlat(ctx, x, y, w, h, cfg, half);
    drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta);
    return;
  }

  for (let i = 0; i < sliceCount; i++) {
    const sy0 = baseYpx0 + Math.floor((i * halfHpx) / sliceCount);
    const sy1 = baseYpx0 + Math.floor(((i + 1) * halfHpx) / sliceCount);
    const srcHpx = Math.max(1, sy1 - sy0);

    const center = (((sy0 + sy1) / 2) - baseYpx0) / dpr;
    const dist = (half === 'top')
      ? clamp01((halfH - center) / halfH)
      : clamp01(center / halfH);

    // Trapezoid expansion amount (height-based overhang):
    // `--patapata-flip-overhang` is a ratio of full card height (px = h * ratio).
    // This keeps overhang independent from card width (e.g. atomic strings).
    const scaleX = 1 + (2 * (t * dist * (h * overhang))) / Math.max(1, w);

    // Overlap slices by 1 device pixel to avoid seams.
    // Without this, tiny seams can reveal the base layer (next text), most visible in atomic mode.
    const sy0o = Math.max(baseYpx0, sy0 - 1);
    const sy1o = Math.min(baseYpx1, sy1 + 1);
    const srcYpx = sy0o;
    const srcHpxO = Math.max(1, sy1o - sy0o);

    const destY0 = y + (half === 'top' ? 0 : halfH) + ((srcYpx - baseYpx0) / dpr);
    const destY1 = y + (half === 'top' ? 0 : halfH) + ((srcYpx - baseYpx0 + srcHpxO) / dpr);
    const destH = Math.max(0.0001, destY1 - destY0);
    const pivotY = destY0 + destH / 2;

    ctx.save();
    ctx.translate(cx, pivotY);
    ctx.scale(scaleX, 1);
    ctx.translate(-cx, -pivotY);
    ctx.drawImage(src, 0, srcYpx, srcWpx, srcHpxO, x, destY0, w, destH);
    ctx.restore();
  }

  // Extra rim thickness near the hinge during flip.
  drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta);
}

function drawHalfCardLayer(ctx, x, y, w, h, cfg, half, text, shadowAlpha = 0) {
  const dpr = window.devicePixelRatio || 1;
  const bg = getHalfBackgroundCanvas(w, h, dpr, cfg, half);
  ctx.drawImage(bg, x, y, w, h);
  drawHalfTextWithShadow(ctx, x, y, w, h, cfg, half, text, shadowAlpha);
}

function drawHalfCardBackground(ctx, x, y, w, h, cfg, half) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const cy = y + h / 2;

  ctx.save();

  roundRectPath(ctx, x, y, w, h, v.radius);
  ctx.clip();

  ctx.beginPath();
  if (half === 'top') ctx.rect(x, y, w, h / 2);
  else ctx.rect(x, cy, w, h / 2);
  ctx.clip();

  ctx.fillStyle = v.colors.panelTop;
  ctx.fillRect(x, y, w, h / 2);
  ctx.fillStyle = v.colors.panelBottom;
  ctx.fillRect(x, cy, w, h / 2);

  drawInsetShading(ctx, x, y, w, h, cfg);

  strokeCardEdge(ctx, x, y, w, h, cfg);

  ctx.restore();
}

function drawHalfTextWithShadow(ctx, x, y, w, h, cfg, half, text, shadowAlpha) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const cy = y + h / 2;

  ctx.save();

  // Clip once for both rounded corners and the half-rect.
  roundRectPath(ctx, x, y, w, h, v.radius);
  ctx.clip();

  ctx.beginPath();
  if (half === 'top') ctx.rect(x, y, w, h / 2);
  else ctx.rect(x, cy, w, h / 2);
  ctx.clip();

  const t = String(text ?? '');
  const { tx, ty } = resolveTextPosition(ctx, x, y, w, h, cfg, t || 'H');
  ctx.fillStyle = v.colors.text;
  ctx.fillText(t, tx, ty);

  if (shadowAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();
}

function drawTopFlap(ctx, x, y, w, h, cfg, charFrom, progress, cx, cy) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const p = Math.max(0, Math.min(0.5, progress));
  const t = clamp01(p * 2);
  const r = easeFlipProgress01(t, cfg && cfg.easing);
  const theta = r * (Math.PI / 2);
  const scaleY = Math.max(0, Math.cos(theta));
  const shadowStrength = (typeof v.flip.shadow === 'number' && Number.isFinite(v.flip.shadow)) ? v.flip.shadow : 0.35;
  const shadow = Math.sin(theta) * shadowStrength;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, scaleY);
  ctx.translate(-cx, -cy);
  if (cfg && cfg.light) {
    drawFlapFlat(ctx, x, y, w, h, cfg, 'top');
  } else {
    drawFlapTrapezoid(ctx, x, y, w, h, cfg, 'top', charFrom, shadow, theta, cx);
  }
  drawHalfTextWithShadow(ctx, x, y, w, h, cfg, 'top', charFrom, shadow);
  ctx.restore();
}

function drawBottomFlap(ctx, x, y, w, h, cfg, charTo, progress, cx, cy) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  const p = Math.max(0.5, Math.min(1, progress));
  const t = clamp01((p - 0.5) * 2);
  const r = easeOutFlipProgress01(t, cfg && cfg.easing);
  const theta = (1 - r) * (Math.PI / 2);
  let scaleY = Math.max(0, Math.cos(theta));
  if (cfg && normalizeEasingName(cfg.easing) === 'bounce') {
    scaleY = applyBounceToScaleY(scaleY, r);
  }
  const shadowStrength = (typeof v.flip.shadow === 'number' && Number.isFinite(v.flip.shadow)) ? v.flip.shadow : 0.35;
  const shadow = Math.sin(theta) * shadowStrength;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, scaleY);
  ctx.translate(-cx, -cy);
  if (cfg && cfg.light) {
    drawFlapFlat(ctx, x, y, w, h, cfg, 'bottom');
  } else {
    drawFlapTrapezoid(ctx, x, y, w, h, cfg, 'bottom', charTo, shadow, theta, cx);
  }
  drawHalfTextWithShadow(ctx, x, y, w, h, cfg, 'bottom', charTo, shadow);
  ctx.restore();
}

function drawFlapFlat(ctx, x, y, w, h, cfg, half) {
  const dpr = window.devicePixelRatio || 1;
  const src = getHalfBackgroundCanvas(w, h, dpr, cfg, half);

  const srcWpx = src.width;
  const srcHpx = src.height;
  const midYpx = Math.round(srcHpx / 2);
  const sy = (half === 'top') ? 0 : midYpx;
  const sh = (half === 'top') ? midYpx : (srcHpx - midYpx);

  const dy = (half === 'top') ? y : (y + h / 2);
  const dh = h / 2;
  ctx.drawImage(src, 0, sy, srcWpx, Math.max(1, sh), x, dy, w, dh);
}

const FONT_METRICS_CACHE = new Map();

function getFontAscentDescent(ctx, fontSizePx) {
  // Using punctuation (small bounding boxes) can make visual centering look off.
  // Measure representative glyphs to stabilize the baseline metrics.
  const key = String(ctx.font || '');
  const cached = FONT_METRICS_CACHE.get(key);
  if (cached) return cached;

  const fbAscent = fontSizePx * 0.8;
  const fbDescent = fontSizePx * 0.2;

  let ascent = fbAscent;
  let descent = fbDescent;

  // Prefer font metrics when available (more stable than per-glyph bounding boxes).
  const fm = ctx.measureText('M');
  const fba = fm && typeof fm.fontBoundingBoxAscent === 'number' ? fm.fontBoundingBoxAscent : NaN;
  const fbd = fm && typeof fm.fontBoundingBoxDescent === 'number' ? fm.fontBoundingBoxDescent : NaN;
  if (Number.isFinite(fba) && Number.isFinite(fbd) && fba + fbd >= fontSizePx * 0.6) {
    ascent = fba;
    descent = fbd;
  } else {
    // Fallback: approximate using representative glyphs.
    const m = ctx.measureText('Hg');
    const aba = m && typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : NaN;
    const abd = m && typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : NaN;
    if (Number.isFinite(aba)) ascent = aba;
    if (Number.isFinite(abd)) descent = abd;

    const sum = ascent + descent;
    if (!Number.isFinite(sum) || sum < fontSizePx * 0.6) {
      ascent = fbAscent;
      descent = fbDescent;
    }
  }

  const out = { ascent, descent };
  FONT_METRICS_CACHE.set(key, out);
  return out;
}

function resolveTextPosition(ctx, x, y, w, h, cfg, text) {
  const v = (cfg && cfg.visual) ? cfg.visual : cfg;
  // Assumes ctx.textBaseline is set to 'alphabetic'.
  let tx = x + w / 2;

  const align = v.text.align;
  if (align === 'left') tx = x;
  if (align === 'right') tx = x + w;

  const { ascent, descent } = getFontAscentDescent(ctx, v.font.sizePx);

  // Center visually using ascent/descent.
  const valign = v.text.valign;
  let ty;
  if (valign === 'top') {
    ty = y + ascent;
  } else if (valign === 'bottom') {
    ty = y + h - descent;
  } else {
    ty = y + h / 2 + (ascent - descent) / 2;
  }

  tx += v.text.offsetXPx;
  ty += v.text.offsetYPx;

  return { tx, ty };
}

export {
  calcAtomicCardWidthPx,
  drawCardBackgroundCached,
  drawDividerOverlay,
  resolveTextPosition,
  clamp01,
  drawHalfCardLayer,
  drawTopFlap,
  drawBottomFlap,
};
