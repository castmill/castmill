// Storage.d.ts

interface Storage {
  changeLogoImage(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ChangeLogoImageOptions
  ): void;
  copyFile(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: CopyFileOptions
  ): void;
  decryptFile(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: DecryptFileOptions
  ): void;
  downloadFile(
    successCallback: (cbObject: DownloadFileResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: DownloadFileOptions
  ): void;
  downloadFirmware(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: DownloadFirmwareOptions
  ): void;
  exists(
    successCallback: (cbObject: ExistsResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ExistsOptions
  ): void;
  exportSettingData(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ExportSettingDataOptions
  ): void;
  formatUSB(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: FormatUSBOptions
  ): void;
  fsync(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: FsyncOptions
  ): void;
  getDownloadFileStatus(
    successCallback: (cbObject: DownloadFileStatusResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: DownloadFileStatusOptions
  ): void;
  getFirmwareUpgradeStatus(
    successCallback: (cbObject: FirmwareUpgradeStatusResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getMD5Hash(
    successCallback: (cbObject: MD5HashResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: MD5HashOptions
  ): void;
  getStorageInfo(
    successCallback: (cbObject: StorageInfoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  getUSBInfo(
    successCallback: (cbObject: USBInfoResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  importSettingData(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ImportSettingDataOptions
  ): void;
  listFiles(
    successCallback: (cbObject: ListFilesResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ListFilesOptions
  ): void;
  mkdir(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: MkdirOptions
  ): void;
  moveFile(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: MoveFileOptions
  ): void;
  readFile(
    successCallback: (cbObject: ReadFileResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ReadFileOptions
  ): void;
  removeAll(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: RemoveAllOptions
  ): void;
  removeApplication(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: RemoveApplicationOptions
  ): void;
  removeFile(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: RemoveFileOptions
  ): void;
  statFile(
    successCallback: (cbObject: StatFileResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: StatFileOptions
  ): void;
  unzipFile(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: UnzipFileOptions
  ): void;
  upgradeApplication(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: UpgradeApplicationOptions
  ): void;
  upgradeFirmware(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void
  ): void;
  writeFile(
    successCallback: (cbObject: WriteFileResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: WriteFileOptions
  ): void;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface ChangeLogoImageOptions {
  uri: string;
}

interface CopyFileOptions {
  source: string;
  destination: string;
  ftpOption?: FTPOptions;
  httpOption?: HTTPOptions;
}

interface FTPOptions {
  secure?: 'implicit' | 'explicit';
  secureOptions?: {
    privateKey?: string;
    passphrase?: string;
  };
  connTimeout?: number;
  pasvTimeout?: number;
  keepalive?: number;
}

interface HTTPOptions {
  maxRedirection?: number;
  headers?: { [key: string]: string };
  timeout?: number;
}

interface DecryptFileOptions {
  cipher_mode:
    | 'aes-128-cbc'
    | 'aes-128-ecb'
    | 'aes-192-cbc'
    | 'aes-192-ecb'
    | 'aes-256-cbc'
    | 'aes-256-ecb';
  password: string;
  inputPath: string;
  outputFileName: string;
}

interface DownloadFileOptions {
  action: 'start' | 'pause' | 'resume' | 'cancel';
  source?: string;
  destination?: string;
  ticket?: number;
  ftpOption?: FTPOptions;
  httpOption?: HTTPOptions;
}

interface DownloadFileResponse {
  ticket: number;
}

interface DownloadFirmwareOptions {
  uri: string;
}

interface ExistsOptions {
  path: string;
}

interface ExistsResponse {
  exists: boolean;
}

interface ExportSettingDataOptions {
  path: string;
}

interface FormatUSBOptions {
  usbName: string;
  fsType?: string;
}

interface FsyncOptions {
  path: string;
}

interface DownloadFileStatusOptions {
  ticket: number;
  subscribe?: boolean;
}

interface DownloadFileStatusResponse {
  ticket: number;
  status: 'downloading' | 'completed' | 'paused' | 'canceled' | 'failed';
  source?: string;
  destination?: string;
  amountReceived?: number;
  amountTotal?: number;
  reason?: string;
}

interface FirmwareUpgradeStatusResponse {
  status:
    | 'idle'
    | 'downloading'
    | 'ready'
    | 'in progress'
    | 'completed'
    | 'fail';
  downloadProgress: number;
  upgradeProgress: number;
}

interface MD5HashOptions {
  filePath: string;
}

interface MD5HashResponse {
  md5hash: string;
}

interface StorageInfoResponse {
  free: number;
  total: number;
  used: number;
  externalMemory?: {
    [deviceURI: string]: {
      free: number;
      total: number;
      used: number;
    };
  };
}

interface USBInfoResponse {
  usbList: Array<{
    usbName: string;
    vendor: string;
    product: string;
  }>;
}

interface ImportSettingDataOptions {
  path: string;
}

interface ListFilesOptions {
  path: string;
}

interface ListFilesResponse {
  files: Array<{
    name?: string;
    type?: string;
    size?: number;
  }>;
  totalCount: number;
}

interface MkdirOptions {
  path: string;
}

interface MoveFileOptions {
  oldPath: string;
  newPath: string;
}

interface ReadFileOptions {
  path: string;
  position?: number;
  length?: number;
  encoding?: 'utf8' | 'binary' | 'base64';
}

interface ReadFileResponse {
  data: string | ArrayBuffer;
}

interface RemoveAllOptions {
  device: string;
}

interface RemoveApplicationOptions {
  to: string;
}

interface RemoveFileOptions {
  file: string;
  recursive?: boolean;
}

interface StatFileOptions {
  path: string;
}

interface StatFileResponse {
  type: 'file' | 'directory' | 'unknown';
  size: number;
  atime: string;
  mtime: string;
  ctime: string;
}

interface UnzipFileOptions {
  zipPath: string;
  targetPath: string;
}

interface UpgradeApplicationOptions {
  to: string;
  recovery?: boolean;
  type?: string;
}

interface WriteFileOptions {
  path: string;
  data: string | ArrayBuffer;
  mode?: 'truncate' | 'append' | 'position';
  position?: number;
  length?: number;
  encoding?: 'utf8' | 'base64' | 'binary';
  offset?: number;
}

interface WriteFileResponse {
  written: number;
}

// declare const Storage: {
//     new (): Storage;
//     AppMode: {
//         LOCAL: "local",
//         USB: "usb"
//     };
//     AppType: {
//         IPK: "ipk",
//         ZIP: "zip"
//     };
// };
