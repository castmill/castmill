import { ElectronAPI } from '@electron-toolkit/preload';

export interface ApplicationAPI {
  relaunch: () => void;
  quit: () => void;
  shutdown: () => void;
  reboot: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
  }
}
