export function attrString(el, name) {
  const raw = el.getAttribute(name);
  return raw == null ? null : String(raw);
}

export function attrNumber(el, name) {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function attrBool(el, name, defaultValue) {
  if (!el.hasAttribute(name)) return defaultValue;
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return true;
  const v = String(raw).toLowerCase().trim();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return true;
}

export function cssVar(el, name) {
  const v = getComputedStyle(el).getPropertyValue(name);
  const trimmed = v == null ? '' : String(v).trim();
  return trimmed || null;
}

export function pick(...vals) {
  for (const v of vals) {
    if (v != null) return v;
  }
  return null;
}

export function readHalfHeadTail(el) {
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

export function readMinDigits(el) {
  const raw = attrNumber(el, 'min-digits');
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return 0;
}

export function normalizeEasingName(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'linear') return 'linear';
  if (s === 'ease' || s === 'ease-in' || s === 'easein') return 'ease';
  if (s === 'bounce' || s === 'ease-bounce' || s === 'easebounce') return 'bounce';
  return null;
}

export function readEasing(el, fallback = 'linear') {
  return pick(
    normalizeEasingName(attrString(el, 'easing')),
    normalizeEasingName(cssVar(el, '--patapata-easing')),
    fallback
  );
}

export function splitGraphemes(str: string): string[] {
  // Prefer a user-perceived "single character" (emoji / combining marks).
  try {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(seg.segment(str), (s) => s.segment);
    }
  } catch (_) {}
  return Array.from(str);
}

export function parseJsonLoose(raw) {
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

export function normalizePartsFromValue(valueRaw) {
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
