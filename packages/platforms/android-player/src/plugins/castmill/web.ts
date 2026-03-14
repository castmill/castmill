import { WebPlugin } from '@capacitor/core';
import type { CastmillPlugin } from './definitions';

/**
 * Web implementation of the Castmill plugin. No actual real functionality.
 */
export class CastmillWeb extends WebPlugin implements CastmillPlugin {
  constructor() {
    super();
  }

  restart(): Promise<void> {
    console.log('restart');
    return Promise.resolve();
  }

  reboot(): Promise<void> {
    console.log('reboot');
    return Promise.resolve();
  }

  quit(): Promise<void> {
    console.log('quit');
    return Promise.resolve();
  }

  getBrightness(): Promise<{ brightness: number }> {
    console.log('getBrightness');
    return Promise.resolve({ brightness: 100 });
  }

  setBrightness(_options: { brightness: number }): Promise<void> {
    console.log('setBrightness');
    return Promise.resolve();
  }
}
