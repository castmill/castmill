import { InterruptAction } from './actions/interrupt';
import { AutomationRegistry } from './registry';
import { ClockSource } from './sources/clock';

export * from './types';
export * from './registry';
export * from './engine';
export * from './sources/clock';
export * from './actions/interrupt';

/** The sources and actions this player supports. */
export function createDefaultRegistry(): AutomationRegistry {
  return new AutomationRegistry()
    .registerSource('clock', () => new ClockSource())
    .registerAction('interrupt', () => new InterruptAction());
}
export * from './device-playback-host';
export * from './debug-overlay';
