import { formatDate, parseDate } from './date';
import { formatNumber } from './number';
import { localeData } from './locales';

export interface FormatterContext {
  locale?: string;
}

export interface Formatter {
  /** Accepted argument counts: [min, max]. */
  args: [number, number];
  apply(value: unknown, args: string[], context: FormatterContext): unknown;
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '';

const text = (value: unknown) => (isEmpty(value) ? undefined : String(value));

/**
 * The template formatters. Keep this list in sync with
 * `Castmill.Widgets.TemplateBindings` (server-side validation).
 */
export const FORMATTERS: { [name: string]: Formatter } = {
  number: {
    args: [0, 3],
    apply(value, args, context) {
      const locale = localeData(context.locale);
      const decimals =
        args[0] === undefined || args[0] === 'auto' ? 'auto' : +args[0];
      if (decimals !== 'auto' && !(decimals >= 0 && decimals <= 20)) {
        return undefined;
      }
      return formatNumber(
        value,
        decimals,
        args[1] !== undefined ? args[1] : locale.group,
        args[2] !== undefined ? args[2] : locale.decimal
      );
    },
  },
  date: {
    args: [1, 2],
    apply(value, args, context) {
      const date = parseDate(value);
      return date
        ? formatDate(date, args[0], localeData(args[1] || context.locale))
        : undefined;
    },
  },
  timed: {
    args: [0, 0],
    apply(value) {
      const date = parseDate(value);
      return date && (date.getHours() !== 0 || date.getMinutes() !== 0)
        ? value
        : undefined;
    },
  },
  upper: {
    args: [0, 0],
    apply: (value) => text(value)?.toUpperCase(),
  },
  lower: {
    args: [0, 0],
    apply: (value) => text(value)?.toLowerCase(),
  },
  capitalize: {
    args: [0, 0],
    apply(value) {
      const string = text(value);
      return string && string.charAt(0).toUpperCase() + string.slice(1);
    },
  },
  trim: {
    args: [0, 0],
    apply: (value) => text(value)?.trim(),
  },
  truncate: {
    args: [1, 1],
    apply(value, args) {
      const string = text(value);
      const length = +args[0];
      if (string === undefined || !(length >= 0)) {
        return string;
      }
      return string.length > length
        ? string.slice(0, length).replace(/\s+$/, '') + '…'
        : string;
    },
  },
  default: {
    args: [1, 1],
    apply: (value, args) => (isEmpty(value) ? args[0] : value),
  },
};
