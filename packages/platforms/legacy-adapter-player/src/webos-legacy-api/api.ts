import { inbound } from '../legacy-api/inbound';
import { Msg } from '../legacy-api/msg';

export { sendHeartbeat, sendPlayerReady } from '../legacy-api/notifications';

const outbound = {
  getUUid: async function (): Promise<string> {
    throw new Error('WebOS bridge is not initialized');
  },
  fetchFile: async function (
    _url: string
  ): Promise<{ url: string; size: number }> {
    throw new Error('WebOS bridge is not initialized');
  },
  clearFiles: async function (): Promise<void> {
    throw new Error('WebOS bridge is not initialized');
  },
  storage_removeFile: async function (_options: {
    file: string;
  }): Promise<void> {
    throw new Error('WebOS bridge is not initialized');
  },
  restart: async function (): Promise<void> {
    throw new Error('WebOS bridge is not initialized');
  },
  reboot: async function (): Promise<void> {
    throw new Error('WebOS bridge is not initialized');
  },
};

let initialized = false;

export function initWebosLegacyApi(): void {
  if (!initialized) {
    new Msg(window.parent, inbound, outbound);
    initialized = true;
  }
}

export async function getWebosMachineGUID(): Promise<string> {
  initWebosLegacyApi();
  return outbound.getUUid();
}

export async function fetchWebosFile(
  url: string
): Promise<{ url: string; size: number }> {
  initWebosLegacyApi();
  return outbound.fetchFile(url);
}

export async function removeWebosFile(file: string): Promise<void> {
  initWebosLegacyApi();
  await outbound.storage_removeFile({ file });
}

export async function clearWebosFiles(): Promise<void> {
  initWebosLegacyApi();
  await outbound.clearFiles();
}

export async function restartWebosApp(): Promise<void> {
  initWebosLegacyApi();
  await outbound.restart();
}

export async function rebootWebosDevice(): Promise<void> {
  initWebosLegacyApi();
  await outbound.reboot();
}
