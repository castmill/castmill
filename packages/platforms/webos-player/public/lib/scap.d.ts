/// <reference path="./configuration.d.ts" />
/// <reference path="./device-info.d.ts" />
/// <reference path="./input-source.d.ts" />
/// <reference path="./power.d.ts" />
/// <reference path="./security.d.ts" />
/// <reference path="./signage.d.ts" />
/// <reference path="./sound.d.ts" />
/// <reference path="./storage.d.ts" />
/// <reference path="./time.d.ts" />
/// <reference path="./utility.d.ts" />
/// <reference path="./video.d.ts" />

interface Window {
  Configuration: Configuration;
  DeviceInfo: DeviceInfo;
  InputSource: InputSource;
  Power: Power;
  Security: Security;
  Signage: Signage;
  Sound: Sound;
  Storage: Storage;
  Time: Time;
  Utility: Utility;
  Video: Video;
}
