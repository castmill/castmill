// Signage.d.ts

interface Signage {
  addKeyItem(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: KeyItemOptions
  ): void;
  captureScreen(
    successCallback: (cbObject: CaptureScreenResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: CaptureScreenOptions
  ): void;
  clearKeyTable(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  enableCheckScreen(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: CheckScreenOptions
  ): void;
  getFailoverMode(
    successCallback: (cbObject: FailoverModeResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getIntelligentAuto(
    successCallback: (cbObject: IntelligentAutoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getLanDaisyChain(
    successCallback: (cbObject: LanDaisyChainResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getMirrorMode(
    successCallback: (cbObject: MirrorModeResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getNoSignalImageMode(
    successCallback: (cbObject: NoSignalImageModeResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getPowerSaveMode(
    successCallback: (cbObject: PowerSaveModeResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getSignageInfo(
    successCallback: (cbObject: SignageInfoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getSimplinkStatus(
    successCallback: (cbObject: SimplinkStatusResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getSystemMonitoringInfo(
    successCallback: (cbObject: SystemMonitoringInfoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getTileInfo(
    successCallback: (cbObject: TileInfoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getUsageData(
    successCallback: (cbObject: UsageDataResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getUsagePermission(
    successCallback: (cbObject: UsagePermissionResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  registerRS232CEventListener(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: RS232CEventListenerOptions
  ): void;
  registerSystemMonitor(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SystemMonitorOptions
  ): void;
  removeKeyItem(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: KeyItemOptions
  ): void;
  resetNoSignalImage(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  sendKey(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SendKeyOptions
  ): void;
  setDigitalAudioInputMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: DigitalAudioInputOptions
  ): void;
  setFailoverMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: FailoverModeOptions
  ): void;
  setIntelligentAuto(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: IntelligentAutoOptions
  ): void;
  setIsmMethod(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: IsmMethodOptions
  ): void;
  setLanDaisyChain(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: LanDaisyChainOptions
  ): void;
  setMirrorMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: MirrorModeOptions
  ): void;
  setNoSignalImageMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: NoSignalImageModeOptions
  ): void;
  setPortraitMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: PortraitModeOptions
  ): void;
  setPowerSaveMode(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: PowerSaveModeOptions
  ): void;
  setSimplinkStatus(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: SimplinkStatusOptions
  ): void;
  setTileInfo(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: TileInfoOptions
  ): void;
  setUsagePermission(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: UsagePermissionOptions
  ): void;
  unregisterRS232CEventListener(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  unregisterSystemMonitor(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  updateNoSignalImageList(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: UpdateNoSignalImageListOptions
  ): void;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface KeyItemOptions {
  keyCode: number;
  virtualKeyCode?: number;
  attribute?: number;
}

interface CaptureScreenOptions {
  save?: boolean;
  thumbnail?: boolean;
  imgResolution?: string;
}

interface CaptureScreenResponse {
  data: string;
  size: number;
  encoding: string;
}

interface CheckScreenOptions {
  checkScreen: boolean;
}

interface FailoverModeResponse {
  mode: string;
  priority: string[];
}

interface IntelligentAutoResponse {
  enabled: boolean;
}

interface LanDaisyChainResponse {
  enabled: boolean;
}

interface MirrorModeResponse {
  mode: string;
}

interface NoSignalImageModeResponse {
  noSignalImage: string;
}

interface PowerSaveModeResponse {
  ses: boolean;
  dpmMode: string;
  automaticStandby: string;
  do15MinOff: boolean;
}

interface SignageInfoResponse {
  portraitMode: string;
  digitalAudioInputMode: string;
  ismMethod: string;
  checkScreen: boolean;
}

interface SimplinkStatusResponse {
  simplinkEnable: string;
}

interface SystemMonitoringInfoResponse {
  fan: boolean;
  signal: boolean;
  lamp: boolean;
  screen: boolean;
  temperature: boolean;
}

interface TileInfoResponse {
  enabled: boolean;
  row: number;
  column: number;
  tileId: number;
  naturalMode: boolean;
}

interface UsageDataResponse {
  uptime: number;
  totalUsed: number;
}

interface UsagePermissionResponse {
  remoteKeyOperationMode: string;
  localKeyOperationMode: string;
}

interface RS232CEventListenerOptions {
  eventListener: (data: string) => void;
}

interface SystemMonitorOptions {
  monitorConfiguration: {
    fan?: boolean;
    signal?: boolean;
    lamp?: boolean;
    screen?: boolean;
    temperature?: boolean;
  };
  eventHandler: (event: SystemMonitorEvent) => void;
}

interface SystemMonitorEvent {
  source: string;
  type: string;
  data: {
    temperature?: number;
    status?: string;
  };
}

interface SendKeyOptions {
  virtualKeyCode: number;
}

interface DigitalAudioInputOptions {
  digitalAudioInput: string;
}

interface FailoverModeOptions {
  failoverMode: {
    mode: string;
    priority?: string[];
  };
}

interface IntelligentAutoOptions {
  enabled: boolean;
}

interface IsmMethodOptions {
  ismMethod: string;
}

interface LanDaisyChainOptions {
  enabled: boolean;
}

interface MirrorModeOptions {
  mode: string;
}

interface NoSignalImageModeOptions {
  noSignalImageMode: string;
}

interface PortraitModeOptions {
  portraitMode: string;
}

interface PowerSaveModeOptions {
  powerSaveMode: {
    ses?: boolean;
    dpmMode?: string;
    automaticStandby?: string;
    do15MinOff?: boolean;
  };
}

interface SimplinkStatusOptions {
  simplinkEnable: string;
}

interface TileInfoOptions {
  tileInfo: {
    enabled?: boolean;
    row?: number;
    column?: number;
    tileId?: number;
    naturalMode?: boolean;
  };
}

interface UsagePermissionOptions {
  policy: {
    remoteKeyOperationMode?: string;
    localKeyOperationMode?: string;
  };
}

interface UpdateNoSignalImageListOptions {
  imgList: string[];
}

declare const Signage: {
  new (): Signage;
};
