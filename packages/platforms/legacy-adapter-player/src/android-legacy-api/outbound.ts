// outbound interface for the Android platform
// This file defines the calls that the legacy wrapper can make when running on Android
export const outbound = {
  // player API
  setVideoPath: async function (path: string) {},
  play: async function () {},
  stop: async function () {},
  seek: async function (time: number) {},
  getPlayerData: async function () {},
  setDimensions: async function (
    x: number,
    y: number,
    width: number,
    height: number
  ) {},
  setVolume: async function (vol: number) {},
  setRotation: async function (rot: number) {},
  getCurrentPosition: async function () {},
  getDuration: async function () {},
  version: async function () {},

  // storage API
  set: async function (key: string, value: string) {},
  get: async function (key: string) {},

  // download API
  downloadFile: async function (path: string, localPath: string) {}, // localUrl: string
  deleteFile: async function (path: string) {},
  deletePath: async function (path: string) {},

  // audio API
  playSound: async function (url: string, vol: number) {},
  stopSound: async function () {},

  // restart/reboot
  restart: async function () {},
  reboot: async function () {},
};
