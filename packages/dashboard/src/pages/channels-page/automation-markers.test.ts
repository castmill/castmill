import { describe, expect, it } from 'vitest';
import { toZonedTime } from 'date-fns-tz';
import { markerPosition, markerStyle } from './automation-markers';
import { getStartOfWeek } from './utils';

describe('automation markers', () => {
  const tz = 'Europe/Stockholm';
  // Monday 2026-01-05 (local Stockholm time).
  const weekStart = getStartOfWeek(
    toZonedTime(new Date('2026-01-07T12:00:00Z'), tz)
  );

  it('positions a firing by day and minute in the calendar time zone', () => {
    // 2026-01-07 08:08 UTC is 09:08 in Stockholm on Wednesday.
    const position = markerPosition(
      Date.parse('2026-01-07T08:08:00Z'),
      weekStart,
      tz
    );
    expect(position).toEqual({
      dayIndex: (new Date(2026, 0, 7).getDay() - weekStart.getDay() + 7) % 7,
      minutes: 9 * 60 + 8,
    });
  });

  it('returns null outside the visible week', () => {
    expect(
      markerPosition(Date.parse('2025-12-20T08:00:00Z'), weekStart, tz)
    ).toBeNull();
    expect(
      markerPosition(Date.parse('2026-02-20T08:00:00Z'), weekStart, tz)
    ).toBeNull();
  });

  it('computes the absolute style of a marker', () => {
    expect(markerStyle({ dayIndex: 0, minutes: 0 }, 20)).toEqual({
      top: '0px',
      'inset-inline-start':
        'calc(var(--time-col-width) + (100% - var(--time-col-width)) * 0 / 7)',
      width: 'calc((100% - var(--time-col-width)) / 7)',
    });
    const style = markerStyle({ dayIndex: 2, minutes: 720 }, 20);
    expect(style.top).toBe('480px');
    expect(style['inset-inline-start']).toBe(
      'calc(var(--time-col-width) + (100% - var(--time-col-width)) * 2 / 7)'
    );
  });

  it('places a marker in a single-day column', () => {
    const style = markerStyle({ dayIndex: 4, minutes: 60 }, 30, 0, 1);
    expect(style.top).toBe('60px');
    expect(style['inset-inline-start']).toBe(
      'calc(var(--time-col-width) + (100% - var(--time-col-width)) * 0 / 1)'
    );
    expect(style.width).toBe('calc((100% - var(--time-col-width)) / 1)');
  });
});
