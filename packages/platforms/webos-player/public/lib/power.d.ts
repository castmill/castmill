// Power.d.ts

interface Power {
  addOffTimer?(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: AddOffTimerOptions
  ): void;
  addOnTimer?(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: AddOnTimerOptions
  ): void;
  deleteOffTimer(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: DeleteOffTimerOptions
  ): void;
  deleteOnTimer(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: DeleteOnTimerOptions
  ): void;
  // webos < 4, scap 1.5
  enableAllOffTimer?(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: EnableAllOffTimerOptions
  ): void;
  // webos < 4, scap 1.5
  enableAllOnTimer?(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: EnableAllOnTimerOptions
  ): void;
  enableWakeOnLan(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: EnableWakeOnLanOptions
  ): void;
  executePowerCommand(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: ExecutePowerCommandOptions
  ): void;
  getDPMWakeup(
    successCallback: (cbObject: { dpmSignalType: string }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getOffTimerList(
    successCallback: (cbObject: { timerList: TimerList[] }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getOnOffTimeSchedule(
    successCallback: (cbObject: {
      onOffTimeScheduleList: OnOffTimeSchedule[];
    }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getOnTimerList(
    successCallback: (cbObject: { timerList: TimerList[] }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPMMode(
    successCallback: (cbObject: { mode: string }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPowerOnDelay(
    successCallback: (cbObject: { delayTime: number }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPowerStatus(
    successCallback: (cbObject: PowerStatus) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setDisplayMode(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: SetDisplayModeOptions
  ): void;
  setDPMWakeup(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: SetDPMWakeupOptions
  ): void;
  setOnOffTimeSchedule(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: SetOnOffTimeScheduleOptions
  ): void;
  setPMMode(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: SetPMModeOptions
  ): void;
  setPowerOnDelay(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: SetPowerOnDelayOptions
  ): void;
  unsetOnOffTimeSchedule(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
}

interface AddOffTimerOptions {
  hour: number; // Range: [0–23]
  minute: number; // Range: [0–59]
  week: number; // Combination of Power.TimerWeek values
}

interface AddOnTimerOptions {
  hour: number; // Range: [0–23]
  minute: number; // Range: [0–59]
  week: number; // Combination of Power.TimerWeek values
  inputSource: string; // e.g., "ext://hdmi:1"
}

interface DeleteOffTimerOptions {
  hour: number; // Range: [0–23]
  minute: number; // Range: [0–59]
  week: number; // Combination of Power.TimerWeek values
}

interface DeleteOnTimerOptions {
  hour: number; // Range: [0–23]
  minute: number; // Range: [0–59]
  week: number; // Combination of Power.TimerWeek values
  inputSource: string; // e.g., "ext://hdmi:1"
}

interface EnableAllOffTimerOptions {
  allOffTimer: boolean;
  clearOffTimer?: boolean;
}

interface EnableAllOnTimerOptions {
  allOnTimer: boolean;
  clearOnTimer?: boolean;
}

interface EnableWakeOnLanOptions {
  wakeOnLan: boolean;
}

interface ExecutePowerCommandOptions {
  powerCommand: 'reboot' | 'powerOff';
}

interface TimerList {
  hour: number; // Range: [0–23]
  minute: number; // Range: [0–59]
  week: number; // Combination of Power.TimerWeek values
  inputSource?: string; // e.g., "ext://hdmi:1"
}

interface OnOffTimeSchedule {
  _id?: string;
  day: string; // Range: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  onTime: {
    hour: number; // Range: [0–23]
    minute: number; // Range: [0–59]
  };
  offTime: {
    hour: number; // Range: [0–23]
    minute: number; // Range: [0–59]
  };
}

interface PowerStatus {
  wakeOnLan: boolean;
  displayMode: string; // e.g., "Active", "Screen Off"
  allOffTimer: boolean;
  allOnTimer: boolean;
}

interface SetDisplayModeOptions {
  displayMode: string; // e.g., "Screen Off", "Active"
}

interface SetDPMWakeupOptions {
  dpmSignalType: string; // e.g., "clock", "clockAndData"
}

interface SetOnOffTimeScheduleOptions {
  onOffTimeSchedule: OnOffTimeSchedule[];
}

interface SetPMModeOptions {
  mode: string; // e.g., "powerOff", "screenOff", "screenOffAlways", "screenOffBacklight", "sustainAspectRatio"
}

interface SetPowerOnDelayOptions {
  delayTime: number; // Range: [0-250]
}

declare const Power: {
  new (): Power;
  DisplayMode: {
    DISPLAY_OFF: string;
    DISPLAY_ON: string;
  };
  DPMSignalType: {
    CLOCK: string;
    CLOCK_WITH_DATA: string;
  };
  PMMode: {
    PowerOff: string;
    ScreenOff: string;
    ScreenOffAlways: string;
    ScreenOffBacklight: string;
    SustainAspectRatio: string;
  };
  PowerCommand: {
    REBOOT: string;
    SHUTDOWN: string;
  };
  TimerWeek: {
    MONDAY: number;
    TUESDAY: number;
    WEDNESDAY: number;
    THURSDAY: number;
    FRIDAY: number;
    SATURDAY: number;
    SUNDAY: number;
    EVERYDAY: number;
  };
};
