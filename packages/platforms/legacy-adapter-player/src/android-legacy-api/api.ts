import { Msg } from './msg';

import { inbound } from './inbound';
import { outbound } from './outbound';

interface PlayerData {
  player_version: string;
  model: string;
  platform: string;
  uuid: string;
  android_version: string;
}

import { Logger } from '../utils';

const logger = new Logger('Api');

const msg = new Msg(window.parent, inbound, outbound);

export async function getPlayerData(): Promise<PlayerData> {
  logger.log('getPlayerData');
  return outbound.getPlayerData() as unknown as PlayerData;
}

export async function setItem(key: string, value: string): Promise<void> {
  logger.log('setItem', key, value);
  await outbound.set(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  logger.log('getItem', key);
  return outbound.get(key) as unknown as string | null;
}

export async function reboot(): Promise<void> {
  logger.log('reboot');
  await outbound.reboot();
}

export async function restart(): Promise<void> {
  logger.log('restart');
  await outbound.restart();
}

export async function downloadFile(
  path: string,
  localPath: string
): Promise<string> {
  logger.log('downloadFile', path, localPath);
  return outbound.downloadFile(path, localPath) as unknown as string;
}

export async function deleteFile(path: string): Promise<void> {
  logger.log('deleteFile', path);
  await outbound.deleteFile(path);
}

export async function deletePath(path: string): Promise<void> {
  logger.log('deletePath', path);
  await outbound.deletePath(path);
}

export function sendHeartbeat() {
  logger.log('Sending heartbeat');
  parent.postMessage('alive', '*');
}

export function sendPlayerReady() {
  logger.log('Sending player ready');
  parent.postMessage('player_ready', '*');
}
