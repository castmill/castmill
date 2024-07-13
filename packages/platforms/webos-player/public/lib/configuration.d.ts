// Configuration.d.ts

interface Configuration {
  clearCache(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getCurrentTime(
    successCallback: (cbObject: CurrentTime) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getLocaleList(
    successCallback: (cbObject: LocaleList) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getMasterPinStatus(
    successCallback: (cbObject: MasterPinStatus) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getOSDLanguage(
    successCallback: (cbObject: OSDLanguage) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getOSDLock(
    successCallback: (cbObject: OSDLock) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPictureMode(
    successCallback: (cbObject: PictureMode) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPictureProperty(
    successCallback: (cbObject: PictureProperty) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getProperty(
    successCallback: (cbObject: Property) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: PropertyOptions
  ): void;
  getProxyBypassList(
    successCallback: (cbObject: ProxyBypassList) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getServerProperty(
    successCallback: (cbObject: ServerProperty) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getTimeZone(
    successCallback: (cbObject: TimeZone) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getTimeZoneList(
    successCallback: (cbObject: TimeZoneList) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getUSBLock(
    successCallback: (cbObject: USBLock) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getVirtualKeyboardLanguage(
    successCallback: (cbObject: VirtualKeyboardLanguage) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  restartApplication(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setCurrentTime(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: CurrentTime
  ): void;
  setMasterPinStatus(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: MasterPinStatus
  ): void;
  setOSDLanguage(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: OSDLanguage
  ): void;
  setOSDLock(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: OSDLock
  ): void;
  setPictureMode(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: PictureMode
  ): void;
  setPictureProperty(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: PictureProperty
  ): void;
  setProperty(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: PropertyOptions
  ): void;
  setProxyBypassList(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: ProxyBypassList
  ): void;
  setServerProperty(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: ServerProperty
  ): void;
  setTimeZone(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: TimeZone
  ): void;
  setUSBLock(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: USBLock
  ): void;
  setVirtualKeyboardLanguage(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: VirtualKeyboardLanguage
  ): void;
}

interface CurrentTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  sec: number;
  ntp?: boolean;
  ntpServerAddress?: string;
}

interface LocaleList {
  localeList: {
    language: string;
    languageCode: string;
    countries: {
      name: string;
      specifier: string;
    }[];
  }[];
}

interface MasterPinStatus {
  activated: boolean;
}

interface OSDLanguage {
  specifier: string;
}

interface OSDLock {
  enabled: boolean;
}

interface PictureMode {
  mode: string;
}

interface PictureProperty {
  backlight?: number;
  contrast?: number;
  brightness?: number;
  sharpness?: number;
  hSharpness?: number;
  vSharpness?: number;
  color?: number;
  tint?: number;
  colorTemperature?: number;
  dynamicContrast?: 'off' | 'low' | 'medium' | 'high';
  superResolution?: 'off' | 'low' | 'medium' | 'high';
  colorGamut?: 'normal' | 'extended';
  dynamicColor?: 'off' | 'low' | 'medium' | 'high';
  noiseReduction?: 'auto' | 'off' | 'low' | 'medium' | 'high';
  mpegNoiseReduction?: 'auto' | 'off' | 'low' | 'medium' | 'high';
  blackLevel?: 'low' | 'high';
  gamma?: 'low' | 'medium' | 'high' | 'high3';
}

interface PropertyOptions {
  keys: string;
  alias?: string;
  key_delivery_to_simplink?: string;
  cec_device_control?: string;
}

interface Property {
  deviceName?: string;
  key_delivery_to_simplink?: string;
  cec_device_control?: string;
}

interface ProxyBypassList {
  urlList: string[];
}

interface ServerProperty {
  serverIp: string;
  serverPort: number;
  secureConnection: boolean;
  appLaunchMode: string;
  appType?: string;
  fqdnMode: boolean;
  fqdnAddr: string;
}

interface TimeZone {
  timeZone: {
    continent: string;
    country: string;
    city: string;
  };
}

interface TimeZoneList {
  timeZone: {
    continent: string;
    country: string;
    city: string;
  }[];
}

interface USBLock {
  enabled: boolean;
}

interface VirtualKeyboardLanguage {
  languageCodeList: string[];
}

declare const Configuration: {
  new (): Configuration;
  AppMode: {
    LOCAL: 'local';
    REMOTE: 'remote';
    USB: 'usb';
  };
  AppType: {
    IPK: 'IPK';
    ZIP: 'ZIP';
  };
  PictureMode: {
    APS: 'eco';
    CINEMA: 'cinema';
    EXPERT1: 'expert1';
    EXPERT2: 'expert2';
    GAME: 'game';
    SPORTS: 'sports';
    STANDARD: 'normal';
    VIVID: 'vivid';
  };
};

// export default Configuration;
