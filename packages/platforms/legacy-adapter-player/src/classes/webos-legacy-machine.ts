import { BrowserMachine } from '@castmill/device';
import {
  getWebosMachineGUID,
  initWebosLegacyApi,
  rebootWebosDevice,
  restartWebosApp,
  sendHeartbeat,
  sendPlayerReady,
} from '../webos-legacy-api';
import { PING_INTERVAL } from './legacy-machine';

export class WebosLegacyMachine extends BrowserMachine {
  initLegacy(): void {
    initWebosLegacyApi();
    sendHeartbeat();
    setInterval(sendHeartbeat, PING_INTERVAL);
  }

  notifyReady(): void {
    setTimeout(sendPlayerReady, 1000);
  }

  async getMachineGUID(): Promise<string> {
    const id = await getWebosMachineGUID();
    if (typeof id !== 'string' || !id) {
      throw new Error('WebOS wrapper returned an invalid machine ID');
    }
    return id;
  }

  async restart(): Promise<void> {
    await restartWebosApp();
  }

  async reboot(): Promise<void> {
    await rebootWebosDevice();
  }
}
