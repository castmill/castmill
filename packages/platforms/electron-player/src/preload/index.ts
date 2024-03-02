import { contextBridge, ipcRenderer } from 'electron';
import { electronAPI } from '@electron-toolkit/preload';
import type { ApplicationAPI } from './index.d';
import { Action } from '../common';

// Custom APIs for renderer
const api: ApplicationAPI = {
  relaunch: () => ipcRenderer.send(Action.RELAUNCH),
  quit: () => ipcRenderer.send(Action.QUIT),
  shutdown: () => ipcRenderer.send(Action.SHUTDOWN),
  reboot: () => ipcRenderer.send(Action.REBOOT),
  update: () => ipcRenderer.send(Action.UPDATE),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
