// @ts-check

import { JS_DEFAULTS } from '../render/runtime.ts';
import {
  drawCardBackgroundCached,
  drawDividerOverlay,
  resolveTextPosition,
  clamp01,
  drawHalfCardLayer,
  drawTopFlap,
  drawBottomFlap,
} from '../render/draw.ts';
import type { BaseConfig, GeomPart, SequenceState } from './types.ts';

interface DrawHost {
  _sequence: SequenceState | null;
  _applyAutoAriaLabel: (labelText: string) => void;
}

interface DrawTextFrameOptions {
  host: DrawHost;
  cfg: BaseConfig;
  layout: 'row' | 'stack';
  geomParts: GeomPart[];
  outerPadX: number;
  partsItems: string[][];
  useParts: boolean;
  now: number;
  ctx: CanvasRenderingContext2D;
  dpr: number;
}

function drawTextFrame(opts: DrawTextFrameOptions) {
  const { host, cfg, layout, geomParts, outerPadX, partsItems, useParts, now, ctx, dpr } = opts;
  const v = cfg.visual;
  const isSequencing = !!host._sequence;

  const withScaledCard = (x: number, y: number, scale: number, drawFn: (x: number, y: number) => void) => {
    const s = (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) ? scale : 1;
    if (s === 1) {
      drawFn(x, y);
      return;
    }
    const yOff = (v.cardHeight - (v.cardHeight * s)) / 2;
    ctx.save();
    ctx.translate(x, y + yOff);
    ctx.scale(s, s);
    drawFn(0, 0);
    ctx.restore();
  };

  const renderStaticPart = (part: GeomPart, originX: number, originY: number) => {
    for (let i = 0; i < part.count; i++) {
      const x = originX + (part.offsets ? (part.offsets[i] || 0) : (i * (part.cardWidthPx + v.gap)));
      const y = originY;
      const scale = (part.scales && typeof part.scales[i] === 'number') ? part.scales[i] : 1;

      withScaledCard(x, y, scale, (dx, dy) => {
        drawCardBackgroundCached(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg, dpr);

        const ch = part.tokens && part.tokens[i] == null ? '' : String((part.tokens && part.tokens[i]) ?? '');
        const { tx, ty } = resolveTextPosition(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg, ch || 'H');
        ctx.fillStyle = v.colors.text;
        ctx.fillText(ch, tx, ty);
        drawDividerOverlay(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg);
      });
    }
  };

  const renderSequencePart = (partIdx: number, partGeom: GeomPart, originX: number, originY: number) => {
    const seqPart = host._sequence && host._sequence.parts[partIdx] ? host._sequence.parts[partIdx] : null;
    if (!seqPart) {
      renderStaticPart(partGeom, originX, originY);
      return;
    }

    const duration = Math.max(1, cfg.duration || JS_DEFAULTS.duration);
    const nowSafe = typeof now === 'number' && Number.isFinite(now) ? now : performance.now();
    const animDuration = (anim: { durationMs: number | null }) => Math.max(1, (anim && anim.durationMs) ? anim.durationMs : duration);

    for (let i = 0; i < seqPart.flippers.length; i++) {
      seqPart.flippers[i].update(nowSafe, duration);
    }

    const x0 = originX;
    const y0 = originY;
    const count = seqPart.flippers.length;

    for (let i = 0; i < count; i++) {
      const x = x0 + (partGeom.offsets ? (partGeom.offsets[i] || 0) : (i * (partGeom.cardWidthPx + v.gap)));
      const y = y0;
      const text = String(seqPart.flippers[i].baseValue ?? '');
      const scale = (partGeom.scales && typeof partGeom.scales[i] === 'number') ? partGeom.scales[i] : 1;
      withScaledCard(x, y, scale, (dx, dy) => {
        drawCardBackgroundCached(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, dpr);
        const { tx, ty } = resolveTextPosition(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, text || 'H');
        ctx.fillStyle = v.colors.text;
        ctx.fillText(text, tx, ty);
      });
    }

    for (let i = 0; i < count; i++) {
      const flipper = seqPart.flippers[i];
      if (!flipper.hasActive()) continue;
      const x = x0 + (partGeom.offsets ? (partGeom.offsets[i] || 0) : (i * (partGeom.cardWidthPx + v.gap)));
      const y = y0;
      const oldest = flipper.animations[flipper.animations.length - 1];
      const scale = (partGeom.scales && typeof partGeom.scales[i] === 'number') ? partGeom.scales[i] : 1;
      withScaledCard(x, y, scale, (dx, dy) => {
        drawHalfCardLayer(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, 'bottom', oldest.from, 0);
      });
    }

    for (let i = 0; i < count; i++) {
      const flipper = seqPart.flippers[i];
      if (!flipper.hasActive()) continue;
      const x = x0 + (partGeom.offsets ? (partGeom.offsets[i] || 0) : (i * (partGeom.cardWidthPx + v.gap)));
      const y = y0;
      const scale = (partGeom.scales && typeof partGeom.scales[i] === 'number') ? partGeom.scales[i] : 1;

      withScaledCard(x, y, scale, (dx, dy) => {
        const cx = dx + partGeom.cardWidthPx / 2;
        const cy = dy + v.cardHeight / 2;

        for (let j = flipper.animations.length - 1; j >= 0; j--) {
          const anim = flipper.animations[j];
          const p = clamp01((nowSafe - anim.startTime) / animDuration(anim));
          if (p < 0.5) continue;
          drawBottomFlap(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, anim.to, p, cx, cy);
        }
      });
    }

    for (let i = 0; i < count; i++) {
      const flipper = seqPart.flippers[i];
      if (!flipper.hasActive()) continue;
      const x = x0 + (partGeom.offsets ? (partGeom.offsets[i] || 0) : (i * (partGeom.cardWidthPx + v.gap)));
      const y = y0;
      const scale = (partGeom.scales && typeof partGeom.scales[i] === 'number') ? partGeom.scales[i] : 1;

      withScaledCard(x, y, scale, (dx, dy) => {
        const cx = dx + partGeom.cardWidthPx / 2;
        const cy = dy + v.cardHeight / 2;

        for (let j = 0; j < flipper.animations.length; j++) {
          const anim = flipper.animations[j];
          const p = clamp01((nowSafe - anim.startTime) / animDuration(anim));
          if (p >= 0.5) continue;
          drawTopFlap(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, anim.from, p, cx, cy);
        }
      });
    }

    for (let i = 0; i < count; i++) {
      const x = x0 + (partGeom.offsets ? (partGeom.offsets[i] || 0) : (i * (partGeom.cardWidthPx + v.gap)));
      const y = y0;
      const scale = (partGeom.scales && typeof partGeom.scales[i] === 'number') ? partGeom.scales[i] : 1;
      withScaledCard(x, y, scale, (dx, dy) => {
        drawDividerOverlay(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg);
      });
    }
  };

  let ox = 0;
  let oy = 0;
  for (let p = 0; p < geomParts.length; p++) {
    const part = geomParts[p];
    const originX = (layout === 'row')
      ? (outerPadX + ox)
      : outerPadX;
    const originY = oy;

    if (isSequencing) renderSequencePart(p, part, originX, originY);
    else renderStaticPart(part, originX, originY);

    if (layout === 'row') {
      ox += part.partW + (p < geomParts.length - 1 ? v.gap : 0);
    } else {
      oy += v.cardHeight + (p < geomParts.length - 1 ? v.gap : 0);
    }
  }

  // Accessibility: reflect the currently rendered value.
  const a11ySep = layout === 'stack' ? '\n' : ' ';
  const a11yText = (isSequencing && host._sequence)
    ? host._sequence.parts.map((sp) => sp.flippers.map((f) => String(f.baseValue ?? '')).join('')).join(a11ySep)
    : (useParts
      ? partsItems.map((arr) => ((Array.isArray(arr) && arr.length) ? String(arr[0] ?? '') : '')).join(a11ySep)
      : String(cfg.value ?? ''));
  host._applyAutoAriaLabel(a11yText);
}

export { drawTextFrame };
