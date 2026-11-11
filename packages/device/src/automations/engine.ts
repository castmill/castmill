import { AutomationRegistry } from './registry';
import {
  AbortFlag,
  type Action,
  type AutomationsPayload,
  type ConditionKind,
  type DeviceAutomation,
  type DeviceRule,
  type DropReason,
  type Emission,
  type EventSource,
  type FiringRecord,
  type FiringResult,
  type PlaybackHost,
  type Scheduler,
  defaultScheduler,
} from './types';

const DEFAULT_MAX_WAIT_MS = 120 * 1000;
const HISTORY_SIZE = 20;

interface RuleEntry {
  key: string;
  automation: DeviceAutomation;
  automationIndex: number;
  rule: DeviceRule;
  action: Action;
  source?: EventSource;
  stateActive: boolean;
}

interface Firing {
  seq: number;
  entry: RuleEntry;
  kind: ConditionKind;
  priority: 'normal' | 'high';
  createdAt: number;
  expiresAt: number;
  signal: AbortFlag;
  dropReason?: DropReason;
}

export interface NextFiring {
  at: number;
  automationId: number | string;
  automationName: string;
  ruleId: string;
}

export interface AutomationEngineOptions {
  registry: AutomationRegistry;
  host: PlaybackHost;
  scheduler?: Scheduler;
  onRecord?: (record: FiringRecord) => void;
  onError?: (error: unknown, record: FiringRecord) => void;
}

const priorityRank = (priority: 'normal' | 'high') =>
  priority === 'high' ? 0 : 1;

/**
 * Runs the event sources of the effective rules and turns their emissions
 * into firings.
 *
 * Actions that use playback (a single resource) are arbitrated:
 * - firings never interleave;
 * - a `high` firing preempts a running `normal` one;
 * - otherwise queued firings run by priority, automation order, then rule
 *   order;
 * - a queued firing expires after the action's maximum wait, and a rule has
 *   at most one pending firing, so simultaneous firings cannot starve;
 * - cooldowns are enforced per rule; missed firings are not caught up.
 *
 * Actions that do not use playback run independently.
 */
export class AutomationEngine {
  private readonly scheduler: Scheduler;
  private entries: RuleEntry[] = [];
  private queue: Firing[] = [];
  private running?: Firing;
  private seq = 0;
  private lastAccepted: Record<string, number> = {};
  private records: FiringRecord[] = [];
  private validUntil = 0;

  constructor(private readonly opts: AutomationEngineOptions) {
    this.scheduler = opts.scheduler || defaultScheduler;
  }

  /**
   * Starts the sources of a payload, replacing those of the previous one. A
   * running firing continues; queued firings are dropped.
   */
  load(payload: AutomationsPayload | undefined) {
    this.stopSources();
    this.dropQueued('stopped');
    this.entries = [];
    if (!payload || !Array.isArray(payload.automations)) return;
    this.validUntil = payload.valid_until || 0;

    payload.automations.forEach((automation, automationIndex) => {
      (automation.rules || []).forEach((rule) => {
        const action = this.opts.registry.createAction(rule.action);
        const source = this.opts.registry.createSource(rule.source);
        // Rules this device cannot run are ignored (the dashboard warns).
        if (!action || !source) return;

        const entry: RuleEntry = {
          key: `${automation.id}:${rule.id}`,
          automation,
          automationIndex,
          rule,
          action,
          source,
          stateActive: false,
        };
        this.entries.push(entry);

        if (action.preload) {
          action
            .preload(rule.action_config || {}, this.opts.host)
            .catch(() => undefined);
        }

        try {
          source.start(
            rule.source_payload || {},
            (emission) => this.onEmission(entry, emission),
            {
              scheduler: this.scheduler,
              validUntil: this.validUntil,
              condition: rule.condition,
            }
          );
        } catch (error) {
          entry.source = undefined;
          this.opts.onError?.(
            error,
            this.record(entry, { status: 'dropped', reason: 'failed' })
          );
        }
      });
    });
  }

  /** Stops everything without resuming programming (e.g. before a reload). */
  dispose() {
    this.stopSources();
    this.entries = [];
    this.dropQueued('stopped');
    const running = this.running;
    this.running = undefined;
    if (running) {
      running.dropReason = 'stopped';
      running.signal.abort();
    }
  }

  /**
   * Runs a rule's action once through the arbitration, ignoring cooldowns
   * ("Run now" from the dashboard).
   */
  runNow(automation: DeviceAutomation, rule: DeviceRule) {
    if (!automation || !rule) return;
    const known = this.entries.find(
      (entry) =>
        String(entry.automation.id) === String(automation.id) &&
        entry.rule.id === rule.id
    );
    const action = known
      ? known.action
      : this.opts.registry.createAction(rule && rule.action);
    const entry = known || this.adHocEntry(automation, rule, action);
    if (!entry) return;
    if (!action) {
      this.record(entry, { status: 'dropped', reason: 'unsupported' });
      return;
    }
    this.submit(entry, 'event', true);
  }

  /** The next known firing of all sources. */
  nextFiring(): NextFiring | undefined {
    let next: NextFiring | undefined;
    this.entries.forEach((entry) => {
      const at = entry.source?.next?.();
      if (at !== undefined && (!next || at < next.at)) {
        next = {
          at,
          automationId: entry.automation.id,
          automationName: entry.automation.name,
          ruleId: entry.rule.id,
        };
      }
    });
    return next;
  }

  /** The latest firing results, newest first. */
  history(): FiringRecord[] {
    return this.records.slice();
  }

  lastFiring(): FiringRecord | undefined {
    return this.records[0];
  }

  get busy(): boolean {
    return !!this.running;
  }

  private adHocEntry(
    automation: DeviceAutomation,
    rule: DeviceRule,
    action: Action | undefined
  ): RuleEntry | undefined {
    if (!automation || !rule || typeof rule.id !== 'string') return undefined;
    return {
      key: `${automation.id}:${rule.id}`,
      automation,
      automationIndex: this.entries.length,
      rule,
      action: action as Action,
      stateActive: false,
    };
  }

  private onEmission(entry: RuleEntry, emission: Emission) {
    if (this.entries.indexOf(entry) === -1) return;
    switch (emission.type) {
      case 'fire':
        this.submit(entry, 'event', false);
        break;
      case 'active':
        if (entry.stateActive) return;
        entry.stateActive = true;
        this.submit(entry, 'state', false);
        break;
      case 'inactive':
        if (!entry.stateActive) return;
        entry.stateActive = false;
        this.queue = this.queue.filter((firing) => firing.entry !== entry);
        if (this.running && this.running.entry === entry) {
          this.running.signal.abort();
        }
        break;
    }
  }

  private submit(entry: RuleEntry, kind: ConditionKind, manual: boolean) {
    const now = this.scheduler.now();
    const config = entry.rule.action_config || {};
    const cooldownMs = Math.max(0, entry.rule.cooldown_seconds || 0) * 1000;
    const last = this.lastAccepted[entry.key];

    if (!manual && last !== undefined && now - last < cooldownMs) {
      this.record(entry, { status: 'dropped', reason: 'cooldown' });
      return;
    }

    if (!entry.action.usesPlayback) {
      this.lastAccepted[entry.key] = now;
      const signal = new AbortFlag();
      this.execute(entry, kind, signal).then(
        () => this.record(entry, { status: 'ran' }),
        (error) => this.fail(entry, error)
      );
      return;
    }

    const pending =
      (this.running && this.running.entry.key === entry.key) ||
      this.queue.some((firing) => firing.entry.key === entry.key);
    if (pending) {
      this.record(entry, { status: 'dropped', reason: 'duplicate' });
      return;
    }

    this.lastAccepted[entry.key] = now;
    const firing: Firing = {
      seq: this.seq++,
      entry,
      kind,
      priority: entry.action.priority?.(config) || 'normal',
      createdAt: now,
      expiresAt:
        now +
        (entry.action.maxWaitMs
          ? entry.action.maxWaitMs(config)
          : DEFAULT_MAX_WAIT_MS),
      signal: new AbortFlag(),
    };

    const running = this.running;
    if (!running) {
      this.start(firing);
    } else if (firing.priority === 'high' && running.priority === 'normal') {
      running.dropReason = 'preempted';
      this.running = undefined;
      running.signal.abort();
      this.start(firing);
    } else {
      this.queue.push(firing);
      this.queue.sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          a.entry.automationIndex - b.entry.automationIndex ||
          a.entry.rule.index - b.entry.rule.index ||
          a.seq - b.seq
      );
      this.record(entry, { status: 'queued' });
    }
  }

  private start(firing: Firing) {
    this.running = firing;
    this.record(firing.entry, { status: 'running' });
    this.execute(firing.entry, firing.kind, firing.signal)
      .then(
        () =>
          this.record(
            firing.entry,
            firing.dropReason
              ? { status: 'dropped', reason: firing.dropReason }
              : { status: 'ran' }
          ),
        (error) => this.fail(firing.entry, error)
      )
      .then(() => {
        if (this.running !== firing) return;
        this.running = undefined;
        this.runNext();
      });
  }

  private execute(entry: RuleEntry, kind: ConditionKind, signal: AbortFlag) {
    return new Promise<void>((resolve, reject) => {
      try {
        entry.action
          .run(entry.rule.action_config || {}, {
            rule: entry.rule,
            automation: entry.automation,
            kind,
            host: this.opts.host,
            scheduler: this.scheduler,
            signal,
          })
          .then(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private runNext() {
    const now = this.scheduler.now();
    while (this.queue.length) {
      const firing = this.queue.shift()!;
      if (now > firing.expiresAt) {
        this.record(firing.entry, { status: 'dropped', reason: 'expired' });
        continue;
      }
      this.start(firing);
      return;
    }
    this.opts.host.resumeProgramming();
  }

  private dropQueued(reason: DropReason) {
    const queued = this.queue;
    this.queue = [];
    queued.forEach((firing) =>
      this.record(firing.entry, { status: 'dropped', reason })
    );
  }

  private stopSources() {
    this.entries.forEach((entry) => {
      try {
        entry.source?.stop();
      } catch {
        // A failing source must not prevent the others from stopping.
      }
    });
  }

  private fail(entry: RuleEntry, error: unknown) {
    const record = this.record(entry, { status: 'dropped', reason: 'failed' });
    this.opts.onError?.(error, record);
  }

  private record(entry: RuleEntry, result: FiringResult): FiringRecord {
    const record: FiringRecord = {
      automationId: entry.automation.id,
      automationName: entry.automation.name,
      ruleId: entry.rule.id,
      at: this.scheduler.now(),
      result,
    };
    this.records.unshift(record);
    if (this.records.length > HISTORY_SIZE) this.records.length = HISTORY_SIZE;
    this.opts.onRecord?.(record);
    return record;
  }
}
