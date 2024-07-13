// Type definitions for the DeviceInfo API

interface BlockedPort {
  blockedPort: number;
  direction: 'in' | 'out' | 'all';
  protocol: 'udp' | 'tcp';
}

interface AddBlockedPortListOptions {
  blockedPortList: BlockedPort[];
}

interface DeleteBlockedPortListOptions {
  deleteAll: boolean;
  blockedPortList: BlockedPort[];
}

interface NetworkInfo {
  isInternetConnectionAvailable: boolean;
  wired: WiredNetworkInfo;
  wifi: WirelessNetworkInfo;
}

interface WiredNetworkInfo {
  state: 'connected' | 'disconnected';
  interfaceName?: string;
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  onInternet?: 'yes' | 'no';
  method?: 'dhcp' | 'manual';
  dns1?: string;
  dns2?: string;
  dns3?: string;
  dns4?: string;
  dns5?: string;
  ipv6?: IPv6NetworkInfo;
}

interface IPv6NetworkInfo {
  gateway?: string;
  ipAddress?: string;
  prefixLength?: number;
  method?: 'dhcp' | 'manual';
}

interface WirelessNetworkInfo {
  state: 'connected' | 'disconnected';
  interfaceName?: string;
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  onInternet?: 'yes' | 'no';
  method?: 'dhcp' | 'manual';
  dns1?: string;
  dns2?: string;
  dns3?: string;
  dns4?: string;
  dns5?: string;
}

interface NetworkMacInfo {
  wiredInfo?: {
    macAddress: string;
  };
  wifiInfo?: {
    macAddress: string;
  };
}

interface PlatformInfo {
  modelName: string;
  serialNumber: string;
  firmwareVersion: string;
  hardwareVersion: string;
  sdkVersion: string;
  manufacturer: string;
}

interface ProxyInfo {
  enabled: boolean;
  ipAddress?: string;
  port?: number;
}

interface SensorValues {
  backlight: number;
  checkscreen: {
    colorValid: boolean;
    drawRGB: number;
    hexValue: string;
    readRGB: number;
  };
  fan: {
    closedLoop?: boolean[];
    openLoop?: boolean[];
  };
  humidity: number;
  illuminance: number;
  rotation: string;
  temperature: number;
}

interface EddystoneInfo {
  enabled: boolean;
  frame: 'uid' | 'url';
  frameData: string;
}

interface iBeaconInfo {
  enabled: boolean;
  uuid: string;
  major: number;
  minor: number;
}

interface NetworkCheckupInfo {
  mode: 'default' | 'manual';
  url?: string;
}

interface DeviceInfo {
  addBlockedPortList(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: AddBlockedPortListOptions
  ): void;
  deleteBlockedPortList(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: DeleteBlockedPortListOptions
  ): void;
  getBlockedPortList(
    successCallback: (cbObject: { blockedPortList: BlockedPort[] }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getEddystoneInfo(
    successCallback: (cbObject: EddystoneInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setEddystoneInfo(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: { frame: 'uid' | 'url'; frameData: string }
  ): void;
  getiBeaconInfo(
    successCallback: (cbObject: iBeaconInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setiBeaconInfo(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: { uuid: string; major: number; minor: number }
  ): void;
  getHDBaseTMode(
    successCallback: (cbObject: { HDBaseTMode: 'on' | 'off' }) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getNetworkCheckupInfo(
    successCallback: (cbObject: NetworkCheckupInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setNetworkCheckupInfo(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: NetworkCheckupInfo
  ): void;
  getNetworkInfo(
    successCallback: (cbObject: NetworkInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getNetworkMacInfo(
    successCallback: (cbObject: NetworkMacInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getPlatformInfo(
    successCallback: (cbObject: PlatformInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  getProxyInfo(
    successCallback: (cbObject: ProxyInfo) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
  setProxyInfo(
    successCallback: () => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void,
    options: ProxyInfo
  ): void;
  getSensorValues(
    successCallback: (cbObject: SensorValues) => void,
    errorCallback: (cbObject: { errorCode: number; errorText: string }) => void
  ): void;
}

declare const DeviceInfo: {
  new (): DeviceInfo;
};
