import { toZonedTime } from 'date-fns-tz';

/** A point in time (e.g. an automation firing) drawn on the weekly calendar. */
export interface CalendarMarker {
  /** Epoch milliseconds. */
  time: number;
  /** Accessible/tooltip label. */
  label: string;
}

export interface MarkerPosition {
  /** 0..6 relative to the start of the visible week. */
  dayIndex: number;
  /** Minutes since midnight in the calendar time zone. */
  minutes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes where a marker falls in a week that starts at `weekStart`
 * (a "zoned" date as produced by `toZonedTime`). Returns null when the
 * marker is outside the visible week.
 */
export const markerPosition = (
  time: number,
  weekStart: Date,
  timeZone: string
): MarkerPosition | null => {
  const zoned = toZonedTime(new Date(time), timeZone);
  const dayIndex = Math.round(
    (Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate()) -
      Date.UTC(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate()
      )) /
      DAY_MS
  );
  if (dayIndex < 0 || dayIndex > 6) {
    return null;
  }
  return { dayIndex, minutes: zoned.getHours() * 60 + zoned.getMinutes() };
};

/**
 * Absolute style of a marker tick for the given cell height (px). `column`
 * and `columns` locate the day among the visible day columns (7 in the week
 * view, 1 in the phone day view). Horizontal placement uses logical
 * properties and the calendar's `--time-col-width` so it also works in RTL.
 */
export const markerStyle = (
  position: MarkerPosition,
  cellHeight: number,
  column: number = position.dayIndex,
  columns: number = 7
) => {
  const days = '(100% - var(--time-col-width))';
  return {
    top: `${(position.minutes / 1440) * 48 * cellHeight}px`,
    'inset-inline-start': `calc(var(--time-col-width) + ${days} * ${column} / ${columns})`,
    width: `calc(${days} / ${columns})`,
  };
};
