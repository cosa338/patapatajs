// @ts-check

import { attrBool, cssVar, pick } from '../core/utils.ts';
import { JS_DEFAULTS } from './runtime.ts';

function readCssColor(el, name) {
  const v = cssVar(el, name);
  return v ? String(v) : null;
}

const HOST_DEFAULT_STYLE_TEXT = `
      :host {
        display: inline-block;

        /* Size defaults (override via user CSS) */
        --patapata-card-width: clamp(30px, 4vw, 80px);
        --patapata-card-height: calc(var(--patapata-card-width) * 1.1);
        --patapata-card-radius: clamp(2.4px, calc(var(--patapata-card-width) * 0.08), 6.4px);
        --patapata-display-gap: clamp(1.8px, calc(var(--patapata-card-width) * 0.06), 4.8px);
        --patapata-card-font-size: calc(var(--patapata-card-width) * 0.9);

        /* Color/font defaults (override via user CSS) */
        --patapata-panel-top: #333;
        --patapata-panel-bottom: #333;
        --patapata-divider: rgba(0, 0, 0, 0.6);
        --patapata-divider-size: clamp(1px, calc(var(--patapata-card-width) * 0.02), 2px);
        --patapata-divider-mode: line; /* line | gap */
        --patapata-text-color: #ddd;
        --patapata-font-family: 'Helvetica Neue', Arial, sans-serif;
        --patapata-font-weight: 700;

        /* Edge/thickness/shading (override via user CSS) */
        --patapata-edge-size: clamp(1px, calc(var(--patapata-card-width) * 0.03), 4px);
        --patapata-edge-color: rgba(255, 255, 255, 0.12);
        --patapata-inset-shade-strength: 1;

        /* Flip depth (override via user CSS) */
        --patapata-flip-overhang: 0.03;    /* ~0..0.2 (height ratio). 0 disables. */
        --patapata-flip-shadow: 0.2;      /* ~0..0.8 */

        /* Flip timing (can be combined with the easing attribute) */
        --patapata-easing: linear; /* linear | ease | bounce */

        --patapata-text-align: center;
        --patapata-text-valign: middle;
        --patapata-text-offset-x: 0px;
        --patapata-text-offset-y: 0px;
      }
      canvas { display: block; }
    `;

const MEASURE_ELEMENT_STYLE_TEXT = [
  'position: absolute',
  'left: -99999px',
  'top: -99999px',
  'width: 0',
  'height: 0',
  'overflow: hidden',
  'visibility: hidden',
  'pointer-events: none',
].join(';');

class PatapataCanvasBaseElement extends HTMLElement {
  _shadow: ShadowRoot;
  _canvas: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  _measure: HTMLDivElement;

  constructor() {
    super();

    this._shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = HOST_DEFAULT_STYLE_TEXT;

    this._canvas = document.createElement('canvas');
    this._ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;

    // Helper element to resolve CSS vars (clamp/calc/var) into computed px.
    this._measure = document.createElement('div');
    this._measure.style.cssText = MEASURE_ELEMENT_STYLE_TEXT;

    this._shadow.appendChild(style);
    this._shadow.appendChild(this._canvas);
    this._shadow.appendChild(this._measure);
  }

  _resolveCssPx(varName, fallbackPx, cssProperty) {
    // getComputedStyle(host).getPropertyValue('--x') returns the specified value (clamp/calc not resolved).
    // Apply it to a real CSS property and read back the computed px.
    const fb = Number.isFinite(fallbackPx) ? fallbackPx : 0;
    const prop = cssProperty || 'width';
    this._measure.style[prop] = `var(${varName}, ${fb}px)`;
    const raw = getComputedStyle(this._measure)[prop];
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fb;
  }

  _resolveLengthPx(varName, fallbackPx) {
    return this._resolveCssPx(varName, fallbackPx, 'width');
  }

  _resolveSignedLengthPx(varName, fallbackPx) {
    // width/height can't be negative; use a margin property for signed lengths.
    return this._resolveCssPx(varName, fallbackPx, 'marginLeft');
  }

  _resolveFontSizePx(varName, fallbackPx) {
    return this._resolveCssPx(varName, fallbackPx, 'fontSize');
  }

  _resolveNumber(varName, fallback) {
    const raw = cssVar(this, varName);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  _readVisualConfigBase(dividerModeFallback) {
    // Fallbacks here are safety nets, not the primary defaults.
    // Primary defaults live in :host styles and are meant to be overridden by user CSS.
    const cardWidth = this._resolveLengthPx('--patapata-card-width', 80);
    const cardHeight = this._resolveLengthPx('--patapata-card-height', Math.max(1, cardWidth * 1.1));
    const radius = this._resolveLengthPx('--patapata-card-radius', 6.4);
    const gap = this._resolveLengthPx('--patapata-display-gap', 4.8);

    const panelTop = pick(cssVar(this, '--patapata-panel-top'), cssVar(this, '--patapata-panel-color'), '#333');
    const panelBottom = pick(cssVar(this, '--patapata-panel-bottom'), cssVar(this, '--patapata-panel-color'), '#333');
    const divider = pick(cssVar(this, '--patapata-divider'), 'rgba(0, 0, 0, 0.6)');
    const dividerSizePx = this._resolveLengthPx('--patapata-divider-size', 2);
    const dividerMode = pick(cssVar(this, '--patapata-divider-mode'), dividerModeFallback);

    const textColor = pick(cssVar(this, '--patapata-text-color'), '#ddd');
    const fontFamily = pick(
      cssVar(this, '--patapata-font-family'),
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    );
    const fontWeight = this._resolveNumber('--patapata-font-weight', 700);
    const fontSizePx = this._resolveFontSizePx('--patapata-card-font-size', Math.max(12, cardWidth * 0.9));

    const edgeSizePx = this._resolveLengthPx('--patapata-edge-size', Math.max(1, cardWidth * 0.03));
    const edgeColor = pick(readCssColor(this, '--patapata-edge-color'), 'rgba(255, 255, 255, 0.12)');
    const insetShadeStrength = this._resolveNumber('--patapata-inset-shade-strength', 1);

    const flipOverhang = this._resolveNumber('--patapata-flip-overhang', 0.03);
    const flipShadow = this._resolveNumber('--patapata-flip-shadow', 0.2);

    const atomic = attrBool(this, 'atomic', JS_DEFAULTS.atomic);
    const textAlign = pick(cssVar(this, '--patapata-text-align'), 'center');
    const textValign = pick(cssVar(this, '--patapata-text-valign'), 'middle');

    const textOffsetXPx = this._resolveSignedLengthPx('--patapata-text-offset-x', 0);
    const textOffsetYPx = this._resolveSignedLengthPx('--patapata-text-offset-y', 0);

    return {
      atomic,
      cardWidth,
      cardHeight,
      gap,
      radius,
      colors: {
        panelTop,
        panelBottom,
        divider,
        text: textColor,
        edge: edgeColor,
      },
      divider: {
        sizePx: dividerSizePx,
        mode: dividerMode,
      },
      font: {
        family: fontFamily,
        weight: fontWeight,
        sizePx: fontSizePx,
      },
      edge: {
        sizePx: edgeSizePx,
        insetShadeStrength: Math.max(0, insetShadeStrength),
      },
      flip: {
        overhang: Math.max(0, Math.min(0.5, flipOverhang)),
        shadow: Math.max(0, Math.min(1, flipShadow)),
      },
      text: {
        align: (textAlign || 'center').toLowerCase(),
        valign: (textValign || 'middle').toLowerCase(),
        offsetXPx: textOffsetXPx,
        offsetYPx: textOffsetYPx,
      },
    };
  }
}

export { PatapataCanvasBaseElement };
