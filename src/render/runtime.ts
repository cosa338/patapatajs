// @ts-check

const JS_DEFAULTS = {
  interval: 800,
  duration: 1000,
  value: '',
  atomic: false,
  randMin: 5,
  randMax: 10,
};
const TICK_INTERVAL_MS = 16;
const MS_PANEL_DURATION_MS = 400;
const VISUAL_ONLY_ATTRS = new Set(['light', 'easing']);

const TEXT_OBSERVED_ATTRS = [
  'interval',
  'duration',
  'shuffle-time',
  'value',
  'rand',
  'rand-min',
  'rand-max',
  'atomic',
  'stack',
  'align-width',
  'half-head',
  'half-tail',
  'easing',
  'light',
  'repeat',
  'click',
  'autostart',
];
const TEXT_RESTART_ATTRS = new Set([
  'value',
  'interval',
  'duration',
  'shuffle-time',
  'rand',
  'rand-min',
  'rand-max',
  'repeat',
  'atomic',
  'stack',
  'align-width',
  'half-head',
  'half-tail',
]);

const CLOCK_OBSERVED_ATTRS = [
  'format',
  'diff',
  'min-digits',
  'duration',
  'atomic',
  'half-head',
  'half-tail',
  'light',
  'easing',
  'autostart',
  'click',
];
const CLOCK_RESTART_ATTRS = new Set([
  'format',
  'diff',
  'min-digits',
  'duration',
  'atomic',
  'half-head',
  'half-tail',
]);

const TIMER_OBSERVED_ATTRS = [
  'format',
  'sec',
  'min-digits',
  'duration',
  'atomic',
  'half-head',
  'half-tail',
  'light',
  'easing',
  'autostart',
  'click',
  'interval',
];
const TIMER_REFRESH_ATTRS = new Set([
  'format',
  'sec',
  'min-digits',
  'duration',
  'atomic',
  'half-head',
  'half-tail',
  'interval',
]);

interface RuntimeElement extends Element {
  _onGlobalRafFrame?: (now: number) => boolean;
  _onGlobalVisibilityChange?: () => void;
  _setIntersecting?: (value: boolean) => void;
}

const RUNTIME = {
  supportsIO: typeof IntersectionObserver !== 'undefined',
  raf: {
    rafId: null as number | null,
    queue: new Set<RuntimeElement>(),
  },
  vis: {
    io: null as IntersectionObserver | null,
    elements: new Set<RuntimeElement>(),
    docListenerInstalled: false,
  },
  canvasBgCacheLimit: 64,
  cardBgCache: new Map<string, HTMLCanvasElement>(),
  halfBgCache: new Map<string, HTMLCanvasElement>(),
  cacheStats: {
    cardHits: 0,
    cardMisses: 0,
    halfHits: 0,
    halfMisses: 0,
    evictions: 0,
    clears: 0,
  },
  // Debug/ops hooks (non-public)
  clearCaches() {
    RUNTIME.cardBgCache.clear();
    RUNTIME.halfBgCache.clear();
    RUNTIME.cacheStats.clears++;
  },
  getCacheStats() {
    return {
      ...RUNTIME.cacheStats,
      cardSize: RUNTIME.cardBgCache.size,
      halfSize: RUNTIME.halfBgCache.size,
      limit: RUNTIME.canvasBgCacheLimit,
    };
  },
  setCanvasBgCacheLimit(limit: number) {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return;
    RUNTIME.canvasBgCacheLimit = Math.max(1, Math.floor(n));
  },
};

const isRuntimeDebugEnabled = () => {
  try {
    const search = (typeof location !== 'undefined' && location && typeof location.search === 'string') ? location.search : '';
    if (/(?:^|[?&])ppdebug=1(?:&|$)/.test(search)) return true;
    if (/(?:^|[?&])patapataDebug=1(?:&|$)/.test(search)) return true;

    if (typeof localStorage !== 'undefined' && localStorage) {
      if (localStorage.getItem('patapataDebug') === '1') return true;
    }
  } catch (_) {}
  return false;
};

try {
  if (typeof globalThis !== 'undefined' && isRuntimeDebugEnabled()) {
    globalThis.__patapataRuntime = RUNTIME;
  }
} catch (_) {}

function globalRafRequest(el: RuntimeElement) {
  RUNTIME.raf.queue.add(el);
  if (RUNTIME.raf.rafId != null) return;
  RUNTIME.raf.rafId = requestAnimationFrame((t) => globalRafTick(t));
}

function globalRafTick(now: number) {
  RUNTIME.raf.rafId = null;
  const batch = Array.from(RUNTIME.raf.queue);
  RUNTIME.raf.queue.clear();

  for (const el of batch) {
    if (!el || !el.isConnected) continue;
    if (typeof el._onGlobalRafFrame !== 'function') continue;
    const keep = el._onGlobalRafFrame(now);
    if (keep) globalRafRequest(el);
  }
}

function ensureGlobalVisibility() {
  if (!RUNTIME.vis.docListenerInstalled) {
    RUNTIME.vis.docListenerInstalled = true;
    document.addEventListener('visibilitychange', () => {
      for (const el of RUNTIME.vis.elements) {
        if (typeof el._onGlobalVisibilityChange === 'function') el._onGlobalVisibilityChange();
      }
    });
  }

  if (!RUNTIME.supportsIO) return;
  if (RUNTIME.vis.io) return;
  RUNTIME.vis.io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as RuntimeElement;
        if (el && typeof el._setIntersecting === 'function') {
          el._setIntersecting(!!entry.isIntersecting);
        }
      }
    },
    { root: null, threshold: 0.01 }
  );
}

function registerVisibility(el: RuntimeElement) {
  ensureGlobalVisibility();
  RUNTIME.vis.elements.add(el);
  if (RUNTIME.supportsIO && RUNTIME.vis.io) {
    try {
      RUNTIME.vis.io.observe(el);
    } catch (_) {}
  }
}

function unregisterVisibility(el: RuntimeElement) {
  RUNTIME.vis.elements.delete(el);
  if (RUNTIME.supportsIO && RUNTIME.vis.io) {
    try {
      RUNTIME.vis.io.unobserve(el);
    } catch (_) {}
  }
}

export {
  JS_DEFAULTS,
  TICK_INTERVAL_MS,
  MS_PANEL_DURATION_MS,
  VISUAL_ONLY_ATTRS,
  TEXT_OBSERVED_ATTRS,
  TEXT_RESTART_ATTRS,
  CLOCK_OBSERVED_ATTRS,
  CLOCK_RESTART_ATTRS,
  TIMER_OBSERVED_ATTRS,
  TIMER_REFRESH_ATTRS,
  RUNTIME,
  globalRafRequest,
  registerVisibility,
  unregisterVisibility,
};
