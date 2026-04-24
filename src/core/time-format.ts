import { splitGraphemes } from './utils.ts';

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

export function parseDiffTargetMs(raw) {
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
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return null;
    }
    const ms = dt.getTime();
    return Number.isFinite(ms) ? ms : null;
  }

  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export function clampNonNegativeMs(ms) {
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

export function buildClockPanels(format, date, diffMs, minDigits = 0) {
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

export function clockProbeTextFromFormat(format, minDigits = 0) {
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

export function buildTimerPanels(format, msTotal, minDigits = 0) {
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

export function timerProbeTextFromFormat(format, minDigits = 0) {
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
