import type {
  ClockConfig,
  ClockSchedule,
  ClockScheduleType,
  IsoWeekday,
} from '../../../services/automations.service';
import type { SummaryContext } from '../registry-types';

export const ALL_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
export const MIN_INTERVAL_MINUTES = 5;
export const MAX_INTERVAL_MINUTES = 1440;
export const MAX_TIMES = 48;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isValidTime = (value: unknown): value is string =>
  typeof value === 'string' && TIME_RE.test(value);

export const isValidDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

export const isValidTimeZone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const browserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const pad2 = (value: number) => String(value).padStart(2, '0');

const isInt = (value: unknown, min: number, max: number) =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

/** Today's date as YYYY-MM-DD in the browser time zone. */
export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

export const defaultSchedule = (type: ClockScheduleType): ClockSchedule => {
  switch (type) {
    case 'interval':
      return { type, every_minutes: 15 };
    case 'times':
      return { type, times: ['08:00'] };
    case 'once':
      return { type, date: todayIso(), time: '12:00' };
    default:
      return { type: 'hourly', minute: 0 };
  }
};

export const defaultClockConfig = (): ClockConfig => ({
  schedule: defaultSchedule('hourly'),
  weekdays: null,
  window: null,
  dates: null,
  timezone: null,
});

/** Validates a clock config, mirroring the server rules. */
export const validateClock = (config: ClockConfig): string[] => {
  const errors: string[] = [];
  const schedule = config.schedule;
  const once = schedule?.type === 'once';

  switch (schedule?.type) {
    case 'hourly':
      if (!isInt(schedule.minute, 0, 59))
        errors.push('automations.validation.minute');
      break;
    case 'interval':
      if (
        !isInt(
          schedule.every_minutes,
          MIN_INTERVAL_MINUTES,
          MAX_INTERVAL_MINUTES
        )
      )
        errors.push('automations.validation.interval');
      break;
    case 'times': {
      const times = schedule.times || [];
      if (times.length < 1 || times.length > MAX_TIMES)
        errors.push('automations.validation.timesCount');
      if (times.some((time) => !isValidTime(time)))
        errors.push('automations.validation.time');
      else if (new Set(times).size !== times.length)
        errors.push('automations.validation.timesDuplicate');
      break;
    }
    case 'once':
      if (!isValidDate(schedule.date))
        errors.push('automations.validation.date');
      if (!isValidTime(schedule.time))
        errors.push('automations.validation.time');
      break;
    default:
      errors.push('automations.validation.schedule');
  }

  if (!once && Array.isArray(config.weekdays)) {
    if (
      config.weekdays.length === 0 ||
      config.weekdays.some((day) => !isInt(day, 1, 7))
    )
      errors.push('automations.validation.weekdays');
  }

  if (!once && config.window) {
    const { start, end } = config.window;
    if (!isValidTime(start) || !isValidTime(end) || start >= end)
      errors.push('automations.validation.window');
  }

  if (!once && config.dates) {
    const { start, end } = config.dates;
    if (
      (start && !isValidDate(start)) ||
      (end && !isValidDate(end)) ||
      (!start && !end) ||
      (start && end && start > end)
    )
      errors.push('automations.validation.dates');
  }

  if (config.timezone && !isValidTimeZone(config.timezone))
    errors.push('automations.validation.timezone');

  return errors;
};

/** Removes fields that do not apply to the selected schedule. */
export const normalizeClock = (config: ClockConfig): ClockConfig => {
  const result: ClockConfig = { schedule: config.schedule };
  if (config.schedule.type !== 'once') {
    const weekdays = config.weekdays;
    result.weekdays =
      weekdays && weekdays.length < 7
        ? [...weekdays].sort((a, b) => a - b)
        : null;
    if (config.window) result.window = config.window;
    if (config.dates)
      result.dates = {
        start: config.dates.start || null,
        end: config.dates.end || null,
      };
  }
  if (config.timezone) result.timezone = config.timezone;
  return result;
};

/** Short localized weekday name for an ISO weekday (1 = Monday). */
export const weekdayName = (day: IsoWeekday, locale: string) =>
  // 2024-01-01 was a Monday.
  new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, day))
  );

/**
 * Formats weekdays compactly, e.g. "Mon–Fri" or "Mon, Wed, Fri".
 * Returns null when every day is selected (no restriction).
 */
export const formatWeekdays = (
  weekdays: IsoWeekday[] | null | undefined,
  locale: string
): string | null => {
  if (!weekdays) return null;
  const days = Array.from(new Set(weekdays)).sort((a, b) => a - b);
  if (days.length === 0 || days.length === 7) return null;

  const runs: IsoWeekday[][] = [];
  for (const day of days) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1] === day - 1) run.push(day);
    else runs.push([day]);
  }

  return runs
    .flatMap((run) =>
      run.length >= 3
        ? [
            `${weekdayName(run[0], locale)}–${weekdayName(run[run.length - 1], locale)}`,
          ]
        : run.map((day) => weekdayName(day, locale))
    )
    .join(', ');
};

/** Formats a local YYYY-MM-DD date for display. */
export const formatLocalDate = (value: string, locale: string) => {
  if (!isValidDate(value)) return value;
  const [y, m, d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
};

export const scheduleSummary = (
  schedule: ClockSchedule,
  ctx: SummaryContext
): string => {
  const { t, locale } = ctx;
  switch (schedule.type) {
    case 'hourly':
      return t('automations.summary.hourly', {
        minute: pad2(Number(schedule.minute) || 0),
      });
    case 'interval':
      return t('automations.summary.interval', {
        minutes: schedule.every_minutes,
      });
    case 'times':
      return t('automations.summary.times', {
        times: (schedule.times || []).join(', '),
      });
    case 'once':
      return t('automations.summary.once', {
        date: formatLocalDate(schedule.date, locale),
        time: schedule.time,
      });
    default:
      return t('automations.summary.unknown');
  }
};

/** Plain-language summary, e.g. "Every hour at :08 · Mon–Fri · 08:00–18:00". */
export const clockSummary = (
  config: ClockConfig,
  ctx: SummaryContext
): string => {
  const { t, locale } = ctx;
  const parts = [scheduleSummary(config.schedule, ctx)];

  if (config.schedule?.type !== 'once') {
    const days = formatWeekdays(config.weekdays, locale);
    if (days) parts.push(days);
    if (config.window)
      parts.push(`${config.window.start}–${config.window.end}`);
    const dates = config.dates;
    if (dates?.start && dates?.end)
      parts.push(
        t('automations.summary.dateRange', {
          start: formatLocalDate(dates.start, locale),
          end: formatLocalDate(dates.end, locale),
        })
      );
    else if (dates?.start)
      parts.push(
        t('automations.summary.dateFrom', {
          date: formatLocalDate(dates.start, locale),
        })
      );
    else if (dates?.end)
      parts.push(
        t('automations.summary.dateUntil', {
          date: formatLocalDate(dates.end, locale),
        })
      );
  }

  if (config.timezone) parts.push(config.timezone);
  return parts.join(' · ');
};
