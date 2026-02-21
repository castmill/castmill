export interface DeviceInfo {
  appType: string; // Electron, Android, iOS, etc.
  appVersion: string; // 0.0.0-todo-hardcode
  os: string; // OS e.g. LG WebOs 3.2, Android 8, Linux Raspbian 3, Windows 11, etc.
  hardware: string; // E.g. LG 52XS4FMC
  environmentVersion?: string; // The version of the environment e.g. Electron v28.0.0
  chromiumVersion?: string; // The version of the chromium engine e.g. 98.0.4758.102
  v8Version?: string; // The version of the V8 engine if available e.g. 9.8.0
  nodeVersion?: string; // The version of the Node.js if available e.g. 16.13.0
  userAgent: string; // The user agent string
}

/**
 * Possible values for the weekDays property of the TimerEntry interface. "all" means
 * that the timer should be active every day of the week.
 */
export type WeekDay =
  | 'MON'
  | 'TUE'
  | 'WED'
  | 'THU'
  | 'FRI'
  | 'SAT'
  | 'SUN'
  | 'ALL';

/**
 * Represents a timer entry. The timer entry is used to turn the device on or off
 * at specific times. The hours and minutes properties represent the time at which
 * the device should be turned on or off. The weekDays property represents the days
 * of the week when the timer should be active.
 */
export interface TimerEntry {
  hours: number;
  minutes: number;
  weekDays: WeekDay[];
}

/**
 * Represents the timers set on the device. The on property represents the timers
 * that turn the device on at specific times. The off property represents the timers
 * that turn the device off at specific times.
 */
export interface Timers {
  on: TimerEntry[];
  off: TimerEntry[];
}

/**
 * Telemetry data collected from the device hardware.
 * All properties are optional since availability varies by platform.
 */
export interface TelemetryData {
  /** Storage usage information */
  storage?: {
    totalBytes: number;
    usedBytes: number;
  };

  /** Memory (RAM) usage information */
  memory?: {
    totalBytes: number;
    usedBytes: number;
  };

  /** Current CPU usage as a percentage (0-100) */
  cpuUsagePercent?: number;

  /** CPU load averages (1, 5, and 15 minute intervals) */
  cpuLoadAvg?: {
    one: number;
    five: number;
    fifteen: number;
  };

  /** Temperature readings from various sensors */
  temperatures?: Array<{
    label: string;
    celsius: number;
  }>;

  /** Fan speed readings */
  fanSpeeds?: Array<{
    label: string;
    rpm: number;
  }>;

  /** Network connection information */
  network?: {
    type?: string;
    wifiSignalStrengthPercent?: number;
    ssid?: string;
    ipAddress?: string;
  };

  /** Battery information (for portable/tablet devices) */
  battery?: {
    levelPercent: number;
    isCharging: boolean;
  };

  /** System uptime in seconds */
  uptimeSeconds?: number;
}

// The keys of the settings that the machine can store. For type safety defined
// as a union type.
export type SettingKey = 'BASE_URL'; // Add more keys as needed

export interface Machine {
  /**
   * Get the the value of the setting with the given key.
   */
  getSetting(key: SettingKey): Promise<string | null>;

  /**
   * Set the value of the setting with the given key.
   */
  setSetting(key: SettingKey, value: string): Promise<void>;

  /**
   * Returns the machine's unique identifier.
   *
   * This ID must be unique across all machines. And the call to this
   * method should always return the same value for a given machine.
   *
   * A good way to generate this ID is to use the machine's MAC address.
   * Whatever this method will return it will always be properly hashed before
   * being sent to the server to avoid leaking the machine's ID.
   *
   */
  getMachineGUID(): Promise<string>;

  /**
   *
   * Store the credentials in a secure location on the device.
   *
   * When a device is registered, the server will send back a set of credentials
   * that are necessary for the device to connect to the server and receive
   * content and configuration updates.
   *
   * @param credentials
   *
   */
  storeCredentials(credentials: string): Promise<void>;

  /**
   *  Returns the credentials stored on the device.
   *
   */
  getCredentials(): Promise<string | null>;

  /**
   * Remove the credentials from the device.
   */
  removeCredentials(): Promise<void>;

  /**
   * Returns the machine's location as a latitude and longitude
   * float numbers.
   */
  getLocation?(): Promise<
    | undefined
    | {
        latitude: number;
        longitude: number;
      }
  >;

  /**
   * Returns the machine's timezone identifier as a string.
   * Examples:
   *  "America/New_York"
   *  "Europe/Paris"
   *  "Asia/Tokyo"
   *  "Australia/Sydney"
   *  "Pacific/Auckland"
   */
  getTimezone?(): Promise<string>;

  /**
   * Returns the device information, such as the software and hardware versions.
   */
  getDeviceInfo(): Promise<DeviceInfo>;

  /**
   * Restart the device application.
   */
  restart?(): Promise<void>;

  /**
   * Quit the device application.
   */
  quit?(): Promise<void>;

  /**
   * Reboot the device. This should perform a clean hardware reboot of the device.
   *
   */
  reboot?(): Promise<void>;

  /**
   * Shutdown the device. This should perform a clean hardware shutdown of the device.
   * i.e. after this method is called the device should be completely powered off.
   */
  shutdown?(): Promise<void>;

  /**
   * Updates the device's application.
   */
  update?(): Promise<void>;

  /**
   * Updates the device's firmware.
   */
  updateFirmware?(): Promise<void>;

  /**
   * Returns the current timers set on the device. The timers are used to turn the
   * device on and off at specific times.
   */
  getTimers?(): Promise<Timers>;

  /**
   * Set the timers on the device. The timers are used to turn the device on and off
   * at specific times.
   */
  setTimers?(timers: Timers): Promise<void>;

  /**
   * Returns telemetry data from the device hardware, including storage, memory,
   * CPU usage, temperatures, fan speeds, network info, battery status, and uptime.
   * Availability of data varies by platform.
   */
  getTelemetry?(): Promise<TelemetryData>;
}
