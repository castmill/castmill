// Purpose: API for the main process to interact with the renderer process.
// Any actions required to be performed by the main process should be defined here.
import { exec } from 'child_process';
import os from 'os';
import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import { autoUpdater } from 'electron-updater';
import { one } from 'macaddress';
import { createHash } from 'crypto';
import si from 'systeminformation';
import type { TelemetryData } from '@castmill/device';

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

/*
 * get the mac address
 */
const getMacAddress = () => {
  return one();
};

/*
 * get the device uuid by hashing the mac address
 */
export const getMachineGUID = async () => {
  const macAddress = await getMacAddress();
  const shasum = createHash('sha1');
  shasum.update(macAddress);
  return shasum.digest('hex');
};

/*
 * get telemetry data from the system
 */
export const getTelemetry = async (): Promise<TelemetryData> => {
  const telemetry: TelemetryData = {};

  try {
    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    telemetry.memory = {
      totalBytes: totalMem,
      usedBytes: totalMem - freeMem,
    };

    // CPU load averages
    const loadAvg = os.loadavg();
    telemetry.cpuLoadAvg = {
      one: Math.round(loadAvg[0] * 100) / 100,
      five: Math.round(loadAvg[1] * 100) / 100,
      fifteen: Math.round(loadAvg[2] * 100) / 100,
    };

    // Uptime
    telemetry.uptimeSeconds = os.uptime();
  } catch (error) {
    console.error('Error getting basic system info:', error);
  }

  // CPU usage via systeminformation
  try {
    const cpuLoad = await si.currentLoad();
    telemetry.cpuUsagePercent = Math.round(cpuLoad.currentLoad * 10) / 10;
  } catch (error) {
    console.error('Error getting CPU load:', error);
  }

  // Disk/Storage via systeminformation
  try {
    const disks = await si.fsSize();
    if (disks.length > 0) {
      // Use the root/main partition
      const mainDisk =
        disks.find((d) => d.mount === '/' || d.mount === 'C:\\') || disks[0];
      telemetry.storage = {
        totalBytes: mainDisk.size,
        usedBytes: mainDisk.used,
      };
    }
  } catch (error) {
    console.error('Error getting disk info:', error);
  }

  // Temperatures via systeminformation
  try {
    const temps = await si.cpuTemperature();
    if (temps.main !== null && temps.main !== undefined && temps.main > 0) {
      const tempEntries: TelemetryData['temperatures'] = [
        { label: 'CPU', celsius: temps.main },
      ];
      if (temps.cores && temps.cores.length > 0) {
        temps.cores.forEach((coreTemp, i) => {
          if (coreTemp > 0) {
            tempEntries!.push({ label: `Core ${i}`, celsius: coreTemp });
          }
        });
      }
      telemetry.temperatures = tempEntries;
    }
  } catch (error) {
    console.error('Error getting temperature:', error);
  }

  // Network info
  try {
    const networkInterfaces = os.networkInterfaces();
    let ipAddress: string | undefined;
    let type: string | undefined;

    for (const [name, addrs] of Object.entries(networkInterfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          ipAddress = addr.address;
          type =
            name.toLowerCase().includes('wl') ||
            name.toLowerCase().includes('wi')
              ? 'wifi'
              : 'ethernet';
          break;
        }
      }
      if (ipAddress) break;
    }

    const networkData: TelemetryData['network'] = { ipAddress, type };

    // Try to get wifi signal strength via systeminformation
    try {
      const wifiNetworks = await si.wifiNetworks();
      const connected = Array.isArray(wifiNetworks)
        ? wifiNetworks.find((w: any) => w.security && w.signalLevel)
        : undefined;
      if (connected) {
        networkData!.ssid = (connected as any).ssid;
        // signalLevel is typically in dBm (-30 = excellent, -90 = poor)
        const dbm = (connected as any).signalLevel || 0;
        const percent = Math.min(100, Math.max(0, 2 * (dbm + 100)));
        networkData!.wifiSignalStrengthPercent = percent;
      }
    } catch {
      // wifi info not available
    }

    telemetry.network = networkData;
  } catch (error) {
    console.error('Error getting network info:', error);
  }

  // Battery via systeminformation
  try {
    const battery = await si.battery();
    if (battery.hasBattery) {
      telemetry.battery = {
        levelPercent: battery.percent,
        isCharging: battery.isCharging,
      };
    }
  } catch (error) {
    console.error('Error getting battery info:', error);
  }

  return telemetry;
};
