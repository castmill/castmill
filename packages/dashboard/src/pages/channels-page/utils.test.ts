import { describe, expect, it } from 'vitest';
import { CalendarEntry } from './calendar-entry.interface';
import { canMoveCalendarEntry, getStartOfWeek } from './utils';

const entry: CalendarEntry = {
  id: 1,
  title: '10:00-11:00',
  playlist: { id: 1, name: 'Playlist' },
  startHour: 10,
  startMinute: 0,
  endHour: 11,
  endMinute: 0,
  dayIndex: 0,
  numDays: 1,
  weekly: false,
};

describe('calendar utilities', () => {
  it('uses the previous Monday as the start of a Sunday week', () => {
    const sunday = new Date(2026, 7, 9, 12);

    expect(getStartOfWeek(sunday)).toEqual(new Date(2026, 7, 3));
  });

  it('rejects moving a multi-day entry beyond the end of the week', () => {
    expect(canMoveCalendarEntry({ ...entry, numDays: 2 }, 6, 10, 0)).toBe(
      false
    );
  });

  it('rejects moves that would truncate an entry at the end of the day', () => {
    expect(canMoveCalendarEntry(entry, 0, 23, 30)).toBe(false);
  });

  it('rejects entries ending at midnight after Sunday', () => {
    expect(canMoveCalendarEntry(entry, 6, 23, 0)).toBe(false);
  });

  it('allows moves that remain within the calendar boundaries', () => {
    expect(canMoveCalendarEntry({ ...entry, numDays: 2 }, 5, 22, 30)).toBe(
      true
    );
  });
});
