import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { CalendarEntry } from './calendar-entry.interface';
import { JsonChannelEntry } from '../../services/channels.service';

export function calendarEntryToTimestamps(
  entry: CalendarEntry,
  baseDate: Date,
  timeZone: string
): { start: number; end: number } {
  // Create start date in the calendar's time zone
  const startDate = new Date(baseDate);
  startDate.setDate(startDate.getDate() + entry.dayIndex);
  startDate.setHours(entry.startHour, entry.startMinute, 0, 0);

  // Convert local time to UTC
  const startUtc = fromZonedTime(startDate, timeZone);

  // Create end date in the calendar's time zone
  const endDate = new Date(baseDate);
  endDate.setDate(endDate.getDate() + entry.dayIndex + (entry.numDays - 1));
  endDate.setHours(entry.endHour, entry.endMinute, 0, 0);

  // Convert local time to UTC
  const endUtc = fromZonedTime(endDate, timeZone);

  // Return Unix timestamps in seconds
  return {
    start: Math.floor(startUtc.getTime()),
    end: Math.floor(endUtc.getTime()),
  };
}

export function timestampsToCalendarEntry(
  dbEntry: JsonChannelEntry,
  timezone: string
): CalendarEntry {
  // Convert UTC timestamps to zoned time
  const startDate = toZonedTime(new Date(dbEntry.start), timezone);
  const endDate = toZonedTime(new Date(dbEntry.end), timezone);

  // Calculate week dayIndex and number of days the entry spans
  const startDayIndex = (startDate.getDay() + 6) % 7;
  const endDayIndex = (endDate.getDay() + 6) % 7;

  const numDays = endDayIndex - startDayIndex + 1;

  // Extract local hours and minutes
  const startHour = startDate.getHours();
  const startMinute = startDate.getMinutes();
  const endHour = endDate.getHours();
  const endMinute = endDate.getMinutes();

  // Generate title based on local time
  const title = `${startHour.toString().padStart(2, '0')}:${startMinute
    .toString()
    .padStart(2, '0')}-${endHour.toString().padStart(2, '0')}:${endMinute
    .toString()
    .padStart(2, '0')}`;

  return {
    id: dbEntry.id,
    title,
    playlist: { id: dbEntry.playlist_id, name: 'test' },
    startHour,
    startMinute,
    endHour,
    endMinute,
    dayIndex: startDayIndex,
    numDays,
    weekly: dbEntry.repeat_weekly_until !== null,
  };
}
