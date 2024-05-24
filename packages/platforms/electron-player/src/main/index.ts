import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  IpcMainInvokeEvent,
} from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import Store from 'electron-store';
import * as api from './api';
import { Action } from '../common';
import icon from '../../resources/icon.png?asset';

function createWindow(): void {
  // Determine if the app is running in kiosk mode.
  const kiosk = import.meta.env.VITE_KIOSK === 'true';

  // Determine if the app is running in fullscreen mode.
  const fullscreen = import.meta.env.VITE_FULLSCREEN === 'true';

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    fullscreen,
    kiosk,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  const store = new Store();
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron');

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'));

  ipcMain.on(Action.RELAUNCH, () => {
    api.relaunch();
  });

  ipcMain.on(Action.QUIT, () => {
    api.exit();
  });

  ipcMain.on(Action.SHUTDOWN, () => {
    api.shutdown();
  });

  ipcMain.on(Action.REBOOT, () => {
    api.reboot();
  });

  ipcMain.on(Action.UPDATE, () => {
    api.update();
  });

  ipcMain.handle(Action.GET_MACHINE_GUID, () => {
    return api.getMachineGUID();
  });

  ipcMain.handle(
    Action.GET_STORE_VALUE,
    (_event: IpcMainInvokeEvent, key: string) => {
      return store.get(key);
    }
  );

  ipcMain.on(
    Action.SET_STORE_VALUE,
    (_event: IpcMainInvokeEvent, key: string, value: string) => {
      store.set(key, value);
    }
  );

  ipcMain.on(
    Action.DELETE_STORE_VALUE,
    (_event: IpcMainInvokeEvent, key: string) => {
      store.delete(key);
    }
  );

  ipcMain.handle(
    Action.FS_INIT,
    (_event: IpcMainInvokeEvent, storagePath: string) =>
      api.initStorage(storagePath)
  );

  ipcMain.handle(
    Action.FS_INFO,
    (_event: IpcMainInvokeEvent, storagePath: string) =>
      api.getStorageInfo(storagePath)
  );

  ipcMain.handle(
    Action.FS_LIST_FILES,
    (_event: IpcMainInvokeEvent, storagePath: string) =>
      api.listFiles(storagePath)
  );

  ipcMain.handle(
    Action.FS_STORE_FILE,
    (
      _event: IpcMainInvokeEvent,
      storagePath: string,
      url: string,
      data?: any
    ) => api.storeFile(storagePath, url, data)
  );

  ipcMain.handle(
    Action.FS_RETRIEVE_FILE,
    (_event: IpcMainInvokeEvent, storagePath: string, url: string) =>
      api.retrieveFile(storagePath, url)
  );

  ipcMain.handle(
    Action.FS_DELETE_FILE,
    (_event: IpcMainInvokeEvent, storagePath: string, url: string) =>
      api.deleteFile(storagePath, url)
  );

  ipcMain.handle(
    Action.FS_DELETE_ALL_FILES,
    (_event: IpcMainInvokeEvent, storagePath: string) =>
      api.deleteAllFiles(storagePath)
  );

  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
