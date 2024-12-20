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

const msg = new Msg(window.parent, inbound, outbound);

export async function getPlayerData(): Promise<PlayerData> {
  console.log('Android api: getPlayerData');
  return outbound.getPlayerData() as unknown as PlayerData;
}

export async function setItem(key: string, value: string): Promise<void> {
  console.log('Android api: setItem', key, value);
  await outbound.set(key, value);
}

export async function getItem(key: string): Promise<string | null> {
  console.log('Android api: getItem', key);
  await outbound.get(key);
}

export async function reboot(): Promise<void> {
  console.log('Android api: reboot');
  await outbound.reboot();
}

export async function restart(): Promise<void> {
  console.log('Android api: restart');
  await outbound.restart();
}

export async function downloadFile(
  path: string,
  localPath: string
): Promise<string> {
  console.log('Android api: downloadFile', path, localPath);
  return outbound.downloadFile(path, localPath) as unknown as string;
}

export async function deleteFile(path: string): Promise<void> {
  console.log('Android api: deleteFile', path);
  await outbound.deleteFile(path);
}

export async function deletePath(path: string): Promise<void> {
  console.log('Android api: deletePath', path);
  await outbound.deletePath(path);
}

export function sendHeartbeat() {
  console.log('Android api: Sending heartbeat');
  parent.postMessage('alive', '*');
}

export function sendPlayerReady() {
  console.log('Android api: Sending player ready');
  parent.postMessage('player_ready', '*');
}
