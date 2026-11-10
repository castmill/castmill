/**
 * Automations: "when <event source> then <action>" rules evaluated on the
 * device. See agents/systems/AUTOMATIONS.md for the full contract.
 */

export type ConditionKind = 'event' | 'state';

/** A rule as delivered by `GET /devices/:id/automations`. */
export interface DeviceRule {
  id: string;
  index: number;
  source: string;
  condition: string;
  kind: ConditionKind;
  source_payload: Record<string, unknown>;
  action: string;
  action_config: Record<string, unknown>;
  cooldown_seconds: number;
  resources?: { playlists?: Array<number | string> };
}

export interface DeviceAutomation {
  id: number | string;
  name: string;
  via?: Array<{
    type: 'device' | 'channel';
    id?: number | string;
    name?: string;
  }>;
  rules: DeviceRule[];
}

export interface AutomationsPayload {
  generated_at: number;
  /** Epoch ms after which source payloads must not be trusted. */
  valid_until: number;
  timezone?: string;
  automations: DeviceAutomation[];
}

/** Timer functions, injectable so that tests can use a fake clock. */
export interface Scheduler {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const defaultScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type Emission =
  | { type: 'fire' }
  | { type: 'active' }
  | { type: 'inactive' };

export interface SourceContext {
  scheduler: Scheduler;
  /** Payload expiry (epoch ms). Sources must not emit after it. */
  validUntil: number;
  condition: string;
}

/** An event source, registered by type (e.g. `clock`). */
export interface EventSource {
  start(
    config: Record<string, unknown>,
    emit: (emission: Emission) => void,
    context: SourceContext
  ): void;
  stop(): void;
  /** Next known firing time (epoch ms), for debug output. */
  next?(): number | undefined;
}

/** Minimal AbortSignal (AbortController is not available on Chrome 38). */
export interface AbortSignalLike {
  readonly aborted: boolean;
  onAbort(listener: () => void): void;
}

export class AbortFlag implements AbortSignalLike {
  aborted = false;
  private listeners: Array<() => void> = [];

  onAbort(listener: () => void) {
    if (this.aborted) {
      listener();
    } else {
      this.listeners.push(listener);
    }
  }

  abort() {
    if (this.aborted) return;
    this.aborted = true;
    const listeners = this.listeners;
    this.listeners = [];
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // A failing listener must not prevent the others from running.
      }
    });
  }
}

/**
 * Operations the device offers to actions that use playback. Implemented by
 * `Device`; tests use fakes.
 */
export interface PlaybackHost {
  /** Downloads (and caches) a playlist and its media. */
  preparePlaylist(playlistId: number | string): Promise<unknown>;
  /**
   * Resolves at the next item boundary of normal programming, after
   * `timeoutMs`, or when `signal` is aborted, whichever comes first. Returns
   * true only when the boundary was reached.
   */
  waitForItemBoundary(
    timeoutMs: number,
    signal: AbortSignalLike
  ): Promise<boolean>;
  /**
   * Plays a prepared playlist `plays` times (forever when `plays` is
   * `Infinity`) instead of normal programming. Resolves when done or when
   * `signal` is aborted.
   */
  playInterruption(
    playlist: unknown,
    plays: number,
    signal: AbortSignalLike,
    resumeAtCurrent?: boolean
  ): Promise<void>;
  /** Continues normal programming after the last playback action. */
  resumeProgramming(): void;
}

export interface ActionContext {
  rule: DeviceRule;
  automation: DeviceAutomation;
  kind: ConditionKind;
  host: PlaybackHost;
  scheduler: Scheduler;
  /** Aborted when the firing is preempted, its state ends or the engine stops. */
  signal: AbortSignalLike;
}

/** An action, registered by type (e.g. `interrupt`). */
export interface Action {
  /**
   * Actions that use playback go through the engine's arbitration (they
   * never interleave). Others run independently.
   */
  readonly usesPlayback: boolean;
  /** Arbitration priority; defaults to `normal`. */
  priority?(config: Record<string, unknown>): 'normal' | 'high';
  /** How long a firing may wait for playback before it is dropped, in ms. */
  maxWaitMs?(config: Record<string, unknown>): number;
  /** Prefetches content so that firings start without network access. */
  preload?(config: Record<string, unknown>, host: PlaybackHost): Promise<void>;
  run(config: Record<string, unknown>, context: ActionContext): Promise<void>;
}

export type DropReason =
  | 'cooldown'
  | 'expired'
  | 'preempted'
  | 'duplicate'
  | 'unsupported'
  | 'failed'
  | 'stopped';

export type FiringResult =
  | { status: 'ran' }
  | { status: 'running' }
  | { status: 'queued' }
  | { status: 'dropped'; reason: DropReason };

export interface FiringRecord {
  automationId: number | string;
  automationName: string;
  ruleId: string;
  at: number;
  result: FiringResult;
}
