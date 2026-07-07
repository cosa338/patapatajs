
import {
  attrNumber,
  attrString,
  pick,
  readEasing,
  readHalfHeadTail,
  readMinDigits,
} from '../core/utils.ts';
import { buildTimerPanels, clampNonNegativeMs, timerProbeTextFromFormat } from '../core/time-format.ts';
import {
  JS_DEFAULTS,
  TICK_INTERVAL_MS,
  HIDDEN_TICK_INTERVAL_MS,
  MS_PANEL_DURATION_MS,
  VISUAL_ONLY_ATTRS,
  TIMER_OBSERVED_ATTRS,
  TIMER_REFRESH_ATTRS,
} from '../render/runtime.ts';
import { PatapataTextElement } from './text.ts';
import { applyPanelTokensToPart, buildSinglePartSequence } from './shared.ts';
import type { TimerConfig } from './types.ts';

class PatapataTimerElement extends PatapataTextElement {
  _timerRunning: boolean;
  _timerBaseElapsedMs: number;
  _timerStartedAt: number;
  _hasMsPanels: boolean;

  static override get observedAttributes() {
    return TIMER_OBSERVED_ATTRS;
  }

  constructor() {
    super();
    this._timerRunning = false;
    this._timerBaseElapsedMs = 0;
    this._timerStartedAt = 0;
    this._hasMsPanels = false;
  }

  _refreshSequence() {
    this._markLayoutVisual();
    this._ensureSequence();
    this._render(performance.now());
    this._ensureRaf();
  }

  override connectedCallback() {
    this._setupResizeAndVisibility();

    this._setClickHandler(() => {
      if (!this.hasAttribute('click')) return;
      this._handleTimerClick();
    });

    this._ensureSequence();
    this._render(performance.now());
    this._ensureRaf();

    if (this.hasAttribute('autostart')) this.start();
    else this.stop();
  }

  override disconnectedCallback() {
    this._teardownResizeAndVisibility();
    this._clearClickHandler();

    this.stop();
    this._rafScheduled = false;
    this._sequence = null;
  }

  override attributeChangedCallback(name: string) {
    if (!this.isConnected) return;

    if (name === 'click') return;

    if (VISUAL_ONLY_ATTRS.has(name)) {
      this._refreshVisual();
      return;
    }

    if (name === 'sec') {
      // Changing mode/start value should reset elapsed.
      this.reset();
    }

    if (TIMER_REFRESH_ATTRS.has(name)) {
      this._refreshSequence();
      return;
    }

    if (name === 'autostart') {
      if (this.hasAttribute('autostart')) this.start();
      else this.stop();
      return;
    }

    this._markLayoutVisual();
    this._render(performance.now());
    this._ensureRaf();
  }

  override _readConfig(): TimerConfig {
    const duration = pick(attrNumber(this, 'duration'), JS_DEFAULTS.duration);
    const format = pick(attrString(this, 'format'), 'HHH:mm:ss');

    const minDigits = readMinDigits(this);

    const secRaw = attrNumber(this, 'sec');
    const sec = (typeof secRaw === 'number' && Number.isFinite(secRaw) && secRaw >= 0)
      ? secRaw
      : null;

    const { halfHead, halfTail } = readHalfHeadTail(this);

    const value = timerProbeTextFromFormat(format, minDigits);
    const visual = this._readVisualConfig('line');
    const light = this.hasAttribute('light');

    const easing = readEasing(this, 'linear');

    return { visual, interval: JS_DEFAULTS.interval, duration, value, light, easing, format, sec, minDigits, halfHead, halfTail };
  }

  _timerConfig() {
    const cfg = (this._cfg && !this._visualDirty) ? (this._cfg as TimerConfig) : this._readConfig();
    this._cfg = cfg;
    const countdownStartMs = (cfg.sec != null) ? clampNonNegativeMs(cfg.sec * 1000) : null;
    return { cfg, countdownStartMs };
  }

  _nowElapsedMs(nowTs: number) {
    const base = clampNonNegativeMs(this._timerBaseElapsedMs);
    if (!this._timerRunning) return base;
    const dt = (typeof nowTs === 'number' && Number.isFinite(nowTs)) ? (nowTs - this._timerStartedAt) : 0;
    return clampNonNegativeMs(base + dt);
  }

  _displayMs(nowTs: number) {
    const { countdownStartMs } = this._timerConfig();
    const elapsed = this._nowElapsedMs(nowTs);
    if (countdownStartMs == null) return elapsed;
    return Math.max(0, countdownStartMs - elapsed);
  }

  _isAtInitialStopState() {
    const { countdownStartMs } = this._timerConfig();
    const elapsed = clampNonNegativeMs(this._timerBaseElapsedMs);
    if (countdownStartMs == null) return elapsed === 0;
    return elapsed === 0;
  }

  _handleTimerClick() {
    if (this._timerRunning) {
      this.stop();
      return;
    }

    if (this._isAtInitialStopState()) {
      this.start();
    } else {
      this.reset();
    }
  }

  override start() {
    if (this._timerRunning) return;
    this._ensureSequence();

    this._timerRunning = true;
    this._timerStartedAt = performance.now();
    this._tickOnce();
  }

  override stop() {
    if (this._timerRunning) {
      const now = performance.now();
      this._timerBaseElapsedMs = this._nowElapsedMs(now);
    }
    this._timerRunning = false;
    this._timerStartedAt = 0;
    this._clearTimerHandle();
  }

  reset() {
    this._timerBaseElapsedMs = 0;
    this._timerRunning = false;
    this._timerStartedAt = 0;
    this._clearTimerHandle();
    this._layoutDirty = true;
    this._visualDirty = true;
    this._ensureSequence();
    const now = performance.now();
    this._applyDisplay(now, true);
    this._render(now);
    this._ensureRaf();
  }

  toggle() {
    if (this._timerRunning) this.stop();
    else this.start();
  }

  override _ensureSequence() {
    const { cfg } = this._timerConfig();
    const format = String(cfg.format ?? '');
    const atomic = !!(cfg.visual && cfg.visual.atomic);
    const probe = String(cfg.value ?? '');

    const now = performance.now();
    const panels = buildTimerPanels(format, this._displayMs(now), cfg.minDigits || 0);
    const { sequence } = buildSinglePartSequence('timer', probe, panels.tokens, atomic);
    this._sequence = sequence;
    this._layoutDirty = true;
    // isMsPanel flags are derived from the format tokens, so the initial
    // build tells us whether any panel updates at sub-second cadence.
    this._hasMsPanels = panels.isMsPanel.some(Boolean);
  }

  _nextTickDelayMs(nowTs: number) {
    if (this._isPaintSuppressed()) return HIDDEN_TICK_INTERVAL_MS;
    if (this._hasMsPanels) return TICK_INTERVAL_MS;
    // Without ms tokens, the display only changes when the elapsed time
    // crosses a second boundary; sleep until just past the next one.
    const { countdownStartMs } = this._timerConfig();
    const msPart = this._displayMs(nowTs) % 1000;
    const toBoundary = (countdownStartMs == null)
      ? (1000 - msPart)
      : (msPart > 0 ? msPart : 1000);
    return Math.min(1000, Math.max(TICK_INTERVAL_MS, toBoundary + 8));
  }

  _applyDisplay(nowTs: number, allowRebuild = false) {
    if (!this._sequence || !this._sequence.parts || !this._sequence.parts[0]) return;
    const { cfg } = this._timerConfig();
    const atomic = !!(cfg.visual && cfg.visual.atomic);
    const format = String(cfg.format ?? '');
    const part = this._sequence.parts[0];

    const { tokens, isMsPanel } = buildTimerPanels(format, this._displayMs(nowTs), cfg.minDigits || 0);

    applyPanelTokensToPart({
      part,
      tokens,
      isMsPanel,
      atomic,
      durationNormal: Math.max(1, cfg.duration || JS_DEFAULTS.duration),
      durationMsFixed: MS_PANEL_DURATION_MS,
      nowTs,
      allowRebuild,
      onLayoutDirty: () => { this._layoutDirty = true; },
    });
  }

  _tickOnce() {
    if (!this._timerRunning) return;

    const nowTs = performance.now();
    const { countdownStartMs } = this._timerConfig();

    const elapsed = this._nowElapsedMs(nowTs);
    if (countdownStartMs != null && elapsed >= countdownStartMs) {
      this._timerBaseElapsedMs = countdownStartMs;
      this._timerRunning = false;
      this._timerStartedAt = 0;
      this._clearTimerHandle();
    }

    this._applyDisplay(nowTs, true);
    // Painting is driven by the shared rAF loop; the flips started above
    // re-arm it. Ticks only feed values, so nothing is drawn twice.
    this._ensureRaf();

    if (this._timerRunning) {
      this._timer = setTimeout(() => this._tickOnce(), this._nextTickDelayMs(nowTs));
    }
  }

  // While hidden/off-screen the tick loop slows to HIDDEN_TICK_INTERVAL_MS;
  // when painting resumes, tick immediately so the display snaps up to date.
  override _pokeTick() {
    if (!this._timerRunning || this._timer == null) return;
    this._clearTimerHandle();
    this._tickOnce();
  }
}

export { PatapataTimerElement };
