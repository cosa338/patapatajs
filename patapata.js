/*!
 * patapata.js v0.1.2
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 https://github.com/cosa338
 */
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/core/utils.ts
  function attrString(el, name) {
    const raw = el.getAttribute(name);
    return raw == null ? null : String(raw);
  }
  function attrNumber(el, name) {
    const raw = el.getAttribute(name);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function attrBool(el, name, defaultValue) {
    if (!el.hasAttribute(name)) return defaultValue;
    const raw = el.getAttribute(name);
    if (raw == null || raw === "") return true;
    const v = String(raw).toLowerCase().trim();
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    return true;
  }
  function cssVar(el, name) {
    const v = getComputedStyle(el).getPropertyValue(name);
    const trimmed = v == null ? "" : String(v).trim();
    return trimmed || null;
  }
  function pick(...vals) {
    for (const v of vals) {
      if (v != null) return v;
    }
    return null;
  }
  function readHalfHeadTail(el) {
    const halfHeadRaw = attrNumber(el, "half-head");
    const halfTailRaw = attrNumber(el, "half-tail");
    const halfHead = typeof halfHeadRaw === "number" && Number.isFinite(halfHeadRaw) && halfHeadRaw > 0 ? Math.floor(halfHeadRaw) : 0;
    const halfTail = typeof halfTailRaw === "number" && Number.isFinite(halfTailRaw) && halfTailRaw > 0 ? Math.floor(halfTailRaw) : 0;
    return { halfHead, halfTail };
  }
  function readMinDigits(el) {
    const raw = attrNumber(el, "min-digits");
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
    return 0;
  }
  function normalizeEasingName(raw) {
    const s = String(raw || "").trim().toLowerCase();
    if (s === "linear") return "linear";
    if (s === "ease" || s === "ease-in" || s === "easein") return "ease";
    if (s === "bounce" || s === "ease-bounce" || s === "easebounce") return "bounce";
    return null;
  }
  function readEasing(el, fallback = "linear") {
    return pick(
      normalizeEasingName(attrString(el, "easing")),
      normalizeEasingName(cssVar(el, "--patapata-easing")),
      fallback
    );
  }
  var graphemeSegmenter;
  function splitGraphemes(str) {
    if (graphemeSegmenter === void 0) {
      try {
        graphemeSegmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
      } catch (_) {
        graphemeSegmenter = null;
      }
    }
    if (graphemeSegmenter) {
      try {
        return Array.from(graphemeSegmenter.segment(str), (s) => s.segment);
      } catch (_) {
      }
    }
    return Array.from(str);
  }
  function parseJsonLoose(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const c0 = s[0];
    if (c0 !== "[" && c0 !== "{") return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  function normalizePartsFromValue(valueRaw) {
    const parsed = parseJsonLoose(valueRaw);
    if (parsed == null) {
      return [[String(valueRaw ?? "")]];
    }
    const toStringArray = (arr) => Array.isArray(arr) ? arr.map((v) => String(v ?? "")) : null;
    let rawItems = null;
    if (Array.isArray(parsed)) {
      rawItems = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      rawItems = parsed.items;
    } else {
      return [[String(valueRaw ?? "")]];
    }
    if (!rawItems.length) return [[""]];
    const looksMulti = Array.isArray(rawItems[0]) || rawItems[0] && typeof rawItems[0] === "object" && Array.isArray(rawItems[0].items);
    const normalized = looksMulti ? rawItems : [rawItems];
    const parts = [];
    for (const p of normalized) {
      const arr = Array.isArray(p) ? p : p && typeof p === "object" ? p.items : null;
      const sarr = toStringArray(arr);
      if (sarr && sarr.length) parts.push(sarr);
      else if (sarr) parts.push([]);
    }
    return parts.length ? parts : [[""]];
  }

  // src/render/runtime.ts
  var JS_DEFAULTS = {
    interval: 800,
    duration: 1e3,
    value: "",
    atomic: false,
    randMin: 5,
    randMax: 10
  };
  var TICK_INTERVAL_MS = 16;
  var HIDDEN_TICK_INTERVAL_MS = 1e3;
  var MS_PANEL_DURATION_MS = 400;
  var VISUAL_ONLY_ATTRS = /* @__PURE__ */ new Set(["light", "easing"]);
  var TEXT_OBSERVED_ATTRS = [
    "interval",
    "duration",
    "shuffle-time",
    "value",
    "rand",
    "rand-min",
    "rand-max",
    "atomic",
    "stack",
    "align-width",
    "half-head",
    "half-tail",
    "easing",
    "light",
    "repeat",
    "click",
    "autostart"
  ];
  var TEXT_RESTART_ATTRS = /* @__PURE__ */ new Set([
    "value",
    "interval",
    "duration",
    "shuffle-time",
    "rand",
    "rand-min",
    "rand-max",
    "repeat",
    "atomic",
    "stack",
    "align-width",
    "half-head",
    "half-tail"
  ]);
  var CLOCK_OBSERVED_ATTRS = [
    "format",
    "diff",
    "min-digits",
    "duration",
    "atomic",
    "half-head",
    "half-tail",
    "light",
    "easing",
    "autostart",
    "click"
  ];
  var CLOCK_RESTART_ATTRS = /* @__PURE__ */ new Set([
    "format",
    "diff",
    "min-digits",
    "duration",
    "atomic",
    "half-head",
    "half-tail"
  ]);
  var TIMER_OBSERVED_ATTRS = [
    "format",
    "sec",
    "min-digits",
    "duration",
    "atomic",
    "half-head",
    "half-tail",
    "light",
    "easing",
    "autostart",
    "click",
    "interval"
  ];
  var TIMER_REFRESH_ATTRS = /* @__PURE__ */ new Set([
    "format",
    "sec",
    "min-digits",
    "duration",
    "atomic",
    "half-head",
    "half-tail",
    "interval"
  ]);
  var RUNTIME = {
    supportsIO: typeof IntersectionObserver !== "undefined",
    raf: {
      rafId: null,
      queue: /* @__PURE__ */ new Set()
    },
    vis: {
      io: null,
      elements: /* @__PURE__ */ new Set(),
      docListenerInstalled: false
    },
    canvasBgCacheLimit: 64,
    cardBgCache: /* @__PURE__ */ new Map(),
    halfBgCache: /* @__PURE__ */ new Map()
  };
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
      if (typeof el._onGlobalRafFrame !== "function") continue;
      const keep = el._onGlobalRafFrame(now);
      if (keep) globalRafRequest(el);
    }
  }
  function ensureGlobalVisibility() {
    if (!RUNTIME.vis.docListenerInstalled) {
      RUNTIME.vis.docListenerInstalled = true;
      document.addEventListener("visibilitychange", () => {
        for (const el of RUNTIME.vis.elements) {
          if (typeof el._onGlobalVisibilityChange === "function") el._onGlobalVisibilityChange();
        }
      });
    }
    if (!RUNTIME.supportsIO) return;
    if (RUNTIME.vis.io) return;
    RUNTIME.vis.io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          if (el && typeof el._setIntersecting === "function") {
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
      } catch (_) {
      }
    }
  }
  function unregisterVisibility(el) {
    RUNTIME.vis.elements.delete(el);
    if (RUNTIME.supportsIO && RUNTIME.vis.io) {
      try {
        RUNTIME.vis.io.unobserve(el);
      } catch (_) {
      }
    }
  }

  // src/render/canvas-base.ts
  function readCssColor(el, name) {
    const v = cssVar(el, name);
    return v ? String(v) : null;
  }
  var HOST_DEFAULT_STYLE_TEXT = `
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
  var MEASURE_ELEMENT_STYLE_TEXT = [
    "position: absolute",
    "left: -99999px",
    "top: -99999px",
    "width: 0",
    "height: 0",
    "overflow: hidden",
    "visibility: hidden",
    "pointer-events: none"
  ].join(";");
  var PatapataCanvasBaseElement = class extends HTMLElement {
    constructor() {
      super();
      __publicField(this, "_shadow");
      __publicField(this, "_canvas");
      __publicField(this, "_ctx");
      __publicField(this, "_measure");
      this._shadow = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = HOST_DEFAULT_STYLE_TEXT;
      this._canvas = document.createElement("canvas");
      this._ctx = this._canvas.getContext("2d");
      this._measure = document.createElement("div");
      this._measure.style.cssText = MEASURE_ELEMENT_STYLE_TEXT;
      this._shadow.appendChild(style);
      this._shadow.appendChild(this._canvas);
      this._shadow.appendChild(this._measure);
    }
    _resolveCssPx(varName, fallbackPx, cssProperty) {
      const fb = Number.isFinite(fallbackPx) ? fallbackPx : 0;
      const prop = cssProperty || "width";
      this._measure.style[prop] = `var(${varName}, ${fb}px)`;
      const raw = getComputedStyle(this._measure)[prop];
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : fb;
    }
    _resolveLengthPx(varName, fallbackPx) {
      return this._resolveCssPx(varName, fallbackPx, "width");
    }
    _resolveSignedLengthPx(varName, fallbackPx) {
      return this._resolveCssPx(varName, fallbackPx, "marginLeft");
    }
    _resolveFontSizePx(varName, fallbackPx) {
      return this._resolveCssPx(varName, fallbackPx, "fontSize");
    }
    _resolveNumber(varName, fallback) {
      const raw = cssVar(this, varName);
      if (!raw) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) ? n : fallback;
    }
    _readVisualConfigBase(dividerModeFallback) {
      const cardWidth = this._resolveLengthPx("--patapata-card-width", 80);
      const cardHeight = this._resolveLengthPx("--patapata-card-height", Math.max(1, cardWidth * 1.1));
      const radius = this._resolveLengthPx("--patapata-card-radius", 6.4);
      const gap = this._resolveLengthPx("--patapata-display-gap", 4.8);
      const panelTop = pick(cssVar(this, "--patapata-panel-top"), cssVar(this, "--patapata-panel-color"), "#333");
      const panelBottom = pick(cssVar(this, "--patapata-panel-bottom"), cssVar(this, "--patapata-panel-color"), "#333");
      const divider = pick(cssVar(this, "--patapata-divider"), "rgba(0, 0, 0, 0.6)");
      const dividerSizePx = this._resolveLengthPx("--patapata-divider-size", 2);
      const dividerMode = pick(cssVar(this, "--patapata-divider-mode"), dividerModeFallback);
      const textColor = pick(cssVar(this, "--patapata-text-color"), "#ddd");
      const fontFamily = pick(
        cssVar(this, "--patapata-font-family"),
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      );
      const fontWeight = this._resolveNumber("--patapata-font-weight", 700);
      const fontSizePx = this._resolveFontSizePx("--patapata-card-font-size", Math.max(12, cardWidth * 0.9));
      const edgeSizePx = this._resolveLengthPx("--patapata-edge-size", Math.max(1, cardWidth * 0.03));
      const edgeColor = pick(readCssColor(this, "--patapata-edge-color"), "rgba(255, 255, 255, 0.12)");
      const insetShadeStrength = this._resolveNumber("--patapata-inset-shade-strength", 1);
      const flipOverhang = this._resolveNumber("--patapata-flip-overhang", 0.03);
      const flipShadow = this._resolveNumber("--patapata-flip-shadow", 0.2);
      const atomic = attrBool(this, "atomic", JS_DEFAULTS.atomic);
      const textAlign = pick(cssVar(this, "--patapata-text-align"), "center");
      const textValign = pick(cssVar(this, "--patapata-text-valign"), "middle");
      const textOffsetXPx = this._resolveSignedLengthPx("--patapata-text-offset-x", 0);
      const textOffsetYPx = this._resolveSignedLengthPx("--patapata-text-offset-y", 0);
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
          edge: edgeColor
        },
        divider: {
          sizePx: dividerSizePx,
          mode: dividerMode
        },
        font: {
          family: fontFamily,
          weight: fontWeight,
          sizePx: fontSizePx
        },
        edge: {
          sizePx: edgeSizePx,
          insetShadeStrength: Math.max(0, insetShadeStrength)
        },
        flip: {
          overhang: Math.max(0, Math.min(0.5, flipOverhang)),
          shadow: Math.max(0, Math.min(1, flipShadow))
        },
        text: {
          align: (textAlign || "center").toLowerCase(),
          valign: (textValign || "middle").toLowerCase(),
          offsetXPx: textOffsetXPx,
          offsetYPx: textOffsetYPx
        }
      };
    }
  };

  // src/render/flipper.ts
  var MAX_STACKED_ANIMATIONS = 64;
  var FlipAnimation = class {
    constructor(from, to, startTime, durationMs = null) {
      __publicField(this, "from");
      __publicField(this, "to");
      __publicField(this, "startTime");
      __publicField(this, "durationMs");
      this.from = from;
      this.to = to;
      this.startTime = startTime;
      this.durationMs = typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
    }
  };
  var Flipper = class {
    constructor(startValue) {
      __publicField(this, "baseValue");
      __publicField(this, "animations");
      this.baseValue = String(startValue ?? "");
      this.animations = [];
    }
    setValue(v) {
      this.baseValue = String(v ?? "");
      this.animations.length = 0;
    }
    transitionTo(next, now, durationMs = null) {
      const to = String(next ?? "");
      if (to === this.baseValue) return;
      if (this.animations.length > 0) {
        let write = 0;
        for (let i = 0; i < this.animations.length; i++) {
          const anim2 = this.animations[i];
          if (anim2.durationMs != null && now - anim2.startTime >= anim2.durationMs) continue;
          this.animations[write] = anim2;
          write++;
        }
        this.animations.length = write;
        if (this.animations.length >= MAX_STACKED_ANIMATIONS) {
          this.animations.length = MAX_STACKED_ANIMATIONS - 1;
        }
      }
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
  };

  // src/elements/shared.ts
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
      onLayoutDirty = null
    } = opts;
    const rawTokensToApply = atomic ? [tokens.join("")] : tokens;
    const tokensToApply = rawTokensToApply.length > 0 ? rawTokensToApply : [""];
    const flagsToApply = atomic ? [isMsPanel.some(Boolean)] : isMsPanel;
    if (!atomic && tokensToApply.length > (part.maxLen || 0)) {
      part.maxLen = tokensToApply.length;
      if (typeof onLayoutDirty === "function") onLayoutDirty();
    }
    if (allowRebuild && part.flippers.length !== tokensToApply.length) {
      part.flippers.length = 0;
      for (let i = 0; i < tokensToApply.length; i++) part.flippers.push(new Flipper(""));
      if (typeof onLayoutDirty === "function") onLayoutDirty();
    }
    for (let i = 0; i < part.flippers.length; i++) {
      const dur = flagsToApply[i] ? durationMsFixed : durationNormal;
      part.flippers[i].transitionTo(tokensToApply[i] ?? "", nowTs, dur);
    }
  }
  function buildSinglePartSequence(mode, probe, tokens, atomic) {
    const initialTokens = atomic ? [tokens.join("")] : tokens;
    const count = Math.max(1, initialTokens.length);
    const flippers = [];
    for (let i = 0; i < count; i++) flippers.push(new Flipper(""));
    const part = {
      items: [probe],
      maxLen: atomic ? 1 : count,
      flippers,
      currentText: probe,
      lastIndex: 0
    };
    for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initialTokens[i] ?? "");
    const sequence = {
      mode,
      layout: "row",
      repeat: true,
      steps: 1,
      stepIndex: 0,
      shuffleEndAt: null,
      parts: [part]
    };
    return { sequence, part };
  }

  // src/render/random-text.ts
  var HALF_SPACE_RANGE = [32, 32];
  var FULL_SPACE_RANGE = [12288, 12288];
  var HALF_DIGIT_RANGES = [[48, 57], HALF_SPACE_RANGE];
  var HALF_UPPER_RANGES = [[65, 90], HALF_SPACE_RANGE];
  var HALF_LOWER_RANGES = [[97, 122], HALF_SPACE_RANGE];
  var HALF_ALL_RANGES = [
    [48, 57],
    [65, 90],
    [97, 122],
    HALF_SPACE_RANGE
  ];
  var FULL_HIRA_RANGES = [[12353, 12438], FULL_SPACE_RANGE];
  var FULL_KATA_RANGES = [[12449, 12538], FULL_SPACE_RANGE];
  var FULL_DIGIT_RANGES = [[65296, 65305], FULL_SPACE_RANGE];
  var SIMPLE_KANJI = Array.from(
    "\u65E5\u6708\u706B\u6C34\u6728\u91D1\u571F\u5E74\u6642\u5206\u79D2\u4E0A\u4E0B\u5DE6\u53F3\u5927\u5C0F\u4E2D\u5165\u53E3\u51FA\u56DE\u6570\u5B57\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D\u5341\u767E\u5343\u4E07\u5186\u672C\u8A9E\u540D\u4EBA\u524D\u5F8C\u65B0\u53E4\u65E9\u9045\u9AD8\u5B89\u9577\u77ED\u5F37\u5F31\u7537\u5973\u5B50\u53CB\u611B\u5929\u6C17\u96E8\u96EA\u98A8\u6D77\u5C71\u5DDD\u7530\u68EE\u6797\u7A7A\u661F\u82B1\u8349\u72AC\u732B\u9CE5\u9B5A\u8ECA\u96FB\u99C5\u5E97\u4F1A\u793E\u5B66\u6821\u5148\u751F\u4F11\u795D\u4ECA\u6628\u660E\u66DC"
  ).filter(Boolean);
  var RANDOM_FULLWIDTH_FALLBACK = [
    ...SIMPLE_KANJI,
    "\u3000",
    ...["\u3042", "\u3044", "\u3046", "\u3048", "\u304A", "\u30AB", "\u30AD", "\u30AF", "\u30B1", "\u30B3", "\uFF10", "\uFF11", "\uFF12", "\uFF13", "\uFF14", "\uFF15", "\uFF16", "\uFF17", "\uFF18", "\uFF19"]
  ];
  var CJK_KANJI_WITH_SPACE = [...SIMPLE_KANJI, "\u3000"];
  var SRC_HALF_DIGIT = { type: "ranges", ranges: HALF_DIGIT_RANGES, blank: " " };
  var SRC_HALF_UPPER = { type: "ranges", ranges: HALF_UPPER_RANGES, blank: " " };
  var SRC_HALF_LOWER = { type: "ranges", ranges: HALF_LOWER_RANGES, blank: " " };
  var SRC_HALF_ALL = { type: "ranges", ranges: HALF_ALL_RANGES, blank: " " };
  var SRC_FULL_HIRA = { type: "ranges", ranges: FULL_HIRA_RANGES, blank: "\u3000" };
  var SRC_FULL_KATA = { type: "ranges", ranges: FULL_KATA_RANGES, blank: "\u3000" };
  var SRC_FULL_DIGIT = { type: "ranges", ranges: FULL_DIGIT_RANGES, blank: "\u3000" };
  var SRC_CJK = { type: "set", chars: CJK_KANJI_WITH_SPACE, blank: "\u3000" };
  var SRC_FULLWIDTH_FALLBACK = { type: "set", chars: RANDOM_FULLWIDTH_FALLBACK, blank: "\u3000" };
  var isCjkIdeograph = (cp) => cp >= 19968 && cp <= 40959;
  var isInRanges = (cp, ranges) => {
    for (const [a, b] of ranges) {
      if (cp >= a && cp <= b) {
        return true;
      }
    }
    return false;
  };
  var isHalfwidthAscii = (cp) => cp >= 32 && cp <= 126;
  var randomIntInclusive = (min, max) => {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    if (b < a) {
      return a;
    }
    return a + Math.floor(Math.random() * (b - a + 1));
  };
  var randomCharFromRanges = (ranges) => {
    if (!Array.isArray(ranges) || ranges.length === 0) {
      return "";
    }
    for (let attempts = 0; attempts < 3; attempts++) {
      const picked = ranges[Math.floor(Math.random() * ranges.length)];
      if (!Array.isArray(picked) || picked.length < 2) {
        continue;
      }
      const a0 = picked[0];
      const b0 = picked[1];
      if (typeof a0 !== "number" || typeof b0 !== "number") {
        continue;
      }
      if (!Number.isFinite(a0) || !Number.isFinite(b0)) {
        continue;
      }
      let a = Math.floor(a0);
      let b = Math.floor(b0);
      if (b < a) {
        [a, b] = [b, a];
      }
      a = Math.min(1114111, Math.max(0, a));
      b = Math.min(1114111, Math.max(0, b));
      if (b < a) {
        continue;
      }
      const cp = a + Math.floor(Math.random() * (b - a + 1));
      try {
        return String.fromCodePoint(cp);
      } catch {
      }
    }
    return "";
  };
  var RandomText = {
    pickSourceForChar: (ch) => {
      if (!ch) {
        return null;
      }
      const cp = ch.codePointAt(0);
      if (typeof cp !== "number") {
        return null;
      }
      if (cp >= 48 && cp <= 57) return SRC_HALF_DIGIT;
      if (cp >= 65 && cp <= 90) return SRC_HALF_UPPER;
      if (cp >= 97 && cp <= 122) return SRC_HALF_LOWER;
      if (isHalfwidthAscii(cp)) return SRC_HALF_ALL;
      if (isInRanges(cp, FULL_HIRA_RANGES)) return SRC_FULL_HIRA;
      if (isInRanges(cp, FULL_KATA_RANGES)) return SRC_FULL_KATA;
      if (isInRanges(cp, FULL_DIGIT_RANGES)) return SRC_FULL_DIGIT;
      if (isCjkIdeograph(cp)) return SRC_CJK;
      return SRC_FULLWIDTH_FALLBACK;
    },
    hasAnyFullwidth: (str) => {
      const s = String(str || "");
      for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (typeof cp !== "number") {
          continue;
        }
        if (!isHalfwidthAscii(cp)) {
          return true;
        }
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
      if (!source) {
        return "";
      }
      if (source.type === "ranges") return randomCharFromRanges(source.ranges);
      if (source.type === "set") {
        const arr = Array.isArray(source.chars) ? source.chars : [];
        if (!arr.length) {
          return "";
        }
        const v = arr[Math.floor(Math.random() * arr.length)];
        return typeof v === "string" && v ? v : "";
      }
      return "";
    },
    blankForSource: (source) => {
      return source ? source.blank : "";
    }
  };

  // src/elements/text-sequence-rand.ts
  function ensureRandSequence(opts) {
    const { host, atomic, interval, layout, repeat, value, applyPartText: applyPartText2 } = opts;
    const randEnabled = attrBool(host, "rand", false);
    if (!randEnabled) {
      return false;
    }
    const target = String(value ?? "");
    const minAttr = attrNumber(host, "rand-min");
    const maxAttr = attrNumber(host, "rand-max");
    const hasMin = typeof minAttr === "number" && Number.isFinite(minAttr) && minAttr >= 0;
    const hasMax = typeof maxAttr === "number" && Number.isFinite(maxAttr) && maxAttr >= 0;
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
    const sources = atomic ? [target ? RandomText.pickSourceForAtomicString(target) : null] : targetTokens.map((t) => RandomText.pickSourceForChar(t));
    const remaining = sources.map((s) => s ? randomIntInclusive(randMin, randMax) : 0);
    const initialText = atomic ? sources[0] ? RandomText.blankForSource(sources[0]) : target : targetTokens.map((t, idx) => sources[idx] ? RandomText.blankForSource(sources[idx]) : String(t ?? "")).join("");
    const flippers = [];
    for (let i = 0; i < count; i++) flippers.push(new Flipper(""));
    const part = {
      items: [target],
      maxLen: atomic ? 1 : count,
      flippers,
      currentText: initialText,
      lastIndex: 0
    };
    if (atomic) {
      part.flippers[0].setValue(initialText);
    } else {
      const initTokens = splitGraphemes(initialText);
      for (let i = 0; i < part.flippers.length; i++) part.flippers[i].setValue(initTokens[i] ?? "");
    }
    host._sequence = {
      mode: "rand",
      layout,
      repeat,
      steps: 1,
      stepIndex: 0,
      shuffleEndAt: null,
      parts: [part]
    };
    const stepRandOnce = () => {
      if (!host._sequence || !host._sequence.parts.length) return;
      const now = performance.now();
      if (!remaining.some((n) => n > 0)) {
        applyPartText2(part, atomic ? target : targetTokens.join(""), now, atomic);
        host._timer = null;
        host._render(now);
        host._ensureRaf();
        return;
      }
      let nextText;
      if (atomic) {
        const src = sources[0];
        if (src && remaining[0] > 0) {
          remaining[0] = Math.max(0, remaining[0] - 1);
          const len = splitGraphemes(target).length;
          nextText = Array.from({ length: len }, () => RandomText.randomCharFromSource(src)).join("");
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
        nextText = arr.join("");
      }
      applyPartText2(part, nextText, now, atomic);
      host._render(now);
      host._ensureRaf();
      host._timer = setTimeout(stepRandOnce, interval);
    };
    host._render(performance.now());
    host._timer = setTimeout(stepRandOnce, interval);
    return true;
  }

  // src/elements/text-sequence-steps.ts
  function ensureStepSequence(opts) {
    const { host, atomic, interval, layout, repeat, value, shuffleTimeMs, applyPartText: applyPartText2 } = opts;
    const partsItems = normalizePartsFromValue(value);
    const steps = Math.max(1, ...partsItems.map((arr) => Array.isArray(arr) ? arr.length : 0));
    if (steps <= 1) {
      return false;
    }
    const paddedParts = partsItems.map((arr) => {
      const out = [];
      for (let i = 0; i < steps; i++) out.push(arr[i] ?? "");
      return out;
    });
    const partsForMode = shuffleTimeMs > 0 ? partsItems : paddedParts;
    const alignWidth = host.hasAttribute("align-width");
    const globalMaxLen = !atomic && alignWidth ? Math.max(1, ...partsForMode.flat().map((s) => splitGraphemes(String(s ?? "")).length)) : null;
    const parts = partsForMode.map((items) => {
      let maxLen = 1;
      if (!atomic) {
        if (typeof globalMaxLen === "number") {
          maxLen = globalMaxLen;
        } else {
          for (const s of items) {
            const len = splitGraphemes(String(s ?? "")).length;
            if (len > maxLen) maxLen = len;
          }
        }
      }
      const initial = items[0] ?? "";
      const initialTokens = atomic ? [String(initial)] : (() => {
        const g = splitGraphemes(initial);
        const out = [];
        for (let i = 0; i < maxLen; i++) out.push(g[i] ?? "");
        return out;
      })();
      const flippers = [];
      for (let i = 0; i < initialTokens.length; i++) flippers.push(new Flipper(initialTokens[i] ?? ""));
      return { items, maxLen, flippers };
    });
    host._sequence = {
      mode: shuffleTimeMs > 0 ? "shuffle" : "sequence",
      layout,
      repeat,
      steps,
      stepIndex: 0,
      shuffleEndAt: shuffleTimeMs > 0 ? performance.now() + shuffleTimeMs : null,
      parts: parts.map((p) => ({
        ...p,
        currentText: String(p.items[0] ?? ""),
        lastIndex: 0
      }))
    };
    const stepSequenceOnce = () => {
      if (!host._sequence) return;
      const nextIndex = host._sequence.stepIndex + 1;
      if (!host._sequence.repeat && nextIndex >= host._sequence.steps) {
        host._sequence.stepIndex = host._sequence.steps - 1;
        host._timer = null;
        host._render(performance.now());
        return;
      }
      host._sequence.stepIndex = host._sequence.repeat ? nextIndex % host._sequence.steps : nextIndex;
      const now = performance.now();
      for (const p of host._sequence.parts) {
        const raw = p.items[host._sequence.stepIndex] ?? "";
        applyPartText2(p, raw, now, atomic);
      }
      host._render(now, true);
      host._ensureRaf();
      host._timer = setTimeout(stepSequenceOnce, interval);
    };
    const stepShuffleOnce = () => {
      if (!host._sequence) return;
      const now = performance.now();
      const endAt = host._sequence.shuffleEndAt;
      if (typeof endAt === "number" && Number.isFinite(endAt) && now >= endAt) {
        host._timer = null;
        host._render(now, true);
        return;
      }
      for (const p of host._sequence.parts) {
        const n = Array.isArray(p.items) ? p.items.length : 0;
        if (n <= 0) continue;
        let idx = Math.floor(Math.random() * n);
        if (n >= 2 && idx === p.lastIndex) idx = (idx + 1 + Math.floor(Math.random() * (n - 1))) % n;
        p.lastIndex = idx;
        const raw = p.items[idx] ?? "";
        applyPartText2(p, raw, now, atomic);
      }
      host._render(now, true);
      host._ensureRaf();
      host._timer = setTimeout(stepShuffleOnce, interval);
    };
    host._timer = setTimeout(shuffleTimeMs > 0 ? stepShuffleOnce : stepSequenceOnce, interval);
    return true;
  }

  // src/elements/text-sequence.ts
  function applyPartText(part, raw, now, atomic) {
    part.currentText = String(raw ?? "");
    const tokens = atomic ? [part.currentText] : (() => {
      const g = splitGraphemes(part.currentText);
      const out = [];
      for (let i = 0; i < part.maxLen; i++) out.push(g[i] ?? "");
      return out;
    })();
    while (part.flippers.length < tokens.length) part.flippers.push(new Flipper(""));
    if (part.flippers.length > tokens.length) part.flippers.length = tokens.length;
    for (let i = 0; i < part.flippers.length; i++) {
      part.flippers[i].transitionTo(tokens[i] ?? "", now);
    }
  }
  function ensureTextSequence(host) {
    const cfg = host._readConfig();
    const atomic = !!(cfg.visual && cfg.visual.atomic);
    const interval = Math.max(1, cfg.interval || JS_DEFAULTS.interval);
    const repeat = host.hasAttribute("repeat");
    const layout = host.hasAttribute("stack") ? "stack" : "row";
    const shuffleTimeAttr = attrNumber(host, "shuffle-time");
    const shuffleTimeMs = typeof shuffleTimeAttr === "number" && Number.isFinite(shuffleTimeAttr) && shuffleTimeAttr > 0 ? shuffleTimeAttr : 0;
    const parsed = parseJsonLoose(cfg.value);
    if (parsed == null) {
      const handled2 = ensureRandSequence({
        host,
        atomic,
        interval,
        layout,
        repeat,
        value: String(cfg.value ?? ""),
        applyPartText
      });
      if (!handled2) host._render(performance.now());
      return;
    }
    const handled = ensureStepSequence({
      host,
      atomic,
      interval,
      layout,
      repeat,
      value: String(cfg.value ?? ""),
      shuffleTimeMs,
      applyPartText
    });
    if (!handled) host._render(performance.now());
  }

  // src/render/draw.ts
  function cfgBgKey(cfg) {
    const v = cfg.visual;
    return [
      v.colors.panelTop,
      v.colors.panelBottom,
      v.radius,
      v.edge.insetShadeStrength,
      v.edge.sizePx,
      v.colors.edge
    ].join("|");
  }
  function touchLru(map, key, value) {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    if (map.size <= RUNTIME.canvasBgCacheLimit) return;
    const oldestKey = map.keys().next().value;
    if (oldestKey != null) {
      map.delete(oldestKey);
    }
  }
  function makeOffscreenCanvas(wPx, hPx) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(wPx));
    c.height = Math.max(1, Math.ceil(hPx));
    return c;
  }
  function getCardBackgroundCanvas(w, h, dpr, cfg) {
    const idpr = typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const key = `${idpr}|${Math.round(w * 1e3) / 1e3}|${Math.round(h * 1e3) / 1e3}|${cfgBgKey(cfg)}`;
    const hit = RUNTIME.cardBgCache.get(key);
    if (hit) {
      touchLru(RUNTIME.cardBgCache, key, hit);
      return hit;
    }
    const canvas = makeOffscreenCanvas(w * idpr, h * idpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(idpr, 0, 0, idpr, 0, 0);
    drawCard(ctx, 0, 0, w, h, cfg);
    touchLru(RUNTIME.cardBgCache, key, canvas);
    return canvas;
  }
  function getHalfBackgroundCanvas(w, h, dpr, cfg, half) {
    const idpr = typeof dpr === "number" && Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    const key = `${idpr}|${Math.round(w * 1e3) / 1e3}|${Math.round(h * 1e3) / 1e3}|${half}|${cfgBgKey(cfg)}`;
    const hit = RUNTIME.halfBgCache.get(key);
    if (hit) {
      touchLru(RUNTIME.halfBgCache, key, hit);
      return hit;
    }
    const canvas = makeOffscreenCanvas(w * idpr, h * idpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(idpr, 0, 0, idpr, 0, 0);
    drawHalfCardBackground(ctx, 0, 0, w, h, cfg, half);
    touchLru(RUNTIME.halfBgCache, key, canvas);
    return canvas;
  }
  function calcAtomicCardWidthPx(ctx, text, v) {
    const safeText = String(text || "");
    const metrics = ctx.measureText(safeText || "H");
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
    const v = cfg.visual;
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
    const v = cfg.visual;
    const dividerSize = Math.max(0, v.divider.sizePx);
    if (dividerSize <= 0) return;
    const cy = y + h / 2;
    const top = cy - dividerSize / 2;
    const mode = (v.divider.mode || "line").toLowerCase();
    if (mode === "gap" || mode === "cutout") {
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
    const e = normalizeEasingName(easing) || "linear";
    if (e === "ease" || e === "bounce") {
      return tt * tt;
    }
    return tt;
  }
  function easeOutFlipProgress01(t, easing) {
    const tt = clamp01(t);
    const e = normalizeEasingName(easing) || "linear";
    if (e === "ease" || e === "bounce") {
      const inv = 1 - tt;
      return 1 - inv * inv;
    }
    return tt;
  }
  function applyBounceToScaleY(scaleY, easedT) {
    const t = clamp01(easedT);
    if (t <= 0.72) return scaleY;
    const u = (t - 0.72) / 0.28;
    const amp = 0.18;
    const decay = 1 - u;
    const osc = Math.sin(u * Math.PI * 2.2);
    const k = 1 + amp * osc * decay * decay;
    return Math.max(0, scaleY * k);
  }
  function drawInsetShading(ctx, x, y, w, h, cfg) {
    const v = cfg.visual;
    const strength = Number.isFinite(v.edge.insetShadeStrength) ? v.edge.insetShadeStrength : 0;
    if (strength <= 0) return;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(255, 255, 255, ${0.12 * strength})`);
    g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, `rgba(0, 0, 0, ${0.22 * strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  function strokeCardEdge(ctx, x, y, w, h, cfg) {
    const v = cfg.visual;
    const edge = Math.max(0, v.edge.sizePx || 0);
    const color = v.colors.edge;
    if (edge <= 0 || !color) return;
    ctx.save();
    ctx.lineWidth = edge * 2;
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    roundRectPath(ctx, x, y, w, h, v.radius);
    ctx.stroke();
    ctx.restore();
  }
  function drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta) {
    const v = cfg.visual;
    const edge = Math.max(0, v.edge.sizePx || 0);
    if (edge <= 0) return;
    const t = clamp01(Math.sin(theta));
    const thickness = edge * 1.4 * t;
    if (thickness <= 0.1) return;
    const cy = y + h / 2;
    const g = ctx.createLinearGradient(0, 0, 0, thickness);
    g.addColorStop(0, `rgba(0, 0, 0, ${0.35 * t})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.save();
    roundRectPath(ctx, x, y, w, h, v.radius);
    ctx.clip();
    ctx.fillStyle = g;
    if (half === "top") {
      ctx.translate(0, cy - thickness);
      ctx.fillRect(x, 0, w, thickness);
    } else {
      ctx.translate(0, cy);
      ctx.fillRect(x, 0, w, thickness);
    }
    ctx.restore();
  }
  function drawFlapTrapezoid(ctx, x, y, w, h, cfg, half, theta, cx) {
    const v = cfg.visual;
    const dpr = window.devicePixelRatio || 1;
    const src = getHalfBackgroundCanvas(w, h, dpr, cfg, half);
    const halfH = h / 2;
    const sliceCount = Math.max(14, Math.min(64, Math.round(halfH / 3)));
    const srcWpx = src.width;
    const srcHpxTotal = src.height;
    const midYpx = Math.round(srcHpxTotal / 2);
    const baseYpx0 = half === "top" ? 0 : midYpx;
    const baseYpx1 = half === "top" ? midYpx : srcHpxTotal;
    const halfHpx = Math.max(1, baseYpx1 - baseYpx0);
    const overhang = typeof v.flip.overhang === "number" && Number.isFinite(v.flip.overhang) ? Math.max(0, Math.min(0.5, v.flip.overhang)) : 0;
    const t = clamp01(Math.sin(theta));
    if (overhang <= 0 || t < 1e-3) {
      drawFlapFlat(ctx, x, y, w, h, cfg, half);
      drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta);
      return;
    }
    for (let i = 0; i < sliceCount; i++) {
      const sy0 = baseYpx0 + Math.floor(i * halfHpx / sliceCount);
      const sy1 = baseYpx0 + Math.floor((i + 1) * halfHpx / sliceCount);
      const center = ((sy0 + sy1) / 2 - baseYpx0) / dpr;
      const dist = half === "top" ? clamp01((halfH - center) / halfH) : clamp01(center / halfH);
      const scaleX = 1 + 2 * (t * dist * (h * overhang)) / Math.max(1, w);
      const sy0o = Math.max(baseYpx0, sy0 - 1);
      const sy1o = Math.min(baseYpx1, sy1 + 1);
      const srcYpx = sy0o;
      const srcHpxO = Math.max(1, sy1o - sy0o);
      const destY0 = y + (half === "top" ? 0 : halfH) + (srcYpx - baseYpx0) / dpr;
      const destY1 = y + (half === "top" ? 0 : halfH) + (srcYpx - baseYpx0 + srcHpxO) / dpr;
      const destH = Math.max(1e-4, destY1 - destY0);
      const pivotY = destY0 + destH / 2;
      ctx.save();
      ctx.translate(cx, pivotY);
      ctx.scale(scaleX, 1);
      ctx.translate(-cx, -pivotY);
      ctx.drawImage(src, 0, srcYpx, srcWpx, srcHpxO, x, destY0, w, destH);
      ctx.restore();
    }
    drawFlipEdgeThickness(ctx, x, y, w, h, cfg, half, theta);
  }
  function drawHalfCardLayer(ctx, x, y, w, h, cfg, half, text, shadowAlpha = 0) {
    const dpr = window.devicePixelRatio || 1;
    const bg = getHalfBackgroundCanvas(w, h, dpr, cfg, half);
    ctx.drawImage(bg, x, y, w, h);
    drawHalfTextWithShadow(ctx, x, y, w, h, cfg, half, text, shadowAlpha);
  }
  function drawHalfCardBackground(ctx, x, y, w, h, cfg, half) {
    const v = cfg.visual;
    const cy = y + h / 2;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, v.radius);
    ctx.clip();
    ctx.beginPath();
    if (half === "top") ctx.rect(x, y, w, h / 2);
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
    const v = cfg.visual;
    const cy = y + h / 2;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, v.radius);
    ctx.clip();
    ctx.beginPath();
    if (half === "top") ctx.rect(x, y, w, h / 2);
    else ctx.rect(x, cy, w, h / 2);
    ctx.clip();
    const t = String(text ?? "");
    const { tx, ty } = resolveTextPosition(ctx, x, y, w, h, cfg, t || "H");
    ctx.fillStyle = v.colors.text;
    ctx.fillText(t, tx, ty);
    if (shadowAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }
  function drawTopFlap(ctx, x, y, w, h, cfg, charFrom, progress, cx, cy) {
    const v = cfg.visual;
    const p = Math.max(0, Math.min(0.5, progress));
    const t = clamp01(p * 2);
    const r = easeFlipProgress01(t, cfg.easing);
    const theta = r * (Math.PI / 2);
    const scaleY = Math.max(0, Math.cos(theta));
    const shadowStrength = typeof v.flip.shadow === "number" && Number.isFinite(v.flip.shadow) ? v.flip.shadow : 0.35;
    const shadow = Math.sin(theta) * shadowStrength;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, scaleY);
    ctx.translate(-cx, -cy);
    if (cfg.light) {
      drawFlapFlat(ctx, x, y, w, h, cfg, "top");
    } else {
      drawFlapTrapezoid(ctx, x, y, w, h, cfg, "top", theta, cx);
    }
    drawHalfTextWithShadow(ctx, x, y, w, h, cfg, "top", charFrom, shadow);
    ctx.restore();
  }
  function drawBottomFlap(ctx, x, y, w, h, cfg, charTo, progress, cx, cy) {
    const v = cfg.visual;
    const p = Math.max(0.5, Math.min(1, progress));
    const t = clamp01((p - 0.5) * 2);
    const r = easeOutFlipProgress01(t, cfg.easing);
    const theta = (1 - r) * (Math.PI / 2);
    let scaleY = Math.max(0, Math.cos(theta));
    if (normalizeEasingName(cfg.easing) === "bounce") {
      scaleY = applyBounceToScaleY(scaleY, r);
    }
    const shadowStrength = typeof v.flip.shadow === "number" && Number.isFinite(v.flip.shadow) ? v.flip.shadow : 0.35;
    const shadow = Math.sin(theta) * shadowStrength;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, scaleY);
    ctx.translate(-cx, -cy);
    if (cfg.light) {
      drawFlapFlat(ctx, x, y, w, h, cfg, "bottom");
    } else {
      drawFlapTrapezoid(ctx, x, y, w, h, cfg, "bottom", theta, cx);
    }
    drawHalfTextWithShadow(ctx, x, y, w, h, cfg, "bottom", charTo, shadow);
    ctx.restore();
  }
  function drawFlapFlat(ctx, x, y, w, h, cfg, half) {
    const dpr = window.devicePixelRatio || 1;
    const src = getHalfBackgroundCanvas(w, h, dpr, cfg, half);
    const srcWpx = src.width;
    const srcHpx = src.height;
    const midYpx = Math.round(srcHpx / 2);
    const sy = half === "top" ? 0 : midYpx;
    const sh = half === "top" ? midYpx : srcHpx - midYpx;
    const dy = half === "top" ? y : y + h / 2;
    const dh = h / 2;
    ctx.drawImage(src, 0, sy, srcWpx, Math.max(1, sh), x, dy, w, dh);
  }
  var FONT_METRICS_CACHE = /* @__PURE__ */ new Map();
  var FONT_METRICS_CACHE_LIMIT = 64;
  function getFontAscentDescent(ctx, fontSizePx) {
    const key = String(ctx.font || "");
    const cached = FONT_METRICS_CACHE.get(key);
    if (cached) return cached;
    const fbAscent = fontSizePx * 0.8;
    const fbDescent = fontSizePx * 0.2;
    let ascent = fbAscent;
    let descent = fbDescent;
    const fm = ctx.measureText("M");
    const fba = fm && typeof fm.fontBoundingBoxAscent === "number" ? fm.fontBoundingBoxAscent : NaN;
    const fbd = fm && typeof fm.fontBoundingBoxDescent === "number" ? fm.fontBoundingBoxDescent : NaN;
    if (Number.isFinite(fba) && Number.isFinite(fbd) && fba + fbd >= fontSizePx * 0.6) {
      ascent = fba;
      descent = fbd;
    } else {
      const m = ctx.measureText("Hg");
      const aba = m && typeof m.actualBoundingBoxAscent === "number" ? m.actualBoundingBoxAscent : NaN;
      const abd = m && typeof m.actualBoundingBoxDescent === "number" ? m.actualBoundingBoxDescent : NaN;
      if (Number.isFinite(aba)) ascent = aba;
      if (Number.isFinite(abd)) descent = abd;
      const sum = ascent + descent;
      if (!Number.isFinite(sum) || sum < fontSizePx * 0.6) {
        ascent = fbAscent;
        descent = fbDescent;
      }
    }
    const out = { ascent, descent };
    if (FONT_METRICS_CACHE.size >= FONT_METRICS_CACHE_LIMIT) {
      const oldestKey = FONT_METRICS_CACHE.keys().next().value;
      if (oldestKey != null) FONT_METRICS_CACHE.delete(oldestKey);
    }
    FONT_METRICS_CACHE.set(key, out);
    return out;
  }
  function resolveTextPosition(ctx, x, y, w, h, cfg, text) {
    const v = cfg.visual;
    let tx = x + w / 2;
    const align = v.text.align;
    if (align === "left") tx = x;
    if (align === "right") tx = x + w;
    const { ascent, descent } = getFontAscentDescent(ctx, v.font.sizePx);
    const valign = v.text.valign;
    let ty;
    if (valign === "top") {
      ty = y + ascent;
    } else if (valign === "bottom") {
      ty = y + h - descent;
    } else {
      ty = y + h / 2 + (ascent - descent) / 2;
    }
    tx += v.text.offsetXPx;
    ty += v.text.offsetYPx;
    return { tx, ty };
  }

  // src/elements/text-layout.ts
  function buildHalfScales(v, halfHead, halfTail, count) {
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
  }
  function buildOffsetsAndWidth(v, count, cardWidthPx, scales) {
    const n = Math.max(0, Math.floor(count || 0));
    const s = Array.isArray(scales) && scales.length === n ? scales : Array.from({ length: n }, () => 1);
    const offsets = new Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) {
      offsets[i] = x;
      const w = cardWidthPx * (s[i] || 1);
      if (i < n - 1) {
        const g = v.gap * Math.min(s[i] || 1, s[i + 1] || 1);
        x += w + g;
      } else {
        x += w;
      }
    }
    return { offsets, partW: x };
  }
  function resolveTextLayout(opts) {
    const { host, cfg, fromRaf, layout, alignWidth, halfHead, halfTail, ctx } = opts;
    const v = cfg.visual;
    const isSequencing = !!host._sequence;
    const cachedLayout = (() => {
      if (!(fromRaf && !host._layoutDirty && host._layoutCache)) return null;
      const c = host._layoutCache;
      if (!isSequencing || !host._sequence) return c;
      if (!c.geomParts || c.geomParts.length !== host._sequence.parts.length) return null;
      for (let i = 0; i < host._sequence.parts.length; i++) {
        const expected = v.atomic ? 1 : host._sequence.parts[i].flippers.length;
        if ((c.geomParts[i]?.count ?? 0) !== expected) return null;
      }
      return c;
    })();
    const partsItems = cachedLayout ? cachedLayout.partsItems : normalizePartsFromValue(cfg.value);
    const isJsonValue = cachedLayout ? cachedLayout.isJsonValue : parseJsonLoose(cfg.value) != null;
    const useParts = isJsonValue;
    let geomParts;
    let totalW;
    let totalH;
    let outerPadX;
    if (cachedLayout) {
      ({ geomParts, totalW, totalH, outerPadX } = cachedLayout);
      return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
    }
    const fontKey = ctx.font;
    const layoutKey = [
      cfg.value,
      v.atomic ? "a1" : "a0",
      layout,
      alignWidth ? "w1" : "w0",
      `hh${halfHead}`,
      `ht${halfTail}`,
      v.cardWidth,
      v.cardHeight,
      v.gap,
      v.radius,
      fontKey
    ].join("|");
    if (!host._layoutDirty && host._layoutCache && host._layoutCache.key === layoutKey) {
      ({ geomParts, totalW, totalH, outerPadX } = host._layoutCache);
      return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
    }
    const globalMaxLen = !v.atomic && useParts && alignWidth ? Math.max(1, ...partsItems.flat().map((s) => splitGraphemes(String(s ?? "")).length)) : null;
    const globalAtomicCardWidthPx = v.atomic && alignWidth ? (() => {
      let best = calcAtomicCardWidthPx(ctx, "", v);
      for (const partArr of partsItems) {
        for (const it of partArr || []) {
          const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ""), v);
          if (wpx > best) best = wpx;
        }
      }
      return best;
    })() : null;
    outerPadX = v.gap / 2;
    if (isSequencing && host._sequence) {
      geomParts = host._sequence.parts.map((sp, idx) => {
        const partItems = partsItems[idx] || [];
        const atomicText = String(sp.currentText ?? (sp.items && sp.items[0] ? sp.items[0] : ""));
        const cardWidthPx = v.atomic ? (() => {
          if (typeof globalAtomicCardWidthPx === "number") return globalAtomicCardWidthPx;
          let best = calcAtomicCardWidthPx(ctx, atomicText, v);
          if (useParts) {
            for (const it of partItems) {
              const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ""), v);
              if (wpx > best) best = wpx;
            }
          }
          return best;
        })() : v.cardWidth;
        const count = v.atomic ? 1 : sp.flippers.length;
        const scales = buildHalfScales(v, halfHead, halfTail, count);
        const { offsets, partW } = buildOffsetsAndWidth(v, count, cardWidthPx, scales);
        return { count, cardWidthPx, partW, tokens: null, scales, offsets };
      });
    } else {
      const itemsToDraw = useParts ? partsItems.map((arr) => Array.isArray(arr) && arr.length ? arr[0] ?? "" : "") : [String(cfg.value || "")];
      geomParts = itemsToDraw.map((text, idx) => {
        const partItems = partsItems[idx] || [];
        const atomicText = String(text ?? "");
        const cardWidthPx = v.atomic ? (() => {
          if (typeof globalAtomicCardWidthPx === "number") return globalAtomicCardWidthPx;
          let best = calcAtomicCardWidthPx(ctx, atomicText, v);
          if (useParts) {
            for (const it of partItems) {
              const wpx = calcAtomicCardWidthPx(ctx, String(it ?? ""), v);
              if (wpx > best) best = wpx;
            }
          }
          return best;
        })() : v.cardWidth;
        const partMaxLen = !v.atomic && useParts ? typeof globalMaxLen === "number" ? globalMaxLen : Math.max(1, ...partItems.map((s) => splitGraphemes(String(s ?? "")).length)) : null;
        const tokens = v.atomic ? [atomicText] : (() => {
          const g = splitGraphemes(atomicText);
          if (typeof partMaxLen !== "number") return g;
          const out = [];
          for (let i = 0; i < partMaxLen; i++) out.push(g[i] ?? "");
          return out;
        })();
        const count = v.atomic ? 1 : typeof partMaxLen === "number" ? partMaxLen : Math.max(1, tokens.length);
        const scales = buildHalfScales(v, halfHead, halfTail, count);
        const { offsets, partW } = buildOffsetsAndWidth(v, count, cardWidthPx, scales);
        return { count, cardWidthPx, partW, tokens, scales, offsets };
      });
    }
    totalH = layout === "stack" && geomParts.length > 1 ? v.cardHeight * geomParts.length + v.gap * (geomParts.length - 1) : v.cardHeight;
    totalW = outerPadX * 2 + (layout === "row" && geomParts.length > 1 ? geomParts.reduce((sum, p) => sum + p.partW, 0) + v.gap * (geomParts.length - 1) : Math.max(...geomParts.map((p) => p.partW)));
    host._layoutCache = {
      key: layoutKey,
      partsItems,
      isJsonValue,
      geomParts,
      totalW,
      totalH,
      outerPadX
    };
    host._layoutDirty = false;
    return { geomParts, totalW, totalH, outerPadX, partsItems, useParts };
  }

  // src/elements/text-draw.ts
  function drawTextFrame(opts) {
    const { host, cfg, layout, geomParts, outerPadX, partsItems, useParts, now, ctx, dpr } = opts;
    const v = cfg.visual;
    const isSequencing = !!host._sequence;
    const withScaledCard = (x, y, scale, drawFn) => {
      const s = typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;
      if (s === 1) {
        drawFn(x, y);
        return;
      }
      const yOff = (v.cardHeight - v.cardHeight * s) / 2;
      ctx.save();
      ctx.translate(x, y + yOff);
      ctx.scale(s, s);
      drawFn(0, 0);
      ctx.restore();
    };
    const renderStaticPart = (part, originX, originY) => {
      for (let i = 0; i < part.count; i++) {
        const x = originX + (part.offsets ? part.offsets[i] || 0 : i * (part.cardWidthPx + v.gap));
        const y = originY;
        const scale = part.scales && typeof part.scales[i] === "number" ? part.scales[i] : 1;
        withScaledCard(x, y, scale, (dx, dy) => {
          drawCardBackgroundCached(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg, dpr);
          const ch = part.tokens && part.tokens[i] == null ? "" : String((part.tokens && part.tokens[i]) ?? "");
          const { tx, ty } = resolveTextPosition(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg, ch || "H");
          ctx.fillStyle = v.colors.text;
          ctx.fillText(ch, tx, ty);
          drawDividerOverlay(ctx, dx, dy, part.cardWidthPx, v.cardHeight, cfg);
        });
      }
    };
    const renderSequencePart = (partIdx, partGeom, originX, originY) => {
      const seqPart = host._sequence && host._sequence.parts[partIdx] ? host._sequence.parts[partIdx] : null;
      if (!seqPart) {
        renderStaticPart(partGeom, originX, originY);
        return;
      }
      const duration = Math.max(1, cfg.duration || JS_DEFAULTS.duration);
      const nowSafe = typeof now === "number" && Number.isFinite(now) ? now : performance.now();
      const animDuration = (anim) => Math.max(1, anim && anim.durationMs ? anim.durationMs : duration);
      for (let i = 0; i < seqPart.flippers.length; i++) {
        seqPart.flippers[i].update(nowSafe, duration);
      }
      const x0 = originX;
      const y0 = originY;
      const count = seqPart.flippers.length;
      for (let i = 0; i < count; i++) {
        const x = x0 + (partGeom.offsets ? partGeom.offsets[i] || 0 : i * (partGeom.cardWidthPx + v.gap));
        const y = y0;
        const text = String(seqPart.flippers[i].baseValue ?? "");
        const scale = partGeom.scales && typeof partGeom.scales[i] === "number" ? partGeom.scales[i] : 1;
        withScaledCard(x, y, scale, (dx, dy) => {
          drawCardBackgroundCached(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, dpr);
          const { tx, ty } = resolveTextPosition(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, text || "H");
          ctx.fillStyle = v.colors.text;
          ctx.fillText(text, tx, ty);
        });
      }
      for (let i = 0; i < count; i++) {
        const flipper = seqPart.flippers[i];
        if (!flipper.hasActive()) continue;
        const x = x0 + (partGeom.offsets ? partGeom.offsets[i] || 0 : i * (partGeom.cardWidthPx + v.gap));
        const y = y0;
        const oldest = flipper.animations[flipper.animations.length - 1];
        const scale = partGeom.scales && typeof partGeom.scales[i] === "number" ? partGeom.scales[i] : 1;
        withScaledCard(x, y, scale, (dx, dy) => {
          drawHalfCardLayer(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg, "bottom", oldest.from, 0);
        });
      }
      for (let i = 0; i < count; i++) {
        const flipper = seqPart.flippers[i];
        if (!flipper.hasActive()) continue;
        const x = x0 + (partGeom.offsets ? partGeom.offsets[i] || 0 : i * (partGeom.cardWidthPx + v.gap));
        const y = y0;
        const scale = partGeom.scales && typeof partGeom.scales[i] === "number" ? partGeom.scales[i] : 1;
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
        const x = x0 + (partGeom.offsets ? partGeom.offsets[i] || 0 : i * (partGeom.cardWidthPx + v.gap));
        const y = y0;
        const scale = partGeom.scales && typeof partGeom.scales[i] === "number" ? partGeom.scales[i] : 1;
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
        const x = x0 + (partGeom.offsets ? partGeom.offsets[i] || 0 : i * (partGeom.cardWidthPx + v.gap));
        const y = y0;
        const scale = partGeom.scales && typeof partGeom.scales[i] === "number" ? partGeom.scales[i] : 1;
        withScaledCard(x, y, scale, (dx, dy) => {
          drawDividerOverlay(ctx, dx, dy, partGeom.cardWidthPx, v.cardHeight, cfg);
        });
      }
    };
    let ox = 0;
    let oy = 0;
    for (let p = 0; p < geomParts.length; p++) {
      const part = geomParts[p];
      const originX = layout === "row" ? outerPadX + ox : outerPadX;
      const originY = oy;
      if (isSequencing) renderSequencePart(p, part, originX, originY);
      else renderStaticPart(part, originX, originY);
      if (layout === "row") {
        ox += part.partW + (p < geomParts.length - 1 ? v.gap : 0);
      } else {
        oy += v.cardHeight + (p < geomParts.length - 1 ? v.gap : 0);
      }
    }
    const a11ySep = layout === "stack" ? "\n" : " ";
    const a11yText = isSequencing && host._sequence ? host._sequence.parts.map((sp) => sp.flippers.map((f) => String(f.baseValue ?? "")).join("")).join(a11ySep) : useParts ? partsItems.map((arr) => Array.isArray(arr) && arr.length ? String(arr[0] ?? "") : "").join(a11ySep) : String(cfg.value ?? "");
    host._applyAutoAriaLabel(a11yText);
  }

  // src/elements/text-render.ts
  function renderText(host, now, fromRaf = false) {
    if (host._isPaintSuppressed()) {
      host._refreshIntersectionIfStale();
      if (host._isPaintSuppressed()) {
        host._layoutDirty = true;
        host._visualDirty = true;
        return;
      }
    }
    const cfg = fromRaf && host._cfg && !host._visualDirty ? host._cfg : host._readConfig();
    host._cfg = cfg;
    host._visualDirty = false;
    const v = cfg.visual;
    const layout = host.hasAttribute("stack") ? "stack" : "row";
    const alignWidth = host.hasAttribute("align-width");
    const halfHead = Math.max(0, Math.floor(cfg.halfHead || 0));
    const halfTail = Math.max(0, Math.floor(cfg.halfTail || 0));
    const ctx = host._ctx;
    const applyTextState = () => {
      ctx.font = `${v.font.weight} ${v.font.sizePx}px ${v.font.family}`;
      const align = v.text.align;
      ctx.textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
      ctx.textBaseline = "alphabetic";
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
      ctx
    });
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
      dpr
    });
  }

  // src/elements/text.ts
  var PatapataTextElement = class extends PatapataCanvasBaseElement {
    constructor() {
      super();
      __publicField(this, "_cfg");
      __publicField(this, "_onResize");
      __publicField(this, "_timer");
      __publicField(this, "_rafScheduled");
      __publicField(this, "_sequence");
      __publicField(this, "_onClick");
      __publicField(this, "_ro");
      __publicField(this, "_mo");
      __publicField(this, "_visualCfgCache");
      __publicField(this, "_visualCfgCacheDividerFallback");
      __publicField(this, "_a11yAutoManaged");
      __publicField(this, "_a11yLastAutoLabel");
      __publicField(this, "_layoutCache");
      __publicField(this, "_layoutDirty");
      __publicField(this, "_visualDirty");
      __publicField(this, "_isIntersecting");
      __publicField(this, "_resizeRaf");
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
    static get observedAttributes() {
      return TEXT_OBSERVED_ATTRS;
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
      if (this.getAttribute("aria-hidden") === "true") return;
      const nextLabel = String(labelText ?? "");
      const current = this.getAttribute("aria-label");
      const shouldManage = current == null || this._a11yAutoManaged && current === this._a11yLastAutoLabel;
      if (!shouldManage) {
        this._a11yAutoManaged = false;
        this._a11yLastAutoLabel = null;
        return;
      }
      if (!this.hasAttribute("role")) this.setAttribute("role", "img");
      if (current !== nextLabel) this.setAttribute("aria-label", nextLabel);
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
      window.addEventListener("resize", this._onResize);
      if (typeof ResizeObserver !== "undefined") {
        this._ro = new ResizeObserver(() => {
          this._onResize();
        });
        this._ro.observe(this);
      }
      if (typeof MutationObserver !== "undefined") {
        this._mo = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type !== "attributes") continue;
            if (m.attributeName === "style" || m.attributeName === "class") {
              this._onResize();
              break;
            }
          }
        });
        this._mo.observe(this, { attributes: true, attributeFilter: ["style", "class"] });
      }
      registerVisibility(this);
    }
    _teardownResizeAndVisibility() {
      window.removeEventListener("resize", this._onResize);
      unregisterVisibility(this);
      if (this._ro) {
        try {
          this._ro.disconnect();
        } catch (_) {
        }
        this._ro = null;
      }
      if (this._mo) {
        try {
          this._mo.disconnect();
        } catch (_) {
        }
        this._mo = null;
      }
      this._cancelResizeRaf();
    }
    _setClickHandler(fn) {
      if (this._onClick) this.removeEventListener("click", this._onClick);
      this._onClick = typeof fn === "function" ? fn : null;
      if (this._onClick) this.addEventListener("click", this._onClick);
    }
    _clearClickHandler() {
      if (this._onClick) this.removeEventListener("click", this._onClick);
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
      if (this._timer != null || this.hasAttribute("autostart")) this.start();
      else this._stopAndRender();
    }
    connectedCallback() {
      this._setupResizeAndVisibility();
      this._setClickHandler(() => {
        if (this.hasAttribute("click")) this.start();
      });
      if (this.hasAttribute("autostart")) this.start();
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
    attributeChangedCallback(name, oldValue = null) {
      if (!this.isConnected) return;
      if (name === "click") return;
      if (VISUAL_ONLY_ATTRS.has(name)) {
        this._refreshVisual();
        return;
      }
      if (TEXT_RESTART_ATTRS.has(name)) {
        this._markLayoutVisual();
        if (name === "value" && this._timer == null && !this.hasAttribute("autostart")) {
          this._flipToValue(oldValue);
          return;
        }
        this._restartIfActive();
        return;
      }
      if (name === "autostart") {
        this._markLayoutVisual();
        if (this.hasAttribute("autostart")) this.start();
        else this._stopAndRender();
        return;
      }
      this._markLayoutVisual();
      this._render(performance.now());
    }
    _flipToValue(oldValueRaw) {
      const cfg = this._readConfig();
      const value = String(cfg.value ?? "");
      if (this.hasAttribute("rand") || parseJsonLoose(value) != null || this._sequence && this._sequence.mode !== "static") {
        this._stopAndRender();
        return;
      }
      const atomic = !!(cfg.visual && cfg.visual.atomic);
      const now = performance.now();
      if (!this._sequence) {
        const oldValue = this._visibleSeedFromValue(oldValueRaw);
        if (oldValue == null) {
          this._stopAndRender();
          return;
        }
        const oldTokens = atomic ? [oldValue] : splitGraphemes(oldValue);
        const { sequence } = buildSinglePartSequence("static", oldValue, oldTokens, atomic);
        this._sequence = sequence;
      }
      const part = this._sequence.parts[0];
      const tokens = atomic ? [value] : splitGraphemes(value);
      applyPanelTokensToPart({
        part,
        tokens,
        isMsPanel: tokens.map(() => false),
        atomic,
        durationNormal: Math.max(1, cfg.duration || JS_DEFAULTS.duration),
        durationMsFixed: MS_PANEL_DURATION_MS,
        nowTs: now,
        allowRebuild: true,
        onLayoutDirty: () => {
          this._layoutDirty = true;
        }
      });
      part.items = [value];
      part.currentText = value;
      this._layoutDirty = true;
      this._render(now);
      this._ensureRaf();
    }
    _visibleSeedFromValue(valueRaw) {
      if (parseJsonLoose(valueRaw) == null) return String(valueRaw ?? "");
      const parts = normalizePartsFromValue(valueRaw);
      if (parts.length !== 1) return null;
      return String(parts[0]?.[0] ?? "");
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
      if (typeof document !== "undefined" && document.hidden) return true;
      if (RUNTIME.supportsIO && !this._isIntersecting) return true;
      return false;
    }
    _refreshIntersectionIfStale() {
      if (!RUNTIME.supportsIO) return;
      if (this._isIntersecting) return;
      if (!this.isConnected) return;
      if (typeof window === "undefined") return;
      const r = typeof this.getBoundingClientRect === "function" ? this.getBoundingClientRect() : null;
      if (!r) return;
      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;
      if (vw <= 0 || vh <= 0) return;
      const intersects = r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
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
        this._pokeTick();
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
      this._pokeTick();
      this._render(performance.now());
      this._ensureRaf();
    }
    // Hook for subclasses whose tick loop slows down while painting is
    // suppressed: run a tick immediately after becoming visible again.
    _pokeTick() {
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
    _readConfig() {
      const interval = pick(attrNumber(this, "interval"), JS_DEFAULTS.interval);
      const duration = pick(attrNumber(this, "duration"), JS_DEFAULTS.duration);
      const value = pick(attrString(this, "value"), JS_DEFAULTS.value);
      const { halfHead, halfTail } = readHalfHeadTail(this);
      const visual = this._readVisualConfig("line");
      const light = this.hasAttribute("light");
      const easing = readEasing(this, "linear");
      return { visual, interval, duration, value, light, easing, halfHead, halfTail };
    }
    _render(now, fromRaf = false) {
      renderText(this, now, fromRaf);
    }
  };

  // src/core/time-format.ts
  var CLOCK_TOKENS = [
    "ampm_jp",
    "ddd_jp",
    "HH12",
    "YYYY",
    "SSS",
    "DDD",
    "HHH",
    "mmm",
    "sss",
    "ampm",
    "ddd",
    "YY",
    "MM",
    "DD",
    "HH",
    "mm",
    "ss",
    "SS",
    "S"
  ];
  var CLOCK_DDD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var CLOCK_DDD_JP = ["\u65E5", "\u6708", "\u706B", "\u6C34", "\u6728", "\u91D1", "\u571F"];
  var TIMER_TOKENS = [
    "SSS",
    "HHH",
    "mmm",
    "sss",
    "SS",
    "mm",
    "ss",
    "S"
  ];
  function pad2(n) {
    const s = String(Math.trunc(n) % 100);
    return s.length >= 2 ? s : `0${s}`;
  }
  function pad3(n) {
    const s = String(Math.trunc(n) % 1e3);
    if (s.length >= 3) return s;
    if (s.length === 2) return `0${s}`;
    return `00${s}`;
  }
  function parseDiffTargetMs(raw) {
    const s = String(raw ?? "").trim();
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
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
        return null;
      }
      const ms2 = dt.getTime();
      return Number.isFinite(ms2) ? ms2 : null;
    }
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
  }
  function clampNonNegativeMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n)) return 0;
    return n <= 0 ? 0 : n;
  }
  function tokenizeFormat(fmt, tokenNames) {
    const s = String(fmt ?? "");
    const out = [];
    for (let i = 0; i < s.length; ) {
      let matched = null;
      for (const t of tokenNames) {
        if (s.startsWith(t, i)) {
          matched = t;
          break;
        }
      }
      if (matched) {
        out.push({ type: "token", value: matched });
        i += matched.length;
      } else {
        const ch = splitGraphemes(s.slice(i))[0] ?? s[i];
        out.push({ type: "lit", value: ch });
        i += ch.length;
      }
    }
    return out;
  }
  function tokenizeClockFormat(fmt) {
    return tokenizeFormat(fmt, CLOCK_TOKENS);
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
      case "YYYY":
        return String(y).padStart(4, "0");
      case "YY":
        return pad2(y % 100);
      case "MM":
        return pad2(m);
      case "DD":
        return pad2(dd);
      case "HH":
        return pad2(hh);
      case "HH12": {
        const h12 = hh % 12 || 12;
        return pad2(h12);
      }
      case "ampm":
        return hh < 12 ? "AM" : "PM";
      case "ampm_jp":
        return hh < 12 ? "\u5348\u524D" : "\u5348\u5F8C";
      case "mm":
        return pad2(mi);
      case "ss":
        return pad2(ss);
      case "S":
        return String(Math.floor(ms / 100));
      case "SS":
        return pad2(Math.floor(ms / 10));
      case "SSS":
        return pad3(ms);
      case "ddd":
        return CLOCK_DDD[d.getDay()] || "";
      case "ddd_jp":
        return CLOCK_DDD_JP[d.getDay()] || "";
      default:
        return "";
    }
  }
  function clockDiffTokenValue(token, diffMs, minDigits = 0) {
    const n = Number(diffMs);
    const neg = Number.isFinite(n) && n < 0;
    const msAbs = Number.isFinite(n) ? Math.abs(n) : 0;
    const sign = neg ? "-" : "";
    const md = typeof minDigits === "number" && Number.isFinite(minDigits) && minDigits > 0 ? Math.floor(minDigits) : 0;
    const padSigned = (v) => {
      const s = String(Math.trunc(v));
      if (md <= 0) return `${sign}${s}`;
      return `${sign}${s.padStart(md, "0")}`;
    };
    const days = Math.floor(msAbs / 864e5);
    const hoursTotal = Math.floor(msAbs / 36e5);
    const minutesTotal = Math.floor(msAbs / 6e4);
    const secondsTotal = Math.floor(msAbs / 1e3);
    const hh = hoursTotal % 24;
    const mi = minutesTotal % 60;
    const ss = secondsTotal % 60;
    const ms = Math.floor(msAbs % 1e3);
    switch (token) {
      case "DDD":
        return padSigned(days);
      case "DD":
        return `${sign}${days < 100 ? pad2(days) : String(days)}`;
      case "HHH":
        return padSigned(hoursTotal);
      case "HH":
        return pad2(hh);
      case "mmm":
        return padSigned(minutesTotal);
      case "mm":
        return pad2(mi);
      case "sss":
        return padSigned(secondsTotal);
      case "ss":
        return pad2(ss);
      case "S":
        return String(Math.floor(ms / 100));
      case "SS":
        return pad2(Math.floor(ms / 10));
      case "SSS":
        return pad3(ms);
      // Non-diff tokens: keep stable width but show neutral values.
      case "YYYY":
        return "0000";
      case "YY":
        return "00";
      case "MM":
        return "00";
      case "HH12":
        return pad2(hh % 12 || 12);
      case "ampm":
        return "--";
      case "ampm_jp":
        return "--";
      case "ddd":
        return "---";
      case "ddd_jp":
        return "-";
      default:
        return "";
    }
  }
  function buildClockPanels(format, date, diffMs, minDigits = 0) {
    const parts = tokenizeClockFormat(format);
    const tokens = [];
    const isMsPanel = [];
    const isDiff = diffMs != null;
    for (const p of parts) {
      if (p.type === "lit") {
        const g2 = splitGraphemes(String(p.value ?? ""));
        for (const ch of g2) {
          tokens.push(String(ch ?? ""));
          isMsPanel.push(false);
        }
        continue;
      }
      const v = isDiff ? clockDiffTokenValue(p.value, diffMs, minDigits) : clockTokenValue(p.value, date);
      const g = splitGraphemes(String(v ?? ""));
      const msFlag = p.value === "S" || p.value === "SS" || p.value === "SSS";
      for (const ch of g) {
        tokens.push(String(ch ?? ""));
        isMsPanel.push(msFlag);
      }
    }
    return { tokens, isMsPanel };
  }
  function clockProbeTextFromFormat(format, minDigits = 0) {
    const md = typeof minDigits === "number" && Number.isFinite(minDigits) && minDigits > 0 ? Math.floor(minDigits) : 0;
    const flex = (fallback) => "8".repeat(Math.max(fallback, md));
    const parts = tokenizeClockFormat(format);
    const out = [];
    for (const p of parts) {
      if (p.type === "lit") {
        out.push(String(p.value ?? ""));
        continue;
      }
      switch (p.value) {
        case "DDD":
          out.push(flex(4));
          break;
        case "HHH":
          out.push(flex(4));
          break;
        case "mmm":
          out.push(flex(4));
          break;
        case "sss":
          out.push(flex(4));
          break;
        case "YYYY":
          out.push("8888");
          break;
        case "YY":
          out.push("88");
          break;
        case "MM":
          out.push("88");
          break;
        case "DD":
          out.push("88");
          break;
        case "HH":
          out.push("88");
          break;
        case "HH12":
          out.push("88");
          break;
        case "mm":
          out.push("88");
          break;
        case "ss":
          out.push("88");
          break;
        case "S":
          out.push("8");
          break;
        case "SS":
          out.push("88");
          break;
        case "SSS":
          out.push("888");
          break;
        case "ddd":
          out.push("WWW");
          break;
        case "ddd_jp":
          out.push("\u6C34");
          break;
        case "ampm":
          out.push("PM");
          break;
        case "ampm_jp":
          out.push("\u5348\u5F8C");
          break;
        default:
          out.push("");
          break;
      }
    }
    return out.join("");
  }
  function tokenizeTimerFormat(fmt) {
    return tokenizeFormat(fmt, TIMER_TOKENS);
  }
  function timerTokenValue(token, msTotal, minDigits = 0) {
    const msAbs = clampNonNegativeMs(msTotal);
    const hoursTotal = Math.floor(msAbs / 36e5);
    const minutesTotal = Math.floor(msAbs / 6e4);
    const secondsTotal = Math.floor(msAbs / 1e3);
    const md = typeof minDigits === "number" && Number.isFinite(minDigits) && minDigits > 0 ? Math.floor(minDigits) : 0;
    const padFlex = (v) => {
      const s = String(Math.trunc(v));
      if (md <= 0) return s;
      return s.padStart(md, "0");
    };
    const mm = minutesTotal % 60;
    const ss = secondsTotal % 60;
    const ms = Math.floor(msAbs % 1e3);
    switch (token) {
      case "HHH":
        return padFlex(hoursTotal);
      case "mmm":
        return padFlex(minutesTotal);
      case "sss":
        return padFlex(secondsTotal);
      case "mm":
        return pad2(mm);
      case "ss":
        return pad2(ss);
      case "S":
        return String(Math.floor(ms / 100));
      case "SS":
        return pad2(Math.floor(ms / 10));
      case "SSS":
        return pad3(ms);
      default:
        return "";
    }
  }
  function buildTimerPanels(format, msTotal, minDigits = 0) {
    const parts = tokenizeTimerFormat(format);
    const tokens = [];
    const isMsPanel = [];
    for (const p of parts) {
      if (p.type === "lit") {
        const g2 = splitGraphemes(String(p.value ?? ""));
        for (const ch of g2) {
          tokens.push(String(ch ?? ""));
          isMsPanel.push(false);
        }
        continue;
      }
      const v = timerTokenValue(p.value, msTotal, minDigits);
      const g = splitGraphemes(String(v ?? ""));
      const msFlag = p.value === "S" || p.value === "SS" || p.value === "SSS";
      for (const ch of g) {
        tokens.push(String(ch ?? ""));
        isMsPanel.push(msFlag);
      }
    }
    return { tokens, isMsPanel };
  }
  function timerProbeTextFromFormat(format, minDigits = 0) {
    const md = typeof minDigits === "number" && Number.isFinite(minDigits) && minDigits > 0 ? Math.floor(minDigits) : 0;
    const flex = (fallback) => "8".repeat(Math.max(fallback, md));
    const parts = tokenizeTimerFormat(format);
    const out = [];
    for (const p of parts) {
      if (p.type === "lit") {
        out.push(String(p.value ?? ""));
        continue;
      }
      switch (p.value) {
        case "HHH":
          out.push(flex(4));
          break;
        case "mmm":
          out.push(flex(4));
          break;
        case "sss":
          out.push(flex(4));
          break;
        case "mm":
          out.push("88");
          break;
        case "ss":
          out.push("88");
          break;
        case "S":
          out.push("8");
          break;
        case "SS":
          out.push("88");
          break;
        case "SSS":
          out.push("888");
          break;
        default:
          out.push("");
          break;
      }
    }
    return out.join("");
  }

  // src/elements/clock.ts
  var PatapataClockElement = class extends PatapataTextElement {
    constructor() {
      super(...arguments);
      __publicField(this, "_lastInvalidDiffWarning", null);
      __publicField(this, "_stepFn", null);
    }
    static get observedAttributes() {
      return CLOCK_OBSERVED_ATTRS;
    }
    connectedCallback() {
      super.connectedCallback();
      if (this.isConnected) this.start();
    }
    attributeChangedCallback(name) {
      if (!this.isConnected) return;
      if (name === "click") return;
      if (VISUAL_ONLY_ATTRS.has(name)) {
        this._refreshVisual();
        return;
      }
      if (CLOCK_RESTART_ATTRS.has(name)) {
        this._markLayoutVisual();
        this.start();
        return;
      }
      if (name === "autostart") {
        this._markLayoutVisual();
        this.start();
        return;
      }
      this._markLayoutVisual();
      this._render(performance.now());
    }
    _readConfig() {
      const duration = pick(attrNumber(this, "duration"), JS_DEFAULTS.duration);
      const format = pick(attrString(this, "format"), "HH:mm:ss");
      const diff = pick(attrString(this, "diff"), "");
      const minDigits = readMinDigits(this);
      const { halfHead, halfTail } = readHalfHeadTail(this);
      const value = clockProbeTextFromFormat(format, minDigits);
      const visual = this._readVisualConfig("line");
      const light = this.hasAttribute("light");
      const easing = readEasing(this, "linear");
      return { visual, interval: JS_DEFAULTS.interval, duration, value, light, easing, format, diff, minDigits, halfHead, halfTail };
    }
    _ensureSequence() {
      const cfg = this._readConfig();
      const format = String(cfg.format ?? "");
      const diffRaw = String(cfg.diff ?? "").trim();
      const diffEnabled = !!diffRaw;
      const parsedDiffTargetMs = diffEnabled ? parseDiffTargetMs(diffRaw) : null;
      if (diffEnabled && parsedDiffTargetMs == null && this._lastInvalidDiffWarning !== diffRaw) {
        this._lastInvalidDiffWarning = diffRaw;
        console.warn("[patapata-clock] Invalid diff value; falling back to current time.", diffRaw);
      }
      if (!diffEnabled || parsedDiffTargetMs != null) this._lastInvalidDiffWarning = null;
      const diffTargetMs = diffEnabled ? parsedDiffTargetMs ?? Date.now() : null;
      const probe = String(cfg.value ?? "");
      const atomic = !!(cfg.visual && cfg.visual.atomic);
      const now = performance.now();
      const date = /* @__PURE__ */ new Date();
      const initialDiffMs = diffTargetMs != null ? diffTargetMs - date.getTime() : null;
      const panels = buildClockPanels(format, date, initialDiffMs, cfg.minDigits || 0);
      const { sequence, part } = buildSinglePartSequence("clock", probe, panels.tokens, atomic);
      this._sequence = sequence;
      this._layoutDirty = true;
      const hasMsPanels = panels.isMsPanel.some(Boolean);
      const nextTickDelayMs = () => {
        if (this._isPaintSuppressed()) return HIDDEN_TICK_INTERVAL_MS;
        if (hasMsPanels) return TICK_INTERVAL_MS;
        const toNextSecond = 1e3 - Date.now() % 1e3;
        return Math.min(1e3, Math.max(TICK_INTERVAL_MS, toNextSecond + 8));
      };
      const stepClockOnce = () => {
        if (!this._sequence) return;
        const nowTs = performance.now();
        const d = /* @__PURE__ */ new Date();
        const diffMs = diffTargetMs != null ? diffTargetMs - d.getTime() : null;
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
          onLayoutDirty: () => {
            this._layoutDirty = true;
          }
        });
        part.currentText = probe;
        this._ensureRaf();
        this._timer = setTimeout(stepClockOnce, nextTickDelayMs());
      };
      this._stepFn = stepClockOnce;
      this._render(now);
      this._timer = setTimeout(stepClockOnce, nextTickDelayMs());
    }
    // While hidden/off-screen the tick loop slows to HIDDEN_TICK_INTERVAL_MS;
    // when painting resumes, tick immediately so the display snaps up to date.
    _pokeTick() {
      if (this._timer == null || this._stepFn == null) return;
      clearTimeout(this._timer);
      this._timer = null;
      this._stepFn();
    }
  };

  // src/elements/timer.ts
  var PatapataTimerElement = class extends PatapataTextElement {
    constructor() {
      super();
      __publicField(this, "_timerRunning");
      __publicField(this, "_timerBaseElapsedMs");
      __publicField(this, "_timerStartedAt");
      __publicField(this, "_hasMsPanels");
      this._timerRunning = false;
      this._timerBaseElapsedMs = 0;
      this._timerStartedAt = 0;
      this._hasMsPanels = false;
    }
    static get observedAttributes() {
      return TIMER_OBSERVED_ATTRS;
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
        if (!this.hasAttribute("click")) return;
        this._handleTimerClick();
      });
      this._ensureSequence();
      this._render(performance.now());
      this._ensureRaf();
      if (this.hasAttribute("autostart")) this.start();
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
      if (name === "click") return;
      if (VISUAL_ONLY_ATTRS.has(name)) {
        this._refreshVisual();
        return;
      }
      if (name === "sec") {
        this.reset();
      }
      if (TIMER_REFRESH_ATTRS.has(name)) {
        this._refreshSequence();
        return;
      }
      if (name === "autostart") {
        if (this.hasAttribute("autostart")) this.start();
        else this.stop();
        return;
      }
      this._markLayoutVisual();
      this._render(performance.now());
      this._ensureRaf();
    }
    _readConfig() {
      const duration = pick(attrNumber(this, "duration"), JS_DEFAULTS.duration);
      const format = pick(attrString(this, "format"), "HHH:mm:ss");
      const minDigits = readMinDigits(this);
      const secRaw = attrNumber(this, "sec");
      const sec = typeof secRaw === "number" && Number.isFinite(secRaw) && secRaw >= 0 ? secRaw : null;
      const { halfHead, halfTail } = readHalfHeadTail(this);
      const value = timerProbeTextFromFormat(format, minDigits);
      const visual = this._readVisualConfig("line");
      const light = this.hasAttribute("light");
      const easing = readEasing(this, "linear");
      return { visual, interval: JS_DEFAULTS.interval, duration, value, light, easing, format, sec, minDigits, halfHead, halfTail };
    }
    _timerConfig() {
      const cfg = this._cfg && !this._visualDirty ? this._cfg : this._readConfig();
      this._cfg = cfg;
      const countdownStartMs = cfg.sec != null ? clampNonNegativeMs(cfg.sec * 1e3) : null;
      return { cfg, countdownStartMs };
    }
    _nowElapsedMs(nowTs) {
      const base = clampNonNegativeMs(this._timerBaseElapsedMs);
      if (!this._timerRunning) return base;
      const dt = typeof nowTs === "number" && Number.isFinite(nowTs) ? nowTs - this._timerStartedAt : 0;
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
      const format = String(cfg.format ?? "");
      const atomic = !!(cfg.visual && cfg.visual.atomic);
      const probe = String(cfg.value ?? "");
      const now = performance.now();
      const panels = buildTimerPanels(format, this._displayMs(now), cfg.minDigits || 0);
      const { sequence } = buildSinglePartSequence("timer", probe, panels.tokens, atomic);
      this._sequence = sequence;
      this._layoutDirty = true;
      this._hasMsPanels = panels.isMsPanel.some(Boolean);
    }
    _nextTickDelayMs(nowTs) {
      if (this._isPaintSuppressed()) return HIDDEN_TICK_INTERVAL_MS;
      if (this._hasMsPanels) return TICK_INTERVAL_MS;
      const { countdownStartMs } = this._timerConfig();
      const msPart = this._displayMs(nowTs) % 1e3;
      const toBoundary = countdownStartMs == null ? 1e3 - msPart : msPart > 0 ? msPart : 1e3;
      return Math.min(1e3, Math.max(TICK_INTERVAL_MS, toBoundary + 8));
    }
    _applyDisplay(nowTs, allowRebuild = false) {
      if (!this._sequence || !this._sequence.parts || !this._sequence.parts[0]) return;
      const { cfg } = this._timerConfig();
      const atomic = !!(cfg.visual && cfg.visual.atomic);
      const format = String(cfg.format ?? "");
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
        onLayoutDirty: () => {
          this._layoutDirty = true;
        }
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
      this._ensureRaf();
      if (this._timerRunning) {
        this._timer = setTimeout(() => this._tickOnce(), this._nextTickDelayMs(nowTs));
      }
    }
    // While hidden/off-screen the tick loop slows to HIDDEN_TICK_INTERVAL_MS;
    // when painting resumes, tick immediately so the display snaps up to date.
    _pokeTick() {
      if (!this._timerRunning || this._timer == null) return;
      this._clearTimerHandle();
      this._tickOnce();
    }
  };

  // src/elements/control.ts
  var PatapataControlElement = class extends HTMLElement {
    constructor() {
      super();
      __publicField(this, "_onClick");
      __publicField(this, "_onKeyDown");
      __publicField(this, "_enabledTabIndex");
      this._onClick = null;
      this._onKeyDown = null;
      this._enabledTabIndex = void 0;
    }
    static get observedAttributes() {
      return ["for", "action", "start", "stop", "reset", "toggle", "disabled"];
    }
    connectedCallback() {
      if (!this.hasAttribute("role")) this.setAttribute("role", "button");
      if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
      this._syncDisabledState();
      this._onClick = (e) => {
        if (this.hasAttribute("disabled")) return;
        e.preventDefault();
        this._performAction();
      };
      this.addEventListener("click", this._onClick);
      this._onKeyDown = (e) => {
        if (this.hasAttribute("disabled")) return;
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        this._performAction();
      };
      this.addEventListener("keydown", this._onKeyDown);
    }
    disconnectedCallback() {
      if (this._onClick) this.removeEventListener("click", this._onClick);
      if (this._onKeyDown) this.removeEventListener("keydown", this._onKeyDown);
      this._onClick = null;
      this._onKeyDown = null;
    }
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) return;
      if (name === "disabled") this._syncDisabledState();
    }
    _syncDisabledState() {
      if (this.hasAttribute("disabled")) {
        if (this._enabledTabIndex === void 0) this._enabledTabIndex = this.getAttribute("tabindex");
        this.setAttribute("aria-disabled", "true");
        this.tabIndex = -1;
        return;
      }
      this.removeAttribute("aria-disabled");
      if (this._enabledTabIndex !== void 0) {
        if (this._enabledTabIndex == null) this.tabIndex = 0;
        else this.setAttribute("tabindex", this._enabledTabIndex);
        this._enabledTabIndex = void 0;
      } else if (!this.hasAttribute("tabindex")) {
        this.tabIndex = 0;
      }
    }
    _resolveAction() {
      if (this.hasAttribute("start")) return "start";
      if (this.hasAttribute("stop")) return "stop";
      if (this.hasAttribute("reset")) return "reset";
      if (this.hasAttribute("toggle")) return "toggle";
      const a = attrString(this, "action");
      if (a) return a;
      return "toggle";
    }
    _resolveTarget() {
      const id = attrString(this, "for");
      if (!id) return null;
      return document.getElementById(id);
    }
    _performAction() {
      const target = this._resolveTarget();
      const action = this._resolveAction();
      if (!target) return;
      const fn = target[action];
      if (typeof fn === "function") fn.call(target);
    }
  };

  // src/patapata.ts
  if (!customElements.get("patapata-text")) {
    customElements.define("patapata-text", PatapataTextElement);
  }
  if (!customElements.get("patapata-clock")) {
    customElements.define("patapata-clock", PatapataClockElement);
  }
  if (!customElements.get("patapata-timer")) {
    customElements.define("patapata-timer", PatapataTimerElement);
  }
  if (!customElements.get("patapata-control")) {
    customElements.define("patapata-control", PatapataControlElement);
  }
})();
