import { ElectronAPI } from '@electron-toolkit/preload';

export interface ApplicationAPI {
  relaunch: () => void;
  quit: () => void;
  shutdown: () => void;
  reboot: () => void;
  update: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
  }
}
