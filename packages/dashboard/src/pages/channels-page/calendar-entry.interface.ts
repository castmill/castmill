export interface CalendarEntry {
  id: number;
  title: string;
  playlist: { id: number; name: string };
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  dayIndex: number;
  numDays: number;
  weekly: boolean;
}
