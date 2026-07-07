type CodePointRanges = number[][];

interface RangesSource {
  type: 'ranges';
  ranges: CodePointRanges;
  blank: string;
}

interface SetSource {
  type: 'set';
  chars: string[];
  blank: string;
}

type RandomSource = RangesSource | SetSource;

const HALF_SPACE_RANGE = [0x0020, 0x0020];
const FULL_SPACE_RANGE = [0x3000, 0x3000];

const HALF_DIGIT_RANGES: CodePointRanges = [[0x0030, 0x0039], HALF_SPACE_RANGE];
const HALF_UPPER_RANGES: CodePointRanges = [[0x0041, 0x005A], HALF_SPACE_RANGE];
const HALF_LOWER_RANGES: CodePointRanges = [[0x0061, 0x007A], HALF_SPACE_RANGE];
const HALF_ALL_RANGES: CodePointRanges = [
  [0x0030, 0x0039],
  [0x0041, 0x005A],
  [0x0061, 0x007A],
  HALF_SPACE_RANGE,
];

const FULL_HIRA_RANGES: CodePointRanges = [[0x3041, 0x3096], FULL_SPACE_RANGE];
const FULL_KATA_RANGES: CodePointRanges = [[0x30A1, 0x30FA], FULL_SPACE_RANGE];
const FULL_DIGIT_RANGES: CodePointRanges = [[0xFF10, 0xFF19], FULL_SPACE_RANGE];

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

const SRC_HALF_DIGIT: RandomSource = { type: 'ranges', ranges: HALF_DIGIT_RANGES, blank: ' ' };
const SRC_HALF_UPPER: RandomSource = { type: 'ranges', ranges: HALF_UPPER_RANGES, blank: ' ' };
const SRC_HALF_LOWER: RandomSource = { type: 'ranges', ranges: HALF_LOWER_RANGES, blank: ' ' };
const SRC_HALF_ALL: RandomSource = { type: 'ranges', ranges: HALF_ALL_RANGES, blank: ' ' };

const SRC_FULL_HIRA: RandomSource = { type: 'ranges', ranges: FULL_HIRA_RANGES, blank: '　' };
const SRC_FULL_KATA: RandomSource = { type: 'ranges', ranges: FULL_KATA_RANGES, blank: '　' };
const SRC_FULL_DIGIT: RandomSource = { type: 'ranges', ranges: FULL_DIGIT_RANGES, blank: '　' };

const SRC_CJK: RandomSource = { type: 'set', chars: CJK_KANJI_WITH_SPACE, blank: '　' };
const SRC_FULLWIDTH_FALLBACK: RandomSource = { type: 'set', chars: RANDOM_FULLWIDTH_FALLBACK, blank: '　' };

const isCjkIdeograph = (cp: number) => (cp >= 0x4e00 && cp <= 0x9fff);
const isInRanges = (cp: number, ranges: CodePointRanges) => {
  for (const [a, b] of ranges) {
    if (cp >= a && cp <= b) {
      return true;
    }
  }
  return false;
};

const isHalfwidthAscii = (cp: number) => (cp >= 0x0020 && cp <= 0x007e);

const randomIntInclusive = (min: number, max: number): number => {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  if (b < a) {
    return a;
  }
  return a + Math.floor(Math.random() * (b - a + 1));
};

const randomCharFromRanges = (ranges: CodePointRanges): string => {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return '';
  }
  for (let attempts = 0; attempts < 3; attempts++) {
    const picked = ranges[Math.floor(Math.random() * ranges.length)];
    if (!Array.isArray(picked) || picked.length < 2) {
      continue;
    }
    const a0 = picked[0];
    const b0 = picked[1];
    if (typeof a0 !== 'number' || typeof b0 !== 'number') {
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

    a = Math.min(0x10ffff, Math.max(0, a));
    b = Math.min(0x10ffff, Math.max(0, b));
    if (b < a) {
      continue;
    }

    const cp = a + Math.floor(Math.random() * (b - a + 1));
    try {
      return String.fromCodePoint(cp);
    } catch {
    }
  }
  return '';
};

const RandomText = {
  pickSourceForChar: (ch: string): RandomSource | null => {
    if (!ch) {
      return null;
    }
    const cp = ch.codePointAt(0);
    if (typeof cp !== 'number') {
      return null;
    }

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

  hasAnyFullwidth: (str: string): boolean => {
    const s = String(str || '');
    for (const ch of s) {
      const cp = ch.codePointAt(0);
      if (typeof cp !== 'number') {
        continue;
      }
      if (!isHalfwidthAscii(cp)) {
        return true;
      }
    }
    return false;
  },

  pickSourceForAtomicString: (str: string): RandomSource => {
    if (RandomText.hasAnyFullwidth(str)) {
      return SRC_FULLWIDTH_FALLBACK;
    }
    return SRC_HALF_ALL;
  },

  randomCharFromSource: (source: RandomSource | null): string => {
    if (!source) {
      return '';
    }
    if (source.type === 'ranges') return randomCharFromRanges(source.ranges);
    if (source.type === 'set') {
      const arr = Array.isArray(source.chars) ? source.chars : [];
      if (!arr.length) {
        return '';
      }
      const v = arr[Math.floor(Math.random() * arr.length)];
      return typeof v === 'string' && v ? v : '';
    }
    return '';
  },

  blankForSource: (source: RandomSource | null): string => {
    return source ? source.blank : '';
  },
};

export type { RandomSource };
export { randomIntInclusive, RandomText };
