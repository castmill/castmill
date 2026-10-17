import { Msg } from '../legacy-api/msg';

import { inbound } from '../legacy-api/inbound';
import { outbound } from './outbound';
import {
  sendHeartbeat as postHeartbeat,
  sendPlayerReady as postPlayerReady,
} from '../legacy-api/notifications';

interface PlayerData {
  player_version: string;
  model: string;
  platform: string;
  uuid: string;
  android_version: string;
}

import { Logger } from '../utils';

const logger = new Logger('Api');

let initialized = false;

export function initAndroidLegacyApi(): void {
  if (!initialized) {
    new Msg(window.parent, inbound, outbound);
    initialized = true;
  }
}

export async function getPlayerData(): Promise<PlayerData> {
  initAndroidLegacyApi();
  logger.log('getPlayerData');
  return outbound.getPlayerData() as unknown as PlayerData;
}

export async function setItem(key: string, value: string): Promise<void> {
  initAndroidLegacyApi();
  logger.log('setItem', key, value);
  await outbound.set(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  initAndroidLegacyApi();
  logger.log('getItem', key);
  return outbound.get(key) as unknown as string | null;
}

export async function reboot(): Promise<void> {
  initAndroidLegacyApi();
  logger.log('reboot');
  await outbound.reboot();
}

export async function restart(): Promise<void> {
  initAndroidLegacyApi();
  logger.log('restart');
  await outbound.restart();
}

export async function downloadFile(
  path: string,
  localPath: string
): Promise<string> {
  initAndroidLegacyApi();
  logger.log('downloadFile', path, localPath);
  return outbound.downloadFile(path, localPath) as unknown as string;
}

export async function fileExists(path: string): Promise<boolean> {
  initAndroidLegacyApi();
  logger.log('fileExists', path);
  return Boolean(await outbound.fileExists(path));
}

export async function deleteFile(path: string): Promise<void> {
  initAndroidLegacyApi();
  logger.log('deleteFile', path);
  await outbound.deleteFile(path);
}

export async function deletePath(path: string): Promise<void> {
  initAndroidLegacyApi();
  logger.log('deletePath', path);
  await outbound.deletePath(path);
}

export function sendHeartbeat() {
  logger.log('Sending heartbeat');
  postHeartbeat();
}

export function sendPlayerReady() {
  logger.log('Sending player ready');
  postPlayerReady();
}
