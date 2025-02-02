import { ElectronAPI } from '@electron-toolkit/preload';
import {
  StorageInfo,
  StorageItem,
  StoreOptions,
  StoreFileReturnValue,
} from '@castmill/cache';

export interface ApplicationAPI {
  relaunch: () => void;
  quit: () => void;
  shutdown: () => void;
  reboot: () => void;
  update: () => void;
  getMachineGUID: () => Promise<string>;
  setItem: (key: string, value: string) => void;
  getItem: (key: string) => Promise<string>;
  deleteItem: (key: string) => void;
}

interface OsInfo {
  type: string;
  platform: string;
  release: string;
}

interface FsApi {
  init: (storagePath: string) => Promise<void>;
  info: (storagePath: string) => Promise<StorageInfo>;
  listFiles: (storagePath: string) => Promise<StorageItem[]>;
  storeFile: (
    storagePath: string,
    url: string,
    data?: StoreOptions
  ) => Promise<StoreFileReturnValue>;
  retrieveFile: (storagePath: string, url: string) => Promise<string>;
  deleteFile: (storagePath: string, url: string) => Promise<void>;
  deleteAllFiles: (storagePath: string) => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
    osInfo: OsInfo;
    hardwareInfo: () => Promise<string>;
    fsApi: FsApi;
  }
}
