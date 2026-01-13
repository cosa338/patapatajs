/*!
 * patapata.jp v0.1.0
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 https://github.com/cosa338
 */

(() => {
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

  // ===== Performance helpers =====

  const RUNTIME = {
    supportsIO: typeof IntersectionObserver !== 'undefined',
    raf: {
      rafId: null,
      queue: new Set(),
    },
    vis: {
      io: null,
      elements: new Set(),
      docListenerInstalled: false,
    },
    canvasBgCacheLimit: 64,
    cardBgCache: new Map(),
    halfBgCache: new Map(),
    cacheStats: {
      cardHits: 0,
      cardMisses: 0,
      halfHits: 0,
      halfMisses: 0,
      evictions: 0,
      clears: 0,
    },
  };

  // Debug/ops hooks (non-public)
  RUNTIME.clearCaches = () => {
    RUNTIME.cardBgCache.clear();
    RUNTIME.halfBgCache.clear();
    RUNTIME.cacheStats.clears++;
  };

  RUNTIME.getCacheStats = () => ({
    ...RUNTIME.cacheStats,
    cardSize: RUNTIME.cardBgCache.size,
    halfSize: RUNTIME.halfBgCache.size,
    limit: RUNTIME.canvasBgCacheLimit,
  });

  RUNTIME.setCanvasBgCacheLimit = (limit) => {
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0) return;
    RUNTIME.canvasBgCacheLimit = Math.max(1, Math.floor(n));
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

  function globalRafRequest(el) {
    RUNTIME.raf.queue.add(el);
    if (RUNTIME.raf.rafId != null) return;
    RUNTIME.raf.rafId = requestAnimationFrame((t) => globalRafTick(t));
  }

  function globalRafTick(now) {
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
          const el = entry.target;
          if (el && typeof el._setIntersecting === 'function') {
            el._setIntersecting(!!entry.isIntersecting);
          }
        }
      },
      { root: null, threshold: 0.01 }
    );
  }

  function registerVisibility(el) {
    ensureGlobalVisibility();
    RUNTIME.vis.elements.add(el);
    if (RUNTIME.supportsIO && RUNTIME.vis.io) {
      try {
        RUNTIME.vis.io.observe(el);
      } catch (_) {}
    }
  }

  function unregisterVisibility(el) {
    RUNTIME.vis.elements.delete(el);
    if (RUNTIME.supportsIO && RUNTIME.vis.io) {
      try {
        RUNTIME.vis.io.unobserve(el);
      } catch (_) {}
    }
  }

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

  function attrString(el, name) {
    const raw = el.getAttribute(name);
    return raw == null ? null : String(raw);
  }

  function attrNumber(el, name) {
    const raw = el.getAttribute(name);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function attrBool(el, name, defaultValue) {
    if (!el.hasAttribute(name)) return defaultValue;
    const raw = el.getAttribute(name);
    if (raw == null || raw === '') return true;
    const v = String(raw).toLowerCase().trim();
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
    return true;
  }

  function cssVar(el, name) {
    const v = getComputedStyle(el).getPropertyValue(name);
    const trimmed = v == null ? '' : String(v).trim();
    return trimmed || null;
  }

  function pick(...vals) {
    for (const v of vals) {
      if (v != null) return v;
    }
    return null;
  }

  function readHalfHeadTail(el) {
    const halfHeadRaw = attrNumber(el, 'half-head');
    const halfTailRaw = attrNumber(el, 'half-tail');
    const halfHead = (typeof halfHeadRaw === 'number' && Number.isFinite(halfHeadRaw) && halfHeadRaw > 0)
      ? Math.floor(halfHeadRaw)
      : 0;
    const halfTail = (typeof halfTailRaw === 'number' && Number.isFinite(halfTailRaw) && halfTailRaw > 0)
      ? Math.floor(halfTailRaw)
      : 0;
    return { halfHead, halfTail };
  }

  function readMinDigits(el) {
    const raw = attrNumber(el, 'min-digits');
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 0;
  }

  function readEasing(el, fallback = 'linear') {
    return pick(
      normalizeEasingName(attrString(el, 'easing')),
      normalizeEasingName(cssVar(el, '--patapata-easing')),
      fallback
    );
  }

  function splitGraphemes(str) {
    // Prefer a user-perceived "single character" (emoji / combining marks).
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        return Array.from(seg.segment(str), (s) => s.segment);
      }
    } catch (_) {}
    return Array.from(str);
  }

  function parseJsonLoose(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    // Only attempt JSON parse when it plausibly looks like JSON.
    const c0 = s[0];
    if (c0 !== '[' && c0 !== '{') return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }

  function normalizePartsFromValue(valueRaw) {
    const parsed = parseJsonLoose(valueRaw);
    if (parsed == null) {
      return [[String(valueRaw ?? '')]];
    }

    const toStringArray = (arr) => (Array.isArray(arr) ? arr.map((v) => String(v ?? '')) : null);

    // Support: ["a","b"] -> single part
    // Support: [["a","b"],["c","d"]] -> multi parts
    // Support: {items:[...]} / {items:{items:[...]}}
    let rawItems = null;
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else {
      return [[String(valueRaw ?? '')]];
    }

    if (!rawItems.length) return [['']];

    const looksMulti = Array.isArray(rawItems[0]) || (rawItems[0] && typeof rawItems[0] === 'object' && Array.isArray(rawItems[0].items));
    const normalized = looksMulti ? rawItems : [rawItems];

    const parts = [];
    for (const p of normalized) {
      const arr = Array.isArray(p) ? p : (p && typeof p === 'object' ? p.items : null);
      const sarr = toStringArray(arr);
      if (sarr && sarr.length) parts.push(sarr);
      else if (sarr) parts.push([]);
    }
    return parts.length ? parts : [['']];
  }

  // ===== Random text sources =====
  const HALF_SPACE_RANGE = [0x0020, 0x0020];
  const FULL_SPACE_RANGE = [0x3000, 0x3000];

  const HALF_DIGIT_RANGES = [[0x0030, 0x0039], HALF_SPACE_RANGE];
  const HALF_UPPER_RANGES = [[0x0041, 0x005A], HALF_SPACE_RANGE];
  const HALF_LOWER_RANGES = [[0x0061, 0x007A], HALF_SPACE_RANGE];
  const HALF_ALL_RANGES = [
    [0x0030, 0x0039],
    [0x0041, 0x005A],
    [0x0061, 0x007A],
    HALF_SPACE_RANGE,
  ];

  const FULL_HIRA_RANGES = [[0x3041, 0x3096], FULL_SPACE_RANGE];
  const FULL_KATA_RANGES = [[0x30A1, 0x30FA], FULL_SPACE_RANGE];
  const FULL_DIGIT_RANGES = [[0xFF10, 0xFF19], FULL_SPACE_RANGE];

  const SIMPLE_KANJI = Array.from(
    '日月火水木金土年時分秒上下左右大小中入口出回数字一二三四五六七八九十百千万円本語名人前後新古早遅高安長短強弱男女子友愛天気雨雪風海山川田森林空星花草犬猫鳥魚車電駅店会社学校先生休祝今昨明曜'
  ).filter(Boolean);

  const RANDOM_FULLWIDTH_FALLBACK = [
    ...SIMPLE_KANJI,
    '　',
    ...['あ', 'い', 'う', 'え', 'お', 'カ', 'キ', 'ク', 'ケ', 'コ', '０', '１', '２', '３', '４', '５', '６', '７', '８', '９'],
  ];

  // Shared sources to avoid per-call allocations in rand/shuffle modes.
  const CJK_KANJI_WITH_SPACE = [...SIMPLE_KANJI, '　'];

  const SRC_HALF_DIGIT = { type: 'ranges', ranges: HALF_DIGIT_RANGES, blank: ' ' };
  const SRC_HALF_UPPER = { type: 'ranges', ranges: HALF_UPPER_RANGES, blank: ' ' };
  const SRC_HALF_LOWER = { type: 'ranges', ranges: HALF_LOWER_RANGES, blank: ' ' };
  const SRC_HALF_ALL = { type: 'ranges', ranges: HALF_ALL_RANGES, blank: ' ' };

  const SRC_FULL_HIRA = { type: 'ranges', ranges: FULL_HIRA_RANGES, blank: '　' };
  const SRC_FULL_KATA = { type: 'ranges', ranges: FULL_KATA_RANGES, blank: '　' };
  const SRC_FULL_DIGIT = { type: 'ranges', ranges: FULL_DIGIT_RANGES, blank: '　' };

  const SRC_CJK = { type: 'set', chars: CJK_KANJI_WITH_SPACE, blank: '　' };
  const SRC_FULLWIDTH_FALLBACK = { type: 'set', chars: RANDOM_FULLWIDTH_FALLBACK, blank: '　' };

  const isCjkIdeograph = (cp) => (cp >= 0x4e00 && cp <= 0x9fff);
  const isInRanges = (cp, ranges) => {
    for (const [a, b] of ranges) {
      if (cp >= a && cp <= b) return true;
    }
    return false;
  };

  const isHalfwidthAscii = (cp) => (cp >= 0x0020 && cp <= 0x007e);

  const randomIntInclusive = (min, max) => {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    if (b < a) return a;
    return a + Math.floor(Math.random() * (b - a + 1));
  };

  const randomCharFromRanges = (ranges) => {
    if (!Array.isArray(ranges) || ranges.length === 0) return '';
    for (let attempts = 0; attempts < 3; attempts++) {
      const picked = ranges[Math.floor(Math.random() * ranges.length)];
      if (!Array.isArray(picked) || picked.length < 2) continue;
      const a0 = picked[0];
      const b0 = picked[1];
      if (typeof a0 !== 'number' || typeof b0 !== 'number') continue;
      if (!Number.isFinite(a0) || !Number.isFinite(b0)) continue;

      let a = Math.floor(a0);
      let b = Math.floor(b0);
      if (b < a) [a, b] = [b, a];

      a = Math.min(0x10ffff, Math.max(0, a));
      b = Math.min(0x10ffff, Math.max(0, b));
      if (b < a) continue;

      const cp = a + Math.floor(Math.random() * (b - a + 1));
      try {
        return String.fromCodePoint(cp);
      } catch {
      }
    }
    return '';
  };

  const RandomText = {
    pickSourceForChar: (ch) => {
      if (!ch) return null;
      const cp = ch.codePointAt(0);
      if (typeof cp !== 'number') return null;

      if (cp >= 0x0030 && cp <= 0x0039) return SRC_HALF_DIGIT;
      if (cp >= 0x0041 && cp <= 0x005a) return SRC_HALF_UPPER;
      if (cp >= 0x0061 && cp <= 0x007a) return SRC_HALF_LOWER;
      if (isHalfwidthAscii(cp)) return SRC_HALF_ALL;

      if (isInRanges(cp, FULL_HIRA_RANGES)) return SRC_FULL_HIRA;
      if (isInRanges(cp, FULL_KATA_RANGES)) return SRC_FULL_KATA;
      if (isInRanges(cp, FULL_DIGIT_RANGES)) return SRC_FULL_DIGIT;
      if (isCjkIdeograph(cp)) return SRC_CJK;

      return SRC_FULLWIDTH_FALLBACK;
    },

    hasAnyFullwidth: (str) => {
      const s = String(str || '');
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (typeof cp !== 'number') continue;
        if (!isHalfwidthAscii(cp)) return true;
      }
      return false;
    },

    pickSourceForAtomicString: (str) => {
      if (RandomText.hasAnyFullwidth(str)) {
        return SRC_FULLWIDTH_FALLBACK;
      }
      return SRC_HALF_ALL;
    },

    randomCharFromSource: (source) => {
      if (!source) return '';
      if (source.type === 'ranges') return randomCharFromRanges(source.ranges);
      if (source.type === 'set') {
        const arr = Array.isArray(source.chars) ? source.chars : [];
        if (!arr.length) return '';
        const v = arr[Math.floor(Math.random() * arr.length)];
        return typeof v === 'string' && v ? v : '';
      }
      return '';
    },

    blankForSource: (source) => {
      if (!source) return '';
      if (typeof source.blank === 'string') return source.blank;
      if (source.type === 'ranges') {
        const r = source.ranges;
        if (r === FULL_HIRA_RANGES || r === FULL_KATA_RANGES || r === FULL_DIGIT_RANGES) return '　';
        return ' ';
      }
      return RandomText.hasAnyFullwidth((source.chars || []).join('')) ? '　' : ' ';
    },
  };

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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function normalizeEasingName(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'linear') return 'linear';
    if (s === 'ease' || s === 'ease-in' || s === 'easein') return 'ease';
    if (s === 'bounce' || s === 'ease-bounce' || s === 'easebounce') return 'bounce';
    return null;
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

  function readCssColor(el, name) {
    const v = cssVar(el, name);
    return v ? String(v) : null;
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
    const baseY = (half === 'top') ? 0 : halfH;
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

      const destY0 = y + baseY + ((srcYpx - baseYpx0) / dpr);
      const destY1 = y + baseY + ((srcYpx - baseYpx0 + srcHpxO) / dpr);
      const destH = Math.max(0.0001, destY1 - destY0);
      const pivotY = destY0 + destH / 2;

      ctx.save();
      ctx.translate(cx, pivotY);
      ctx.scale(scaleX, 1);
      ctx.translate(-cx, -pivotY);
      ctx.drawImage(
        src,
        0,
        srcYpx,
        srcWpx,
        srcHpxO,
        x,
        destY0,
        w,
        destH
      );
      ctx.restore();
    }

    // Extra rim thickness near the hinge during flip.
    drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta);
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
    constructor() {
      super();

      this._shadow = this.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = HOST_DEFAULT_STYLE_TEXT;

      this._canvas = document.createElement('canvas');
      this._ctx = this._canvas.getContext('2d');

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

  class FlipAnimation {
    constructor(from, to, startTime, durationMs = null) {
      this.from = from;
      this.to = to;
      this.startTime = startTime;
      this.durationMs = (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0)
        ? durationMs
        : null;
    }
  }

  class Flipper {
    constructor(startValue) {
      this.baseValue = String(startValue ?? '');
      // animations: [newest (back) ... oldest (front)]
      this.animations = [];
    }

    setValue(v) {
      this.baseValue = String(v ?? '');
      this.animations.length = 0;
    }

    transitionTo(next, now, durationMs = null) {
      const to = String(next ?? '');
      if (to === this.baseValue) return;
      const anim = new FlipAnimation(this.baseValue, to, now, durationMs);
      this.animations.unshift(anim);
      this.baseValue = to;
    }

    update(now, defaultDurationMs) {
      const fallback = Math.max(1, defaultDurationMs || 1);
      const len = this.animations.length;
      if (len <= 0) return;

      let write = 0;
      for (let i = 0; i < len; i++) {
        const anim = this.animations[i];
        const dur = Math.max(1, anim.durationMs || fallback);
        const elapsed = now - anim.startTime;
        if (elapsed < dur) {
          this.animations[write] = anim;
          write++;
        }
      }
      this.animations.length = write;
    }

    hasActive() {
      return this.animations.length > 0;
    }
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

  class PatapataTextElement extends PatapataCanvasBaseElement {
    static get observedAttributes() {
      return TEXT_OBSERVED_ATTRS;
    }

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
      if (this._timer) {
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
      this._render();
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
        this._render();
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
      this._render();
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
      const cfg = this._readConfig();

      const atomic = !!(cfg.visual && cfg.visual.atomic);

      const interval = Math.max(1, cfg.interval || JS_DEFAULTS.interval);

      const repeat = this.hasAttribute('repeat');
      const layout = this.hasAttribute('stack') ? 'stack' : 'row';

      const shuffleTimeAttr = attrNumber(this, 'shuffle-time');
      const shuffleTimeMs = (typeof shuffleTimeAttr === 'number' && Number.isFinite(shuffleTimeAttr) && shuffleTimeAttr > 0)
        ? shuffleTimeAttr
        : 0;

      const parsed = parseJsonLoose(cfg.value);
      if (parsed == null) {
        // Not JSON -> either normal static text, or rand effect.
        const randEnabled = attrBool(this, 'rand', false);
        if (!randEnabled) {
          this._render(performance.now());
          return;
        }

        // Rand effect: show random characters for a while, then settle on the target value.
        const target = String(cfg.value ?? '');

        const minAttr = attrNumber(this, 'rand-min');
        const maxAttr = attrNumber(this, 'rand-max');
        const hasMin = typeof minAttr === 'number' && Number.isFinite(minAttr) && minAttr >= 0;
        const hasMax = typeof maxAttr === 'number' && Number.isFinite(maxAttr) && maxAttr >= 0;

        let randMin;
        let randMax;
        if (!hasMin && !hasMax) {
          randMin = JS_DEFAULTS.randMin;
          randMax = JS_DEFAULTS.randMax;
        } else if (!hasMin && hasMax) {
          randMax = maxAttr;
          randMin = Math.floor(randMax / 2);
        } else if (hasMin && !hasMax) {
          randMin = minAttr;
          randMax = randMin * 2;
        } else {
          randMin = minAttr;
          randMax = maxAttr;
        }
        randMin = Math.max(0, randMin);
        randMax = Math.max(0, randMax);
        if (randMax < randMin) randMax = randMin;

        const targetTokens = atomic ? [target] : splitGraphemes(target);
        const count = Math.max(1, targetTokens.length);

        const sources = atomic
          ? [target ? RandomText.pickSourceForAtomicString(target) : null]
          : targetTokens.map((t) => RandomText.pickSourceForChar(t));
        const remaining = sources.map((s) => (s ? randomIntInclusive(randMin, randMax) : 0));

        const initialText = atomic
          ? (sources[0] ? RandomText.blankForSource(sources[0]) : target)
          : targetTokens.map((t, idx) => (sources[idx] ? RandomText.blankForSource(sources[idx]) : String(t ?? ''))).join('');

        const flippers = [];
        for (let i = 0; i < count; i++) flippers.push(new Flipper(''));

        const part = {
          items: [target],
          maxLen: atomic ? 1 : count,
          flippers,
          currentText: initialText,
          lastIndex: 0,
        };

        // Apply initial display without animation.
        if (atomic) {
          part.flippers[0].setValue(initialText);
        } else {
          const initTokens = splitGraphemes(initialText);
          for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initTokens[i] ?? '');
        }

        this._sequence = {
          mode: 'rand',
          layout,
          repeat,
          steps: 1,
          stepIndex: 0,
          shuffleEndAt: null,
          parts: [part],
        };

        const applyPartText = (p, raw, now) => {
          p.currentText = String(raw ?? '');
          const tokens = atomic ? [p.currentText] : (() => {
            const g = splitGraphemes(p.currentText);
            const out = [];
            for (let i = 0; i < p.maxLen; i++) out.push(g[i] ?? '');
            return out;
          })();

          while (p.flippers.length < tokens.length) p.flippers.push(new Flipper(''));
          if (p.flippers.length > tokens.length) p.flippers.length = tokens.length;

          for (let i = 0; i < p.flippers.length; i++) {
            p.flippers[i].transitionTo(tokens[i] ?? '', now);
          }
        };

        const stepRandOnce = () => {
          if (!this._sequence || !this._sequence.parts.length) return;
          const now = performance.now();

          if (!remaining.some((n) => n > 0)) {
            applyPartText(part, atomic ? target : targetTokens.join(''), now);
            this._timer = null;
            this._render(now);
            this._ensureRaf();
            return;
          }

          let nextText;
          if (atomic) {
            const src = sources[0];
            if (src && remaining[0] > 0) {
              remaining[0] = Math.max(0, remaining[0] - 1);
              const len = splitGraphemes(target).length;
              nextText = Array.from({ length: len }, () => RandomText.randomCharFromSource(src)).join('');
            } else {
              nextText = target;
            }
          } else {
            const arr = targetTokens.map((c, idx) => {
              const src = sources[idx];
              if (!src) return c;
              if (remaining[idx] > 0) {
                remaining[idx] = Math.max(0, remaining[idx] - 1);
                return RandomText.randomCharFromSource(src);
              }
              return c;
            });
            nextText = arr.join('');
          }

          applyPartText(part, nextText, now);
          this._render(now);
          this._ensureRaf();
          this._timer = setTimeout(stepRandOnce, interval);
        };

        this._render(performance.now());
        this._timer = setTimeout(stepRandOnce, interval);
        return;
      }

      const partsItems = normalizePartsFromValue(cfg.value);

      const steps = Math.max(1, ...partsItems.map((arr) => (Array.isArray(arr) ? arr.length : 0)));
      if (steps <= 1) {
        // JSON but only one step -> no sequencing needed.
        this._render(performance.now());
        return;
      }
      const paddedParts = partsItems.map((arr) => {
        const out = [];
        for (let i = 0; i < steps; i++) out.push(arr[i] ?? '');
        return out;
      });

      // For shuffle, do NOT include padded empty values as candidates.
      const partsForMode = shuffleTimeMs > 0 ? partsItems : paddedParts;

      const alignWidth = this.hasAttribute('align-width');
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

      this._sequence = {
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

      const applyPartText = (p, raw, now) => {
        p.currentText = String(raw ?? '');
        const tokens = atomic ? [p.currentText] : (() => {
          const g = splitGraphemes(p.currentText);
          const out = [];
          for (let i = 0; i < p.maxLen; i++) out.push(g[i] ?? '');
          return out;
        })();

        // Ensure flippers length (in case atomic toggles).
        while (p.flippers.length < tokens.length) p.flippers.push(new Flipper(''));
        if (p.flippers.length > tokens.length) p.flippers.length = tokens.length;

        for (let i = 0; i < p.flippers.length; i++) {
          p.flippers[i].transitionTo(tokens[i] ?? '', now);
        }
      };

      const stepSequenceOnce = () => {
        if (!this._sequence) return;
        const nextIndex = this._sequence.stepIndex + 1;
        if (!this._sequence.repeat && nextIndex >= this._sequence.steps) {
          this._sequence.stepIndex = this._sequence.steps - 1;
          // Keep the final frame visible; stop timers but keep sequence state.
          this._timer = null;
          this._render(performance.now());
          return;
        }

        this._sequence.stepIndex = this._sequence.repeat ? (nextIndex % this._sequence.steps) : nextIndex;

        const now = performance.now();
        for (const p of this._sequence.parts) {
          const raw = p.items[this._sequence.stepIndex] ?? '';
          applyPartText(p, raw, now);
        }

        // Timer-driven stepping shouldn't recompute CSS-derived config every time.
        this._render(now, true);
        this._ensureRaf();
        this._timer = setTimeout(stepSequenceOnce, interval);
      };

      const stepShuffleOnce = () => {
        if (!this._sequence) return;
        const now = performance.now();
        const endAt = this._sequence.shuffleEndAt;
        if (typeof endAt === 'number' && Number.isFinite(endAt) && now >= endAt) {
          // Stop on current result (do not reset / loop automatically).
          this._timer = null;
          this._render(now, true);
          return;
        }

        for (const p of this._sequence.parts) {
          const n = Array.isArray(p.items) ? p.items.length : 0;
          if (n <= 0) continue;
          let idx = Math.floor(Math.random() * n);
          if (n >= 2 && idx === p.lastIndex) idx = (idx + 1 + Math.floor(Math.random() * (n - 1))) % n;
          p.lastIndex = idx;
          const raw = p.items[idx] ?? '';
          applyPartText(p, raw, now);
        }

        // Timer-driven stepping shouldn't recompute CSS-derived config every time.
        this._render(now, true);
        this._ensureRaf();
        this._timer = setTimeout(stepShuffleOnce, interval);
      };

      // Start stepping from the current (initial) frame.
      this._timer = setTimeout(shuffleTimeMs > 0 ? stepShuffleOnce : stepSequenceOnce, interval);
    }

    _readConfig() {
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
      if (this._isPaintSuppressed()) {
        this._refreshIntersectionIfStale();
        if (this._isPaintSuppressed()) {
          // Defer all heavy work until we become visible again.
          this._layoutDirty = true;
          this._visualDirty = true;
          return;
        }
      }

      const cfg = (fromRaf && this._cfg && !this._visualDirty) ? this._cfg : this._readConfig();
      this._cfg = cfg;
      this._visualDirty = false;

      const v = cfg.visual;

      const layout = this.hasAttribute('stack') ? 'stack' : 'row';
      const alignWidth = this.hasAttribute('align-width');

      const halfHead = Math.max(0, Math.floor(cfg.halfHead || 0));
      const halfTail = Math.max(0, Math.floor(cfg.halfTail || 0));

      const ctx = this._ctx;
      const applyTextState = () => {
        ctx.font = `${v.font.weight} ${v.font.sizePx}px ${v.font.family}`;
        const align = v.text.align;
        ctx.textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';
        // textBaseline='middle' can drift visually depending on font metrics.
        // Use 'alphabetic' and compute the y-position from ascent/descent.
        ctx.textBaseline = 'alphabetic';
      };

      applyTextState();

      const buildHalfScales = (count) => {
        const n = Math.max(0, Math.floor(count || 0));
        if (n <= 0) return [];
        if (v.atomic) {
          const enable = halfHead > 0 || halfTail > 0;
          return Array.from({ length: n }, () => enable ? 0.5 : 1);
        }
        const out = Array.from({ length: n }, () => 1);
        const hHead = Math.min(n, halfHead);
        const hTail = Math.min(n, halfTail);
        for (let i = 0; i < hHead; i++) out[i] = 0.5;
        for (let i = n - hTail; i < n; i++) {
          if (i >= 0 && i < n) out[i] = 0.5;
        }
        return out;
      };

      const buildOffsetsAndWidth = (count, cardWidthPx, scales) => {
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
      };

      const withScaledCard = (x, y, scale, drawFn) => {
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

      const isSequencing = !!this._sequence;
      const cachedLayout = (() => {
        if (!(fromRaf && !this._layoutDirty && this._layoutCache)) return null;
        const c = this._layoutCache;
        if (!isSequencing || !this._sequence) return c;

        // If flipper counts changed (e.g. diff digits grow/shrink, '-' appears),
        // the cached geometry can clip the right edge. Validate counts before reuse.
        if (!c.geomParts || c.geomParts.length !== this._sequence.parts.length) return null;
        for (let i = 0; i < this._sequence.parts.length; i++) {
          const expected = v.atomic ? 1 : this._sequence.parts[i].flippers.length;
          if ((c.geomParts[i]?.count ?? 0) !== expected) return null;
        }
        return c;
      })();
      const partsItems = cachedLayout ? cachedLayout.partsItems : normalizePartsFromValue(cfg.value);
      const isJsonValue = cachedLayout ? cachedLayout.isJsonValue : (parseJsonLoose(cfg.value) != null);
      const useParts = isJsonValue;

      const dpr = window.devicePixelRatio || 1;

      let geomParts;
      let totalW;
      let totalH;
      let outerPadX;

      if (cachedLayout) {
        ({ geomParts, totalW, totalH, outerPadX } = cachedLayout);
      } else {
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

        if (!this._layoutDirty && this._layoutCache && this._layoutCache.key === layoutKey) {
          ({ geomParts, totalW, totalH, outerPadX } = this._layoutCache);
        } else {
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

          if (isSequencing && this._sequence) {
            // Sequencing mode: geometry is driven by stable flipper counts.
            geomParts = this._sequence.parts.map((sp, idx) => {
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
              const scales = buildHalfScales(count);
              const { offsets, partW } = buildOffsetsAndWidth(count, cardWidthPx, scales);
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
              const scales = buildHalfScales(count);
              const { offsets, partW } = buildOffsetsAndWidth(count, cardWidthPx, scales);
              return { count, cardWidthPx, partW, tokens, scales, offsets };
            });
          }

          totalH = (layout === 'stack' && geomParts.length > 1)
            ? (v.cardHeight * geomParts.length + v.gap * (geomParts.length - 1))
            : v.cardHeight;

          totalW = outerPadX * 2 + ((layout === 'row' && geomParts.length > 1)
            ? (geomParts.reduce((sum, p) => sum + p.partW, 0) + v.gap * (geomParts.length - 1))
            : Math.max(...geomParts.map((p) => p.partW)));

          this._layoutCache = {
            key: layoutKey,
            partsItems,
            isJsonValue,
            geomParts,
            totalW,
            totalH,
            outerPadX,
          };
          this._layoutDirty = false;
        }
      }

      const pxW = Math.max(1, Math.floor(totalW * dpr));
      const pxH = Math.max(1, Math.floor(totalH * dpr));
      const needsResize = this._canvas.width !== pxW || this._canvas.height !== pxH;
      const cssW = `${totalW}px`;
      const cssH = `${totalH}px`;
      const needsStyle = this._canvas.style.width !== cssW || this._canvas.style.height !== cssH;
      if (needsResize) {
        this._canvas.width = pxW;
        this._canvas.height = pxH;
        this._canvas.style.width = cssW;
        this._canvas.style.height = cssH;
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        applyTextState();
      } else if (needsStyle) {
        this._canvas.style.width = cssW;
        this._canvas.style.height = cssH;
      } else {
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, totalW, totalH);

      const renderStaticPart = (part, originX, originY) => {
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

      const renderSequencePart = (partIdx, partGeom, originX, originY) => {
        const seqPart = this._sequence && this._sequence.parts[partIdx] ? this._sequence.parts[partIdx] : null;
        if (!seqPart) {
          renderStaticPart(partGeom, originX, originY);
          return;
        }

        const duration = Math.max(1, cfg.duration || JS_DEFAULTS.duration);
        const nowSafe = typeof now === 'number' && Number.isFinite(now) ? now : performance.now();
        const animDuration = (anim) => Math.max(1, (anim && anim.durationMs) ? anim.durationMs : duration);

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
      const a11yText = (isSequencing && this._sequence)
        ? this._sequence.parts.map((sp) => sp.flippers.map((f) => String(f.baseValue ?? '')).join('')).join(a11ySep)
        : (useParts
          ? partsItems.map((arr) => ((Array.isArray(arr) && arr.length) ? String(arr[0] ?? '') : '')).join(a11ySep)
          : String(cfg.value ?? ''));
      this._applyAutoAriaLabel(a11yText);
    }
  }


  const CLOCK_TOKENS = [
    'ampm_jp',
    'ddd_jp',
    'HH12',
    'YYYY',
    'SSS',
    'DDD',
    'HHH',
    'mmm',
    'sss',
    'ampm',
    'ddd',
    'YY',
    'MM',
    'DD',
    'HH',
    'mm',
    'ss',
    'SS',
    'S',
  ];

  const CLOCK_DDD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const CLOCK_DDD_JP = ['日', '月', '火', '水', '木', '金', '土'];

  function pad2(n) {
    const s = String(Math.trunc(n) % 100);
    return s.length >= 2 ? s : `0${s}`;
  }

  function pad3(n) {
    const s = String(Math.trunc(n) % 1000);
    if (s.length >= 3) return s;
    if (s.length === 2) return `0${s}`;
    return `00${s}`;
  }

  function padN(n, digits) {
    const s = String(Math.trunc(n));
    if (s.length >= digits) return s;
    return `${'0'.repeat(digits - s.length)}${s}`;
  }

  function parseDiffTargetMs(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
      const ms = dt.getTime();
      return Number.isFinite(ms) ? ms : null;
    }

    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
  }

  function clampNonNegativeMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return 0;
    return n <= 0 ? 0 : n;
  }

  function tokenizeClockFormat(fmt) {
    const s = String(fmt ?? '');
    const out = [];
    for (let i = 0; i < s.length;) {
      let matched = null;
      for (const t of CLOCK_TOKENS) {
        if (s.startsWith(t, i)) {
          matched = t;
          break;
        }
      }
      if (matched) {
        out.push({ type: 'token', value: matched });
        i += matched.length;
      } else {
        const ch = splitGraphemes(s.slice(i))[0] ?? s[i];
        out.push({ type: 'lit', value: ch });
        i += ch.length;
      }
    }
    return out;
  }

  function clockTokenValue(token, date) {
    const d = date;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = d.getHours();
    const mi = d.getMinutes();
    const ss = d.getSeconds();
    const ms = d.getMilliseconds();

    switch (token) {
      case 'YYYY': return String(y).padStart(4, '0');
      case 'YY': return pad2(y % 100);
      case 'MM': return pad2(m);
      case 'DD': return pad2(dd);
      case 'HH': return pad2(hh);
      case 'HH12': {
        const h12 = ((hh % 12) || 12);
        return pad2(h12);
      }
      case 'ampm': return hh < 12 ? 'AM' : 'PM';
      case 'ampm_jp': return hh < 12 ? '午前' : '午後';
      case 'mm': return pad2(mi);
      case 'ss': return pad2(ss);
      case 'S': return String(Math.floor(ms / 100));
      case 'SS': return pad2(Math.floor(ms / 10));
      case 'SSS': return pad3(ms);
      case 'ddd': return CLOCK_DDD[d.getDay()] || '';
      case 'ddd_jp': return CLOCK_DDD_JP[d.getDay()] || '';
      default: return '';
    }
  }

  function clockDiffTokenValue(token, diffMs, minDigits = 0) {
    const n = Number(diffMs);
    const neg = Number.isFinite(n) && n < 0;
    const msAbs = Number.isFinite(n) ? Math.abs(n) : 0;
    const sign = neg ? '-' : '';

    const md = (typeof minDigits === 'number' && Number.isFinite(minDigits) && minDigits > 0)
      ? Math.floor(minDigits)
      : 0;
    const padSigned = (v) => {
      const s = String(Math.trunc(v));
      if (md <= 0) return `${sign}${s}`;
      return `${sign}${s.padStart(md, '0')}`;
    };

    const days = Math.floor(msAbs / 86400000);
    const hoursTotal = Math.floor(msAbs / 3600000);
    const minutesTotal = Math.floor(msAbs / 60000);
    const secondsTotal = Math.floor(msAbs / 1000);

    const hh = hoursTotal % 24;
    const mi = minutesTotal % 60;
    const ss = secondsTotal % 60;
    const ms = Math.floor(msAbs % 1000);

    switch (token) {
      case 'DDD': return padSigned(days);
      case 'DD': return `${sign}${(days < 100 ? pad2(days) : String(days))}`;
      case 'HHH': return padSigned(hoursTotal);
      case 'HH': return pad2(hh);
      case 'mmm': return padSigned(minutesTotal);
      case 'mm': return pad2(mi);
      case 'sss': return padSigned(secondsTotal);
      case 'ss': return pad2(ss);
      case 'S': return String(Math.floor(ms / 100));
      case 'SS': return pad2(Math.floor(ms / 10));
      case 'SSS': return pad3(ms);

      // Non-diff tokens: keep stable width but show neutral values.
      case 'YYYY': return '0000';
      case 'YY': return '00';
      case 'MM': return '00';
      case 'HH12': return pad2(((hh % 12) || 12));
      case 'ampm': return '--';
      case 'ampm_jp': return '--';
      case 'ddd': return '---';
      case 'ddd_jp': return '-';
      default: return '';
    }
  }

  function buildClockPanels(format, date, diffMs, minDigits = 0) {
    const parts = tokenizeClockFormat(format);
    const tokens = [];
    const isMsPanel = [];

    const isDiff = diffMs != null;

    for (const p of parts) {
      if (p.type === 'lit') {
        const g = splitGraphemes(String(p.value ?? ''));
        for (const ch of g) {
          tokens.push(String(ch ?? ''));
          isMsPanel.push(false);
        }
        continue;
      }

      const v = isDiff
        ? clockDiffTokenValue(p.value, diffMs, minDigits)
        : clockTokenValue(p.value, date);
      const g = splitGraphemes(String(v ?? ''));
      const msFlag = (p.value === 'S' || p.value === 'SS' || p.value === 'SSS');
      for (const ch of g) {
        tokens.push(String(ch ?? ''));
        isMsPanel.push(msFlag);
      }
    }

    return { tokens, isMsPanel };
  }

  function clockProbeTextFromFormat(format, minDigits = 0) {
    // A stable max-ish string to drive geometry/cache without recomputing every tick.
    // (digits -> '8', day tokens -> widest-ish, jp tokens -> real strings)
    const md = (typeof minDigits === 'number' && Number.isFinite(minDigits) && minDigits > 0)
      ? Math.floor(minDigits)
      : 0;
    const flex = (fallback) => '8'.repeat(Math.max(fallback, md));

    const parts = tokenizeClockFormat(format);
    const out = [];
    for (const p of parts) {
      if (p.type === 'lit') {
        out.push(String(p.value ?? ''));
        continue;
      }
      switch (p.value) {
        case 'DDD': out.push(flex(4)); break;
        case 'HHH': out.push(flex(4)); break;
        case 'mmm': out.push(flex(4)); break;
        case 'sss': out.push(flex(4)); break;
        case 'YYYY': out.push('8888'); break;
        case 'YY': out.push('88'); break;
        case 'MM': out.push('88'); break;
        case 'DD': out.push('88'); break;
        case 'HH': out.push('88'); break;
        case 'HH12': out.push('88'); break;
        case 'mm': out.push('88'); break;
        case 'ss': out.push('88'); break;
        case 'S': out.push('8'); break;
        case 'SS': out.push('88'); break;
        case 'SSS': out.push('888'); break;
        case 'ddd': out.push('WWW'); break;
        case 'ddd_jp': out.push('水'); break;
        case 'ampm': out.push('PM'); break;
        case 'ampm_jp': out.push('午後'); break;
        default: out.push(''); break;
      }
    }
    return out.join('');
  }

  function applyPanelTokensToPart(opts) {
    const {
      part,
      tokens,
      isMsPanel,
      atomic,
      durationNormal,
      durationMsFixed,
      nowTs,
      allowRebuild = false,
      onLayoutDirty = null,
    } = opts;

    const tokensToApply = atomic ? [tokens.join('')] : tokens;
    const flagsToApply = atomic ? [isMsPanel.some(Boolean)] : isMsPanel;

    if (!atomic && tokensToApply.length > (part.maxLen || 0)) {
      part.maxLen = tokensToApply.length;
      if (typeof onLayoutDirty === 'function') onLayoutDirty();
    }

    if (allowRebuild && part.flippers.length !== tokensToApply.length) {
      part.flippers.length = 0;
      for (let i = 0; i < tokensToApply.length; i++) part.flippers.push(new Flipper(''));
      if (typeof onLayoutDirty === 'function') onLayoutDirty();
    }

    for (let i = 0; i < part.flippers.length; i++) {
      const dur = flagsToApply[i] ? durationMsFixed : durationNormal;
      part.flippers[i].transitionTo(tokensToApply[i] ?? '', nowTs, dur);
    }
  }

  function buildSinglePartSequence(mode, probe, tokens, atomic) {
    const initialTokens = atomic ? [tokens.join('')] : tokens;
    const count = Math.max(1, initialTokens.length);
    const flippers = [];
    for (let i = 0; i < count; i++) flippers.push(new Flipper(''));

    const part = {
      items: [probe],
      maxLen: atomic ? 1 : count,
      flippers,
      currentText: probe,
      lastIndex: 0,
    };

    for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initialTokens[i] ?? '');

    const sequence = {
      mode,
      layout: 'row',
      repeat: true,
      steps: 1,
      stepIndex: 0,
      shuffleEndAt: null,
      parts: [part],
    };
    return { sequence, part };
  }

  class PatapataClockElement extends PatapataTextElement {
    static get observedAttributes() {
      // Keep parity with patapata-text where it matters; add 'format'.
      return CLOCK_OBSERVED_ATTRS;
    }

    connectedCallback() {
      super.connectedCallback();
      if (this.isConnected) this.start();
    }

    attributeChangedCallback(name) {
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
      this._render();
    }

    _readConfig() {
      const duration = pick(attrNumber(this, 'duration'), JS_DEFAULTS.duration);
      const format = pick(attrString(this, 'format'), 'HH:mm:ss');
      const diff = pick(attrString(this, 'diff'), '');

      const minDigits = readMinDigits(this);

      const { halfHead, halfTail } = readHalfHeadTail(this);

      const value = clockProbeTextFromFormat(format, minDigits);
      const visual = this._readVisualConfig('line');
      const light = this.hasAttribute('light');

      const easing = readEasing(this, 'linear');

      return { visual, duration, value, light, easing, format, diff, minDigits, halfHead, halfTail };
    }

    _ensureSequence() {
      const cfg = this._readConfig();

      const format = String(cfg.format ?? '');
      const diffRaw = String(cfg.diff ?? '').trim();
      const diffEnabled = !!diffRaw;
      const diffTargetMs = diffEnabled ? (parseDiffTargetMs(diffRaw) ?? Date.now()) : null;
      const probe = String(cfg.value ?? '');
      const atomic = !!(cfg.visual && cfg.visual.atomic);

      const now = performance.now();
      const date = new Date();
      const initialDiffMs = (diffTargetMs != null) ? (diffTargetMs - date.getTime()) : null;
      const panels = buildClockPanels(format, date, initialDiffMs, cfg.minDigits || 0);
      const { sequence, part } = buildSinglePartSequence('clock', probe, panels.tokens, atomic);
      this._sequence = sequence;
      this._layoutDirty = true;

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

        // Tick loop runs at ~60fps; avoid recomputing CSS-derived config each time.
        this._render(nowTs, true);
        this._ensureRaf();
        this._timer = setTimeout(stepClockOnce, TICK_INTERVAL_MS);
      };

      this._render(now);
      this._timer = setTimeout(stepClockOnce, TICK_INTERVAL_MS);
    }
  }


  const TIMER_TOKENS = [
    'SSS',
    'HHH',
    'mmm',
    'sss',
    'SS',
    'mm',
    'ss',
    'S',
  ];

  function tokenizeTimerFormat(fmt) {
    const s = String(fmt ?? '');
    const out = [];
    for (let i = 0; i < s.length;) {
      let matched = null;
      for (const t of TIMER_TOKENS) {
        if (s.startsWith(t, i)) {
          matched = t;
          break;
        }
      }
      if (matched) {
        out.push({ type: 'token', value: matched });
        i += matched.length;
      } else {
        const ch = splitGraphemes(s.slice(i))[0] ?? s[i];
        out.push({ type: 'lit', value: ch });
        i += ch.length;
      }
    }
    return out;
  }

  function timerTokenValue(token, msTotal, minDigits = 0) {
    const msAbs = clampNonNegativeMs(msTotal);
    const hoursTotal = Math.floor(msAbs / 3600000);
    const minutesTotal = Math.floor(msAbs / 60000);
    const secondsTotal = Math.floor(msAbs / 1000);

    const md = (typeof minDigits === 'number' && Number.isFinite(minDigits) && minDigits > 0)
      ? Math.floor(minDigits)
      : 0;
    const padFlex = (v) => {
      const s = String(Math.trunc(v));
      if (md <= 0) return s;
      return s.padStart(md, '0');
    };

    const mm = minutesTotal % 60;
    const ss = secondsTotal % 60;
    const ms = Math.floor(msAbs % 1000);

    switch (token) {
      case 'HHH': return padFlex(hoursTotal);
      case 'mmm': return padFlex(minutesTotal);
      case 'sss': return padFlex(secondsTotal);
      case 'mm': return pad2(mm);
      case 'ss': return pad2(ss);
      case 'S': return String(Math.floor(ms / 100));
      case 'SS': return pad2(Math.floor(ms / 10));
      case 'SSS': return pad3(ms);
      default: return '';
    }
  }

  function buildTimerPanels(format, msTotal, minDigits = 0) {
    const parts = tokenizeTimerFormat(format);
    const tokens = [];
    const isMsPanel = [];

    for (const p of parts) {
      if (p.type === 'lit') {
        const g = splitGraphemes(String(p.value ?? ''));
        for (const ch of g) {
          tokens.push(String(ch ?? ''));
          isMsPanel.push(false);
        }
        continue;
      }

      const v = timerTokenValue(p.value, msTotal, minDigits);
      const g = splitGraphemes(String(v ?? ''));
      const msFlag = (p.value === 'S' || p.value === 'SS' || p.value === 'SSS');
      for (const ch of g) {
        tokens.push(String(ch ?? ''));
        isMsPanel.push(msFlag);
      }
    }

    return { tokens, isMsPanel };
  }

  function timerProbeTextFromFormat(format, minDigits = 0) {
    // Drive stable-ish geometry/cache.
    const md = (typeof minDigits === 'number' && Number.isFinite(minDigits) && minDigits > 0)
      ? Math.floor(minDigits)
      : 0;
    const flex = (fallback) => '8'.repeat(Math.max(fallback, md));

    const parts = tokenizeTimerFormat(format);
    const out = [];
    for (const p of parts) {
      if (p.type === 'lit') {
        out.push(String(p.value ?? ''));
        continue;
      }
      switch (p.value) {
        case 'HHH': out.push(flex(4)); break;
        case 'mmm': out.push(flex(4)); break;
        case 'sss': out.push(flex(4)); break;
        case 'mm': out.push('88'); break;
        case 'ss': out.push('88'); break;
        case 'S': out.push('8'); break;
        case 'SS': out.push('88'); break;
        case 'SSS': out.push('888'); break;
        default: out.push(''); break;
      }
    }
    return out.join('');
  }

  class PatapataTimerElement extends PatapataTextElement {
    static get observedAttributes() {
      return TIMER_OBSERVED_ATTRS;
    }

    constructor() {
      super();
      this._timerRunning = false;
      this._timerBaseElapsedMs = 0;
      this._timerStartedAt = 0;
    }

    _refreshSequence() {
      this._markLayoutVisual();
      this._ensureSequence();
      this._render(performance.now());
      this._ensureRaf();
    }

    connectedCallback() {
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

    disconnectedCallback() {
      this._teardownResizeAndVisibility();
      this._clearClickHandler();

      this.stop();
      this._rafScheduled = false;
      this._sequence = null;
    }

    attributeChangedCallback(name) {
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

    _readConfig() {
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

      return { visual, duration, value, light, easing, format, sec, minDigits, halfHead, halfTail };
    }

    _timerConfig() {
      const cfg = (this._cfg && !this._visualDirty) ? this._cfg : this._readConfig();
      this._cfg = cfg;
      const countdownStartMs = (cfg.sec != null) ? clampNonNegativeMs(cfg.sec * 1000) : null;
      return { cfg, countdownStartMs };
    }

    _nowElapsedMs(nowTs) {
      const base = clampNonNegativeMs(this._timerBaseElapsedMs);
      if (!this._timerRunning) return base;
      const dt = (typeof nowTs === 'number' && Number.isFinite(nowTs)) ? (nowTs - this._timerStartedAt) : 0;
      return clampNonNegativeMs(base + dt);
    }

    _displayMs(nowTs) {
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

    start() {
      if (this._timerRunning) return;
      this._ensureSequence();

      this._timerRunning = true;
      this._timerStartedAt = performance.now();
      this._tickOnce();
    }

    stop() {
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

    _ensureSequence() {
      const { cfg } = this._timerConfig();
      const format = String(cfg.format ?? '');
      const atomic = !!(cfg.visual && cfg.visual.atomic);
      const probe = String(cfg.value ?? '');

      const now = performance.now();
      const panels = buildTimerPanels(format, this._displayMs(now), cfg.minDigits || 0);
      const { sequence } = buildSinglePartSequence('timer', probe, panels.tokens, atomic);
      this._sequence = sequence;
      this._layoutDirty = true;
    }

    _applyDisplay(nowTs, allowRebuild = false) {
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
      // Tick loop runs at ~60fps; avoid recomputing CSS-derived config each time.
      this._render(nowTs, true);
      this._ensureRaf();

      if (this._timerRunning) {
        this._timer = setTimeout(() => this._tickOnce(), TICK_INTERVAL_MS);
      }
    }
  }

  class PatapataControlElement extends HTMLElement {
    static get observedAttributes() {
      return ['for', 'action', 'start', 'stop', 'reset', 'toggle', 'disabled'];
    }

    constructor() {
      super();
      this._onClick = null;
      this._onKeyDown = null;
    }

    connectedCallback() {
      if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
      if (!this.hasAttribute('tabindex')) this.tabIndex = 0;

      this._onClick = (e) => {
        if (this.hasAttribute('disabled')) return;
        e.preventDefault();
        this._performAction();
      };
      this.addEventListener('click', this._onClick);

      this._onKeyDown = (e) => {
        if (this.hasAttribute('disabled')) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        this._performAction();
      };
      this.addEventListener('keydown', this._onKeyDown);
    }

    disconnectedCallback() {
      if (this._onClick) this.removeEventListener('click', this._onClick);
      if (this._onKeyDown) this.removeEventListener('keydown', this._onKeyDown);
      this._onClick = null;
      this._onKeyDown = null;
    }

    _resolveAction() {
      if (this.hasAttribute('start')) return 'start';
      if (this.hasAttribute('stop')) return 'stop';
      if (this.hasAttribute('reset')) return 'reset';
      if (this.hasAttribute('toggle')) return 'toggle';
      const a = attrString(this, 'action');
      if (a) return a;
      return 'toggle';
    }

    _resolveTarget() {
      const id = attrString(this, 'for');
      if (!id) return null;
      return document.getElementById(id);
    }

    _performAction() {
      const target = this._resolveTarget();
      const action = this._resolveAction();
      if (!target) return;
      const fn = target[action];
      if (typeof fn === 'function') fn.call(target);
    }
  }


  if (!customElements.get('patapata-text')) {
    customElements.define('patapata-text', PatapataTextElement);
  }

  if (!customElements.get('patapata-clock')) {
    customElements.define('patapata-clock', PatapataClockElement);
  }

  if (!customElements.get('patapata-timer')) {
    customElements.define('patapata-timer', PatapataTimerElement);
  }

  if (!customElements.get('patapata-control')) {
    customElements.define('patapata-control', PatapataControlElement);
  }
})();
