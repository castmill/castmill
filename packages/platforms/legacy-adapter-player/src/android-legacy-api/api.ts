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

const SIMPLE_ACTIONS_TIMEOUT_MS = 5000;
// Return a promise that rejects after a timeout
const timeout = (ms = SIMPLE_ACTIONS_TIMEOUT_MS) =>
  new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Request to Android player api timed out')),
      ms
    )
  );

export async function getPlayerData(): Promise<PlayerData> {
  console.log('Android api: getPlayerData');
  return Promise.race([
    outbound.getPlayerData(),
    timeout(),
  ]) as unknown as PlayerData;
}

export async function setItem(key: string, value: string): Promise<void> {
  console.log('Android api: setItem', key, value);
  await Promise.race([outbound.set(key, value), timeout()]);
}

export async function getItem(key: string): Promise<string | null> {
  console.log('Android api: getItem', key);
  return Promise.race([outbound.get(key), timeout()]) as unknown as string;
}

export async function reboot(): Promise<void> {
  console.log('Android api: reboot');
  await Promise.race([outbound.reboot(), timeout()]);
}

export async function restart(): Promise<void> {
  console.log('Android api: restart');
  await Promise.race([outbound.restart(), timeout()]);
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
  await Promise.race([outbound.deleteFile(path), timeout()]);
}

export async function deletePath(path: string): Promise<void> {
  console.log('Android api: deletePath', path);
  await Promise.race([outbound.deletePath(path), timeout()]);
}

export function sendHeartbeat() {
  console.log('Android api: Sending heartbeat');
  parent.postMessage('alive', '*');
}

export function sendPlayerReady() {
  console.log('Android api: Sending player ready');
  parent.postMessage('player_ready', '*');
}
