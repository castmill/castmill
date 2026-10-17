import {
  BrowserMachine,
  type Orientation,
  type OrientationResult,
} from '@castmill/device';
import { applyWebosOrientation } from '@castmill/webos-player/shared';
import {
  getWebosMachineGUID,
  initWebosLegacyApi,
  rebootWebosDevice,
  restartWebosApp,
  sendHeartbeat,
  sendPlayerReady,
  updateWebosPlayer,
  setWebosOrientation,
} from '../webos-legacy-api';
import { PING_INTERVAL } from './legacy-machine';

export class WebosLegacyMachine extends BrowserMachine {
  async setOrientation(orientation: Orientation): Promise<OrientationResult> {
    return applyWebosOrientation(orientation, setWebosOrientation);
  }

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

  async update(): Promise<void> {
    await updateWebosPlayer();
  }
}
