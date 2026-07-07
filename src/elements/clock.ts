
import {
  attrNumber,
  attrString,
  pick,
  readEasing,
  readHalfHeadTail,
  readMinDigits,
} from '../core/utils.ts';
import { buildClockPanels, clockProbeTextFromFormat, parseDiffTargetMs } from '../core/time-format.ts';
import {
  JS_DEFAULTS,
  TICK_INTERVAL_MS,
  HIDDEN_TICK_INTERVAL_MS,
  MS_PANEL_DURATION_MS,
  VISUAL_ONLY_ATTRS,
  CLOCK_OBSERVED_ATTRS,
  CLOCK_RESTART_ATTRS,
} from '../render/runtime.ts';
import { PatapataTextElement } from './text.ts';
import { applyPanelTokensToPart, buildSinglePartSequence } from './shared.ts';
import type { ClockConfig } from './types.ts';

class PatapataClockElement extends PatapataTextElement {
  _lastInvalidDiffWarning: string | null = null;
  _stepFn: (() => void) | null = null;

  static override get observedAttributes() {
    // Keep parity with patapata-text where it matters; add 'format'.
    return CLOCK_OBSERVED_ATTRS;
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.isConnected) this.start();
  }

  override attributeChangedCallback(name: string) {
    if (!this.isConnected) return;

    if (name === 'click') return;

    if (VISUAL_ONLY_ATTRS.has(name)) {
      this._refreshVisual();
      return;
    }

    if (CLOCK_RESTART_ATTRS.has(name)) {
      this._markLayoutVisual();
      this.start();
      return;
    }

    // autostart is not used as a gate for clock, but keep a restart on change.
    if (name === 'autostart') {
      this._markLayoutVisual();
      this.start();
      return;
    }

    this._markLayoutVisual();
    this._render(performance.now());
  }

  override _readConfig(): ClockConfig {
    const duration = pick(attrNumber(this, 'duration'), JS_DEFAULTS.duration);
    const format = pick(attrString(this, 'format'), 'HH:mm:ss');
    const diff = pick(attrString(this, 'diff'), '');

    const minDigits = readMinDigits(this);

    const { halfHead, halfTail } = readHalfHeadTail(this);

    const value = clockProbeTextFromFormat(format, minDigits);
    const visual = this._readVisualConfig('line');
    const light = this.hasAttribute('light');

    const easing = readEasing(this, 'linear');

    return { visual, interval: JS_DEFAULTS.interval, duration, value, light, easing, format, diff, minDigits, halfHead, halfTail };
  }

  override _ensureSequence() {
    const cfg = this._readConfig();

    const format = String(cfg.format ?? '');
    const diffRaw = String(cfg.diff ?? '').trim();
    const diffEnabled = !!diffRaw;
    const parsedDiffTargetMs = diffEnabled ? parseDiffTargetMs(diffRaw) : null;
    if (diffEnabled && parsedDiffTargetMs == null && this._lastInvalidDiffWarning !== diffRaw) {
      this._lastInvalidDiffWarning = diffRaw;
      console.warn('[patapata-clock] Invalid diff value; falling back to current time.', diffRaw);
    }
    if (!diffEnabled || parsedDiffTargetMs != null) this._lastInvalidDiffWarning = null;
    const diffTargetMs = diffEnabled ? (parsedDiffTargetMs ?? Date.now()) : null;
    const probe = String(cfg.value ?? '');
    const atomic = !!(cfg.visual && cfg.visual.atomic);

    const now = performance.now();
    const date = new Date();
    const initialDiffMs = (diffTargetMs != null) ? (diffTargetMs - date.getTime()) : null;
    const panels = buildClockPanels(format, date, initialDiffMs, cfg.minDigits || 0);
    const { sequence, part } = buildSinglePartSequence('clock', probe, panels.tokens, atomic);
    this._sequence = sequence;
    this._layoutDirty = true;

    // The isMsPanel flags are derived from the format tokens, so the initial
    // build tells us whether any panel updates at sub-second cadence.
    const hasMsPanels = panels.isMsPanel.some(Boolean);

    const nextTickDelayMs = () => {
      if (this._isPaintSuppressed()) return HIDDEN_TICK_INTERVAL_MS;
      if (hasMsPanels) return TICK_INTERVAL_MS;
      // Without ms tokens, displayed values only change on second boundaries.
      const toNextSecond = 1000 - (Date.now() % 1000);
      return Math.min(1000, Math.max(TICK_INTERVAL_MS, toNextSecond + 8));
    };

    const stepClockOnce = () => {
      if (!this._sequence) return;
      const nowTs = performance.now();
      const d = new Date();

      const diffMs = (diffTargetMs != null) ? (diffTargetMs - d.getTime()) : null;
      const { tokens, isMsPanel } = buildClockPanels(format, d, diffMs, cfg.minDigits || 0);
      applyPanelTokensToPart({
        part,
        tokens,
        isMsPanel,
        atomic,
        durationNormal: Math.max(1, cfg.duration || JS_DEFAULTS.duration),
        durationMsFixed: MS_PANEL_DURATION_MS,
        nowTs,
        allowRebuild: true,
        onLayoutDirty: () => { this._layoutDirty = true; },
      });

      // Keep probe text stable for layout caching.
      part.currentText = probe;

      // Painting is driven by the shared rAF loop; the flips started above
      // re-arm it. Ticks only feed values, so nothing is drawn twice.
      this._ensureRaf();
      this._timer = setTimeout(stepClockOnce, nextTickDelayMs());
    };

    this._stepFn = stepClockOnce;
    this._render(now);
    this._timer = setTimeout(stepClockOnce, nextTickDelayMs());
  }

  // While hidden/off-screen the tick loop slows to HIDDEN_TICK_INTERVAL_MS;
  // when painting resumes, tick immediately so the display snaps up to date.
  override _pokeTick() {
    if (this._timer == null || this._stepFn == null) return;
    clearTimeout(this._timer);
    this._timer = null;
    this._stepFn();
  }
}

export { PatapataClockElement };
