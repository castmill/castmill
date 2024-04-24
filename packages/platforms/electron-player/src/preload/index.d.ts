import { ElectronAPI } from '@electron-toolkit/preload';

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


declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
    osInfo: OsInfo;
    hardwareInfo: () => Promise<string>;
  }
}
