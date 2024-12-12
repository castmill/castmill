import { Machine } from '@castmill/device';

export const PING_INTERVAL = 20000;

export interface LegacyMachine extends Machine {
  initLegacy?(): void;
}
