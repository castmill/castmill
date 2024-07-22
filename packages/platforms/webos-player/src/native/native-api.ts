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

export const power = {
  executePowerCommand: promisifyNoRet(
    scapPower.executePowerCommand.bind(scapPower)
  ),
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
  removeFile: promisifyNoRet(scapStorage.removeFile.bind(scapStorage)),
};

// const a = promisify((successCallback: (result: string) => void, errorCallback: (error: any) => void, options?: { a: string }) => {
//   successCallback('a');
// });
// const a2 = promisify((successCallback: (result: string) => void, errorCallback: (error: any) => void) => {
//   successCallback('a2');
// });

// const a3 = promisify((successCallback: (result: number) => void, errorCallback: (error: any) => void, options: {a:number}) => {
//   successCallback(3);
// });

// const a4 = promisifyNoRet((successCallback: () => void, errorCallback: (error: any) => void, options: {a:number}) => {
//   successCallback();
// });

// const a5 = promisify((successCallback: () => void, errorCallback: (error: any) => void, options:string) => {
//   successCallback();
// });

// export const inputSource = promisify(new InputSource());
// export const power = promisify(new Power());
// export const security = promisify(new Security());
// export const signage = promisify(new Signage());
// export const sound = promisify(new Sound());
// export const storage = promisify(new Storage());
// export const time = promisify(new Time());
// export const utility = promisify(new Utility());
// export const video = promisify(new Video());
// export const customAPI = new Custom();
// export const custom = {
//   configuration: promisify(customAPI.Configuration),
//   signage: promisify(customAPI.Signage),
//   videoSync: promisify(customAPI.VideoSync),
//   NATIVEPORTRAIT: Custom.NATIVEPORTRAIT,
//   CLEARBROWSINGDATATYPES: Custom.CLEARBROWSINGDATATYPES
// };
