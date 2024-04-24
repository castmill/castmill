import os from 'os';
import si from 'systeminformation';
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
  getMachineGUID: () => ipcRenderer.invoke(Action.GET_MACHINE_GUID),
  getItem: (key: string) => ipcRenderer.invoke(Action.GET_STORE_VALUE, key),
  setItem: (key: string, value: string) => ipcRenderer.send(Action.SET_STORE_VALUE, key, value),
  deleteItem: (key: string) => ipcRenderer.send(Action.DELETE_STORE_VALUE, key),
};

async function getHardwareInfo() {
    try {
        const data = await si.system();
        console.log(data);  // Logs the complete system data for debugging
        return data.model;  // Returns the model name, e.g., "MacBookPro15,1" or a specific Windows/Linux machine model
    } catch (error) {
        console.error('Error fetching system information:', error);
        return 'Could not be determined';
    }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
    contextBridge.exposeInMainWorld('osInfo', {
        type: os.type(),
        platform: os.platform(),
        release: os.release(),
    });
    contextBridge.exposeInMainWorld('hardwareInfo', getHardwareInfo);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
