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
  const month = +match[2] - 1;
  const day = +match[3];
  const hours = match[4] ? +match[4] : 0;
  const minutes = match[5] ? +match[5] : 0;
  const seconds = match[6] ? +match[6] : 0;
  const millis = match[7] ? +(match[7] + '00').slice(0, 3) : 0;
  const zone = match[8];

  if (month > 11 || day < 1 || day > 31 || hours > 23 || minutes > 59) {
    return undefined;
  }

  let date: Date;
  if (zone) {
    let offset = 0;
    if (zone !== 'Z') {
      const sign = zone.charAt(0) === '-' ? -1 : 1;
      const digits = zone.replace(/[^\d]/g, '');
      offset = sign * (+digits.slice(0, 2) * 60 + +digits.slice(2, 4));
    }
    date = new Date(
      Date.UTC(year, month, day, hours, minutes, seconds, millis) -
        offset * 60000
    );
  } else {
    date = new Date(year, month, day, hours, minutes, seconds, millis);
  }

  return isNaN(date.getTime()) ? undefined : date;
}

const TOKENS =
  /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|d|HH|H|hh|h|mm|m|A/g;

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
  return pattern.replace(TOKENS, (token: string, literal?: string) => {
    if (literal !== undefined) {
      return literal;
    }
    const hours = date.getHours();
    switch (token) {
      case 'YYYY':
        return String(date.getFullYear());
      case 'YY':
        return String(date.getFullYear()).slice(-2);
      case 'MMMM':
        return locale.months[date.getMonth()];
      case 'MMM':
        return locale.monthsShort[date.getMonth()];
      case 'MM':
        return pad(date.getMonth() + 1);
      case 'M':
        return String(date.getMonth() + 1);
      case 'DD':
        return pad(date.getDate());
      case 'D':
        return String(date.getDate());
      case 'dddd':
        return locale.weekdays[date.getDay()];
      case 'ddd':
        return locale.weekdaysShort[date.getDay()];
      case 'd':
        return String(date.getDay());
      case 'HH':
        return pad(hours);
      case 'H':
        return String(hours);
      case 'hh':
        return pad(hours % 12 || 12);
      case 'h':
        return String(hours % 12 || 12);
      case 'mm':
        return pad(date.getMinutes());
      case 'm':
        return String(date.getMinutes());
      case 'A':
        return locale.meridiem[hours < 12 ? 0 : 1];
      default:
        return token;
    }
  });
}
