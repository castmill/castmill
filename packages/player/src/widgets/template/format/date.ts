import { LocaleData } from './locales';

// "2026-11-12", "2026-11-12T17:00", "2026-11-12 17:00:30.250+01:00", "…Z"
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Parses a date value: epoch milliseconds, a Date, or an ISO 8601 string.
 *
 * Strings are parsed by hand: ES5 engines (Chrome 38) read
 * "2026-11-12T17:00" as UTC while newer engines read it as local time.
 * Here, values without an offset are always wall-clock local time and values
 * with an offset are converted to local time.
 */
export function parseDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'number') {
    return isFinite(value) ? new Date(value) : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = ISO_DATE.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const year = +match[1];
  const month = +match[2];
  const day = +match[3];
  const hours = match[4] ? +match[4] : 0;
  const minutes = match[5] ? +match[5] : 0;
  const seconds = match[6] ? +match[6] : 0;
  const millis = match[7] ? +(match[7] + '00').slice(0, 3) : 0;
  const zone = match[8];

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return undefined;
  }

  let date: Date;
  if (zone) {
    let offset = 0;
    if (zone !== 'Z') {
      const sign = zone.charAt(0) === '-' ? -1 : 1;
      const digits = zone.replace(/[^\d]/g, '');
      const offsetHours = +digits.slice(0, 2);
      const offsetMinutes = +digits.slice(2, 4);
      if (offsetHours > 23 || offsetMinutes > 59) {
        return undefined;
      }
      offset = sign * (offsetHours * 60 + offsetMinutes);
    }
    date = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, seconds, millis) -
        offset * 60000
    );
  } else {
    date = new Date(year, month - 1, day, hours, minutes, seconds, millis);
  }

  return isNaN(date.getTime()) ? undefined : date;
}

const TOKENS = [
  'YYYY',
  'MMMM',
  'dddd',
  'MMM',
  'ddd',
  'YY',
  'MM',
  'DD',
  'HH',
  'hh',
  'mm',
  'M',
  'D',
  'd',
  'H',
  'h',
  'm',
  'A',
];

const pad = (value: number) => (value < 10 ? '0' : '') + value;

/**
 * Formats a date with a moment.js-compatible subset of tokens:
 * YYYY YY M MM MMM MMMM D DD d ddd dddd H HH h hh m mm A, and [literal] text.
 */
export function formatDate(
  date: Date,
  pattern: string,
  locale: LocaleData
): string {
  const lastClosingBracket = pattern.lastIndexOf(']');
  const hours = date.getHours();
  const result: string[] = [];
  let index = 0;

  while (index < pattern.length) {
    if (pattern.charAt(index) === '[' && index <= lastClosingBracket) {
      const closingBracket = pattern.indexOf(']', index + 1);
      if (closingBracket !== -1) {
        result.push(pattern.slice(index + 1, closingBracket));
        index = closingBracket + 1;
        continue;
      }
    }

    let token: string | undefined;
    for (let i = 0; i < TOKENS.length; i++) {
      const candidate = TOKENS[i];
      if (pattern.substr(index, candidate.length) === candidate) {
        token = candidate;
        break;
      }
    }

    if (!token) {
      result.push(pattern.charAt(index));
      index++;
      continue;
    }

    switch (token) {
      case 'YYYY':
        result.push(String(date.getFullYear()));
        break;
      case 'YY':
        result.push(String(date.getFullYear()).slice(-2));
        break;
      case 'MMMM':
        result.push(locale.months[date.getMonth()]);
        break;
      case 'MMM':
        result.push(locale.monthsShort[date.getMonth()]);
        break;
      case 'MM':
        result.push(pad(date.getMonth() + 1));
        break;
      case 'M':
        result.push(String(date.getMonth() + 1));
        break;
      case 'DD':
        result.push(pad(date.getDate()));
        break;
      case 'D':
        result.push(String(date.getDate()));
        break;
      case 'dddd':
        result.push(locale.weekdays[date.getDay()]);
        break;
      case 'ddd':
        result.push(locale.weekdaysShort[date.getDay()]);
        break;
      case 'd':
        result.push(String(date.getDay()));
        break;
      case 'HH':
        result.push(pad(hours));
        break;
      case 'H':
        result.push(String(hours));
        break;
      case 'hh':
        result.push(pad(hours % 12 || 12));
        break;
      case 'h':
        result.push(String(hours % 12 || 12));
        break;
      case 'mm':
        result.push(pad(date.getMinutes()));
        break;
      case 'm':
        result.push(String(date.getMinutes()));
        break;
      case 'A':
        result.push(locale.meridiem[hours < 12 ? 0 : 1]);
        break;
    }

    index += token.length;
  }

  return result.join('');
}
