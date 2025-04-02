import {
  promisify,
  promisifyNoOpt,
  promisifyNoRet,
  promisifyNoOptNoRet,
} from './promisify';

const scapDeviceInfo = new DeviceInfo();
const scapUtility = new Utility();
const scapSignage = new Signage();
const scapPower = new Power();
const scapConfig = new Configuration();
const scapStorage = new Storage();
const scapTime = new Time();

export const deviceInfo = {
  getPlatformInfo: promisifyNoOpt(
    scapDeviceInfo.getPlatformInfo.bind(scapDeviceInfo)
  ),
  getNetworkMacInfo: promisifyNoOpt(
    scapDeviceInfo.getNetworkMacInfo.bind(scapConfig)
  ),
};

export const utility = {
  createToast: promisifyNoRet(scapUtility.createToast.bind(scapUtility)),
};

export const signage = {
  registerSystemMonitor: promisifyNoRet(
    scapSignage.registerSystemMonitor.bind(scapSignage)
  ),
  unregisterSystemMonitor: promisifyNoOptNoRet(
    scapSignage.unregisterSystemMonitor.bind(scapSignage)
  ),
};

export const time = {
  // webos >= 4, scap 1.7
  clearAllOnOffTimers: scapTime.clearAllOnOffTimers
    ? promisifyNoOptNoRet(scapTime.clearAllOnOffTimers.bind(scapTime))
    : undefined,
  reserveOnOffTimer: scapTime.reserveOnOffTimer
    ? promisifyNoRet(scapTime.reserveOnOffTimer.bind(scapTime))
    : undefined,
};

export const power = {
  executePowerCommand: promisifyNoRet(
    scapPower.executePowerCommand.bind(scapPower)
  ),
  getOnTimerList: promisifyNoOpt(scapPower.getOnTimerList.bind(scapPower)),
  getOffTimerList: promisifyNoOpt(scapPower.getOffTimerList.bind(scapPower)),

  // webos < 4, scap 1.5
  enableAllOnTimer: scapPower.enableAllOnTimer
    ? promisifyNoRet(scapPower.enableAllOnTimer.bind(scapPower))
    : undefined,
  enableAllOffTimer: scapPower.enableAllOffTimer
    ? promisifyNoRet(scapPower.enableAllOffTimer.bind(scapPower))
    : undefined,
  addOnTimer: scapPower.addOnTimer
    ? promisifyNoRet(scapPower.addOnTimer.bind(scapPower))
    : undefined,
  addOffTimer: scapPower.addOffTimer
    ? promisifyNoRet(scapPower.addOffTimer.bind(scapPower))
    : undefined,
};

export const configuration = {
  restartApplication: promisifyNoOptNoRet(
    scapConfig.restartApplication.bind(scapConfig)
  ),
  getServerProperty: promisifyNoOpt(
    scapConfig.getServerProperty.bind(scapConfig)
  ),
  setServerProperty: promisifyNoRet(
    scapConfig.setServerProperty.bind(scapConfig)
  ),
};

export const storage = {
  upgradeApplication: promisifyNoRet(
    scapStorage.upgradeApplication.bind(scapStorage)
  ),
  downloadFirmware: promisifyNoRet(
    scapStorage.downloadFirmware.bind(scapStorage)
  ),
  upgradeFirmware: promisifyNoOptNoRet(
    scapStorage.upgradeFirmware.bind(scapStorage)
  ),
  writeFile: promisify(scapStorage.writeFile.bind(scapStorage)),
  readFile: promisify(scapStorage.readFile.bind(scapStorage)),
  moveFile: promisifyNoRet(scapStorage.moveFile.bind(scapStorage)),
  removeFile: promisifyNoRet(scapStorage.removeFile.bind(scapStorage)),
  statFile: promisify(scapStorage.statFile.bind(scapStorage)),
  copyFile: promisifyNoRet(scapStorage.copyFile.bind(scapStorage)),
  fsync: promisifyNoRet(scapStorage.fsync.bind(scapStorage)),
  mkdir: promisifyNoRet(scapStorage.mkdir.bind(scapStorage)),
  listFiles: promisify(scapStorage.listFiles.bind(scapStorage)),
  getStorageInfo: promisifyNoOpt(scapStorage.getStorageInfo.bind(scapStorage)),
};
