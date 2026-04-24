// @ts-check

import {
  attrNumber,
  attrString,
  pick,
  readEasing,
  readHalfHeadTail,
} from '../core/utils.ts';
import {
  JS_DEFAULTS,
  RUNTIME,
  TEXT_OBSERVED_ATTRS,
  TEXT_RESTART_ATTRS,
  VISUAL_ONLY_ATTRS,
  registerVisibility,
  unregisterVisibility,
  globalRafRequest,
} from '../render/runtime.ts';
import { PatapataCanvasBaseElement } from '../render/canvas-base.ts';
import { ensureTextSequence } from './text-sequence.ts';
import { renderText } from './text-render.ts';
import type { BaseConfig, LayoutCache, SequenceState } from './types.ts';

class PatapataTextElement extends PatapataCanvasBaseElement {
  static get observedAttributes() {
    return TEXT_OBSERVED_ATTRS;
  }

  _cfg: BaseConfig | null;
  _onResize: () => void;
  _timer: ReturnType<typeof setTimeout> | null;
  _rafScheduled: boolean;
  _sequence: SequenceState | null;
  _onClick: ((e: Event) => void) | null;
  _ro: ResizeObserver | null;
  _mo: MutationObserver | null;
  _visualCfgCache: BaseConfig['visual'] | null;
  _visualCfgCacheDividerFallback: string | null;
  _a11yAutoManaged: boolean;
  _a11yLastAutoLabel: string | null;
  _layoutCache: LayoutCache | null;
  _layoutDirty: boolean;
  _visualDirty: boolean;
  _isIntersecting: boolean;
  _resizeRaf: number | null;

  constructor() {
    super();

    this._cfg = null;
    this._onResize = () => {
      this._layoutDirty = true;
      this._visualDirty = true;
      if (this._resizeRaf != null) return;
      this._resizeRaf = requestAnimationFrame(() => {
        this._resizeRaf = null;
        this._render(performance.now());
        this._ensureRaf();
      });
    };

    this._timer = null;
    this._rafScheduled = false;
    this._sequence = null;
    this._onClick = null;

    this._ro = null;
    this._mo = null;

    this._visualCfgCache = null;
    this._visualCfgCacheDividerFallback = null;

    this._a11yAutoManaged = false;
    this._a11yLastAutoLabel = null;

    this._layoutCache = null;
    this._layoutDirty = true;
    this._visualDirty = true;

    this._isIntersecting = true;
    this._resizeRaf = null;
  }

  _markLayoutVisual() {
    this._layoutDirty = true;
    this._visualDirty = true;
    this._visualCfgCache = null;
    this._visualCfgCacheDividerFallback = null;
  }

  _readVisualConfig(dividerModeFallback) {
    const fb = dividerModeFallback;
    if (!this._visualDirty && this._visualCfgCache && this._visualCfgCacheDividerFallback === fb) return this._visualCfgCache;
    const v = this._readVisualConfigBase(fb);
    this._visualCfgCache = v;
    this._visualCfgCacheDividerFallback = fb;
    return v;
  }

  _applyAutoAriaLabel(labelText) {
    // Skip if author intentionally hides it.
    if (this.getAttribute('aria-hidden') === 'true') return;

    const nextLabel = String(labelText ?? '');
    const current = this.getAttribute('aria-label');

    // Respect user-provided aria-label. Keep updating only if we are managing it and it hasn't been externally changed.
    const shouldManage = (current == null) || (this._a11yAutoManaged && current === this._a11yLastAutoLabel);
    if (!shouldManage) {
      this._a11yAutoManaged = false;
      this._a11yLastAutoLabel = null;
      return;
    }

    // Provide a sensible default role if absent.
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');

    if (current !== nextLabel) this.setAttribute('aria-label', nextLabel);
    this._a11yAutoManaged = true;
    this._a11yLastAutoLabel = nextLabel;
  }

  _cancelResizeRaf() {
    if (this._resizeRaf != null) {
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = null;
    }
  }

  _clearTimerHandle() {
    if (this._timer != null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _setupResizeAndVisibility() {
    window.addEventListener('resize', this._onResize);

    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => {
        this._onResize();
      });
      this._ro.observe(this);
    }

    if (typeof MutationObserver !== 'undefined') {
      this._mo = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type !== 'attributes') continue;
          if (m.attributeName === 'style' || m.attributeName === 'class') {
            this._onResize();
            break;
          }
        }
      });
      this._mo.observe(this, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    registerVisibility(this);
  }

  _teardownResizeAndVisibility() {
    window.removeEventListener('resize', this._onResize);
    unregisterVisibility(this);

    if (this._ro) {
      try { this._ro.disconnect(); } catch (_) {}
      this._ro = null;
    }

    if (this._mo) {
      try { this._mo.disconnect(); } catch (_) {}
      this._mo = null;
    }

    this._cancelResizeRaf();
  }

  _setClickHandler(fn) {
    if (this._onClick) this.removeEventListener('click', this._onClick);
    this._onClick = typeof fn === 'function' ? fn : null;
    if (this._onClick) this.addEventListener('click', this._onClick);
  }

  _clearClickHandler() {
    if (this._onClick) this.removeEventListener('click', this._onClick);
    this._onClick = null;
  }

  _refreshVisual() {
    this._visualDirty = true;
    this._visualCfgCache = null;
    this._visualCfgCacheDividerFallback = null;
    this._render(performance.now());
    this._ensureRaf();
  }

  _stopAndRender() {
    this.stop();
    this._render(performance.now());
  }

  _restartIfActive() {
    if (this._timer != null || this.hasAttribute('autostart')) this.start();
    else this._stopAndRender();
  }

  connectedCallback() {
    this._setupResizeAndVisibility();

    this._setClickHandler(() => {
      if (this.hasAttribute('click')) this.start();
    });

    if (this.hasAttribute('autostart')) this.start();
    else {
      this.stop();
      this._render(performance.now());
    }
  }

  disconnectedCallback() {
    this._teardownResizeAndVisibility();
    this._clearClickHandler();

    this.stop();
    this._rafScheduled = false;
  }

  attributeChangedCallback(name) {
    if (!this.isConnected) return;

    // click itself doesn't require rerender.
    if (name === 'click') return;

    if (VISUAL_ONLY_ATTRS.has(name)) {
      // Visual-only toggle: do not restart sequence/timers.
      this._refreshVisual();
      return;
    }

    if (TEXT_RESTART_ATTRS.has(name)) {
      this._markLayoutVisual();
      // If currently running (or autostart enabled), restart to reflect the new config.
      this._restartIfActive();
      return;
    }

    if (name === 'autostart') {
      this._markLayoutVisual();
      if (this.hasAttribute('autostart')) this.start();
      else this._stopAndRender();
      return;
    }

    this._markLayoutVisual();
    this._render(performance.now());
  }

  start() {
    this.stop();
    this._sequence = null;
    this._layoutDirty = true;
    this._visualDirty = true;
    this._visualCfgCache = null;
    this._visualCfgCacheDividerFallback = null;
    this._render(performance.now());
    this._ensureSequence();
  }

  stop() {
    this._clearTimerHandle();
    this._sequence = null;
    this._rafScheduled = false;
  }

  _isPaintSuppressed() {
    if (!this.isConnected) return true;
    if (typeof document !== 'undefined' && document.hidden) return true;
    if (RUNTIME.supportsIO && !this._isIntersecting) return true;
    return false;
  }

  _refreshIntersectionIfStale() {
    if (!RUNTIME.supportsIO) return;
    if (this._isIntersecting) return;
    if (!this.isConnected) return;
    if (typeof window === 'undefined') return;

    const r = (typeof this.getBoundingClientRect === 'function') ? this.getBoundingClientRect() : null;
    if (!r) return;

    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    if (vw <= 0 || vh <= 0) return;

    // IntersectionObserver callbacks can lag behind display toggles.
    // If we are actually in-viewport, allow a render immediately.
    const intersects = (r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw);
    if (!intersects) return;

    this._isIntersecting = true;
  }

  _setIntersecting(v) {
    const next = !!v;
    if (this._isIntersecting === next) return;
    this._isIntersecting = next;
    if (!this._isPaintSuppressed()) {
      this._layoutDirty = true;
      this._visualDirty = true;
      this._visualCfgCache = null;
      this._visualCfgCacheDividerFallback = null;
      this._render(performance.now());
      this._ensureRaf();
    }
  }

  _onGlobalVisibilityChange() {
    if (!this.isConnected) return;
    if (this._isPaintSuppressed()) {
      this._rafScheduled = false;
      return;
    }
    this._layoutDirty = true;
    this._visualDirty = true;
    this._visualCfgCache = null;
    this._visualCfgCacheDividerFallback = null;
    this._render(performance.now());
    this._ensureRaf();
  }

  _ensureRaf() {
    if (this._rafScheduled) return;
    if (this._isPaintSuppressed()) return;
    if (!this._sequence || !this._sequence.parts.some((p) => p.flippers.some((f) => f.hasActive()))) return;
    this._rafScheduled = true;
    globalRafRequest(this);
  }

  _onGlobalRafFrame(now) {
    this._rafScheduled = false;
    if (this._isPaintSuppressed()) return false;
    this._render(now, true);
    return !!(this._sequence && this._sequence.parts.some((p) => p.flippers.some((f) => f.hasActive())));
  }

  _ensureSequence() {
    ensureTextSequence(this);
  }

  _readConfig(): BaseConfig {
    const interval = pick(attrNumber(this, 'interval'), JS_DEFAULTS.interval);
    const duration = pick(attrNumber(this, 'duration'), JS_DEFAULTS.duration);
    // shuffle-time is parsed directly where needed.
    const value = pick(attrString(this, 'value'), JS_DEFAULTS.value);
    const { halfHead, halfTail } = readHalfHeadTail(this);

    const visual = this._readVisualConfig('line');
    const light = this.hasAttribute('light');

    const easing = readEasing(this, 'linear');

    return { visual, interval, duration, value, light, easing, halfHead, halfTail };
  }

  _render(now, fromRaf = false) {
    renderText(this, now, fromRaf);
  }
}

export { PatapataTextElement };
