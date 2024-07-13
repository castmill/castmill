// Time.d.ts

interface Time {
  getHolidaySchedule(
    successCallback: (cbObject: GetHolidayScheduleResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  setHolidaySchedule(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SetHolidayScheduleOptions
  ): void;
  unsetHolidaySchedule(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface GetHolidayScheduleResponse {
  holidayScheduleList: HolidaySchedule[];
}

interface HolidaySchedule {
  _id?: string;
  name?: string;
  settings?: HolidaySettings;
}

interface HolidaySettings {
  year?: number;
  month?: number;
  date?: number;
  days?: number;
  repeat?: 'monthly' | 'yearly' | 'none';
  repeatBy?: 'dayOfWeek' | 'dayOfMonth' | 'none';
}

interface SetHolidayScheduleOptions {
  holidaySchedule: HolidaySchedule[];
}

declare const Time: {
  new (): Time;
};
