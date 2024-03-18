// Purpose: API for the main process to interact with the renderer process.
// Any actions required to be performed by the main process should be defined here.
import { exec } from 'child_process';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import { autoUpdater } from "electron-updater"

/*
 * show a toast notification
 */
const showToast = (title: string, message: string) => {
  console.log(`Notification: ${title} - ${message}`);
  exec(
    `osascript -e 'display notification "${message}" with title "${title}" sound name "Submarine"'`
  );
};

/*
 * relaunch the app
 */
export const relaunch = () => {
  app.relaunch();
  app.exit(0);
};

/*
 * exit the app
 */
export const exit = () => {
  app.exit(0);
};

/*
 * shutdown the computer
 */
export const shutdown = () => {
  // if dev, don't actually shutdown
  if (is.dev) {
    showToast('Action blocked in dev', 'Shutdown');
    return;
  }

  if (process.platform === 'win32') {
    // windows
    exec('shutdown /s /t 1');
  } else if (process.platform === 'darwin' || process.platform === 'linux') {
    // mac and linux
    exec('poweroff');
  } else {
    // other platforms
    throw new Error('Unsupported platform');
  }
};

/*
 * reboot the computer
 */
export const reboot = () => {
  // if dev, don't actually reboot
  if (is.dev) {
    showToast('Action blocked in dev', 'Reboot');
    return;
  }

  if (process.platform === 'win32') {
    // windows
    exec('shutdown /r /t 1');
  } else if (process.platform === 'darwin' || process.platform === 'linux') {
    // mac and linux
    exec('reboot');
  } else {
    // other platforms
    throw new Error('Unsupported platform');
  }
};

/*
 * update the app
 */
export const update = () => {
  showToast('Update', 'Checking for updates...');
  // Won't work in dev mode.
  autoUpdater.checkForUpdatesAndNotify();
};
