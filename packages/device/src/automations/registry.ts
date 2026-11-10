import type { Action, EventSource } from './types';

export type SourceFactory = () => EventSource;
export type ActionFactory = () => Action;

/**
 * Registries of event sources and actions by type. New types are added by
 * registering a factory; the engine needs no changes.
 */
export class AutomationRegistry {
  private sources: Record<string, SourceFactory> = {};
  private actions: Record<string, ActionFactory> = {};

  registerSource(type: string, factory: SourceFactory): this {
    this.sources[type] = factory;
    return this;
  }

  registerAction(type: string, factory: ActionFactory): this {
    this.actions[type] = factory;
    return this;
  }

  createSource(type: string): EventSource | undefined {
    const factory = this.sources[type];
    return factory ? factory() : undefined;
  }

  createAction(type: string): Action | undefined {
    const factory = this.actions[type];
    return factory ? factory() : undefined;
  }

  sourceTypes(): string[] {
    return Object.keys(this.sources).sort();
  }

  actionTypes(): string[] {
    return Object.keys(this.actions).sort();
  }
}
