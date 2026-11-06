import { describe, expect, it, vi } from 'vitest';
import { AutomationEngine } from './engine';
import { AutomationRegistry } from './registry';
import { ClockSource } from './sources/clock';
import { InterruptAction } from './actions/interrupt';
import { createDefaultRegistry } from './index';
import type {
  Action,
  ActionContext,
  AutomationsPayload,
  DeviceRule,
  Emission,
  EventSource,
  PlaybackHost,
  Scheduler,
} from './types';

/** Deterministic scheduler: time only moves through `advance`. */
class FakeScheduler implements Scheduler {
  time = 0;
  private timers: Array<{ at: number; callback: () => void; id: number }> = [];
  private seq = 0;

  now() {
    return this.time;
  }

  setTimeout(callback: () => void, ms: number) {
    const id = ++this.seq;
    this.timers.push({ at: this.time + ms, callback, id });
    return id;
  }

  clearTimeout(handle: unknown) {
    this.timers = this.timers.filter((timer) => timer.id !== handle);
  }

  advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const timer = this.timers[0];
      if (!timer || timer.at > end) break;
      this.timers.shift();
      this.time = timer.at;
      timer.callback();
    }
    this.time = end;
  }
}

/** Source driven by the test. */
class StubSource implements EventSource {
  static instances: StubSource[] = [];
  emit?: (emission: Emission) => void;
  config?: Record<string, unknown>;
  stopped = false;

  constructor() {
    StubSource.instances.push(this);
  }

  start(config: Record<string, unknown>, emit: (e: Emission) => void) {
    this.config = config;
    this.emit = emit;
  }

  stop() {
    this.stopped = true;
  }

  next() {
    return this.config?.next as number | undefined;
  }
}

interface Run {
  ruleId: string;
  kind: string;
  aborted: boolean;
  finish: () => void;
  fail: (error: unknown) => void;
}

/** Action controlled by the test: runs until `finish` or abort. */
class StubAction implements Action {
  static runs: Run[] = [];
  usesPlayback = true;

  priority(config: Record<string, unknown>) {
    return config.priority === 'high' ? 'high' : 'normal';
  }

  maxWaitMs(config: Record<string, unknown>) {
    return ((config.max_wait_seconds as number) ?? 120) * 1000;
  }

  run(_config: Record<string, unknown>, context: ActionContext) {
    return new Promise<void>((resolve, reject) => {
      const run: Run = {
        ruleId: context.rule.id,
        kind: context.kind,
        aborted: false,
        finish: resolve,
        fail: reject,
      };
      context.signal.onAbort(() => {
        run.aborted = true;
        resolve();
      });
      StubAction.runs.push(run);
    });
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const rule = (
  id: string,
  index: number,
  extra: Partial<DeviceRule> = {}
): DeviceRule => ({
  id,
  index,
  source: 'stub',
  condition: 'at',
  kind: 'event',
  source_payload: {},
  action: 'stub_action',
  action_config: {},
  cooldown_seconds: 0,
  ...extra,
});

const payload = (
  automations: Array<{ id: number; rules: DeviceRule[] }>
): AutomationsPayload => ({
  generated_at: 0,
  valid_until: 14 * 86400000,
  automations: automations.map((automation) => ({
    ...automation,
    name: `Automation ${automation.id}`,
  })),
});

const fakeHost = (): PlaybackHost & { resumes: number } => {
  const host = {
    resumes: 0,
    preparePlaylist: vi.fn(async (id: number | string) => ({ id })),
    waitForItemBoundary: vi.fn(async () => undefined),
    playInterruption: vi.fn(async () => undefined),
    resumeProgramming: vi.fn(() => {
      host.resumes++;
    }),
  };
  return host;
};

const setup = () => {
  StubSource.instances = [];
  StubAction.runs = [];
  const scheduler = new FakeScheduler();
  const host = fakeHost();
  const registry = new AutomationRegistry()
    .registerSource('stub', () => new StubSource())
    .registerAction('stub_action', () => new StubAction());
  const records: string[] = [];
  const engine = new AutomationEngine({
    registry,
    host,
    scheduler,
    onRecord: (record) =>
      records.push(
        `${record.ruleId}:${
          record.result.status === 'dropped'
            ? `dropped:${record.result.reason}`
            : record.result.status
        }`
      ),
  });
  const fire = (index: number) =>
    StubSource.instances[index].emit!({ type: 'fire' });
  return { scheduler, host, registry, engine, records, fire };
};

describe('AutomationEngine', () => {
  it('runs a new source and action type registered only in the registry', async () => {
    const { engine, fire, host } = setup();
    engine.load(payload([{ id: 1, rules: [rule('a', 0)] }]));

    fire(0);
    expect(StubAction.runs.map((run) => run.ruleId)).toEqual(['a']);
    StubAction.runs[0].finish();
    await flush();
    expect(engine.lastFiring()?.result).toEqual({ status: 'ran' });
    expect(host.resumeProgramming).toHaveBeenCalledTimes(1);
  });

  it('ignores rules whose source or action is unknown', () => {
    const { engine } = setup();
    engine.load(
      payload([
        {
          id: 1,
          rules: [
            rule('a', 0, { source: 'gps' }),
            rule('b', 1, { action: 'volume' }),
            rule('c', 2),
          ],
        },
      ])
    );
    expect(StubSource.instances).toHaveLength(2);
    expect(StubSource.instances[1].config).toEqual({});
  });

  it('never interleaves playback firings and runs them in automation then rule order', async () => {
    const { engine, fire, records } = setup();
    engine.load(
      payload([
        { id: 1, rules: [rule('first-a', 0), rule('first-b', 1)] },
        { id: 2, rules: [rule('second', 0)] },
      ])
    );

    fire(2);
    fire(1);
    fire(0);
    expect(StubAction.runs.map((run) => run.ruleId)).toEqual(['second']);
    expect(records).toContain('first-a:queued');

    StubAction.runs[0].finish();
    await flush();
    expect(StubAction.runs.map((run) => run.ruleId)).toEqual([
      'second',
      'first-a',
    ]);
    StubAction.runs[1].finish();
    await flush();
    StubAction.runs[2].finish();
    await flush();
    expect(StubAction.runs.map((run) => run.ruleId)).toEqual([
      'second',
      'first-a',
      'first-b',
    ]);
    expect(engine.busy).toBe(false);
  });

  it('lets a high priority firing preempt a running normal one', async () => {
    const { engine, fire, records, host } = setup();
    engine.load(
      payload([
        {
          id: 1,
          rules: [
            rule('normal', 0),
            rule('alarm', 1, { action_config: { priority: 'high' } }),
          ],
        },
      ])
    );

    fire(0);
    fire(1);
    await flush();
    expect(StubAction.runs[0].aborted).toBe(true);
    expect(StubAction.runs[1].ruleId).toBe('alarm');
    expect(records).toContain('normal:dropped:preempted');
    // Programming is not resumed between the two firings.
    expect(host.resumeProgramming).not.toHaveBeenCalled();

    // A high firing is never preempted, the next one waits.
    fire(0);
    expect(StubAction.runs).toHaveLength(2);
    StubAction.runs[1].finish();
    await flush();
    expect(StubAction.runs[2].ruleId).toBe('normal');
  });

  it('runs high priority queued firings first', async () => {
    const { engine, fire } = setup();
    engine.load(
      payload([
        {
          id: 1,
          rules: [
            rule('running', 0, { action_config: { priority: 'high' } }),
            rule('normal', 1),
            rule('high', 2, { action_config: { priority: 'high' } }),
          ],
        },
      ])
    );
    fire(0);
    fire(1);
    fire(2);
    StubAction.runs[0].finish();
    await flush();
    expect(StubAction.runs[1].ruleId).toBe('high');
  });

  it('drops queued firings after their maximum wait', async () => {
    const { engine, fire, scheduler, records } = setup();
    engine.load(
      payload([
        {
          id: 1,
          rules: [
            rule('long', 0),
            rule('impatient', 1, { action_config: { max_wait_seconds: 10 } }),
          ],
        },
      ])
    );
    fire(0);
    fire(1);
    scheduler.advance(11000);
    StubAction.runs[0].finish();
    await flush();
    expect(StubAction.runs).toHaveLength(1);
    expect(records).toContain('impatient:dropped:expired');
  });

  it('keeps one pending firing per rule so simultaneous firings cannot starve others', async () => {
    const { engine, fire, records } = setup();
    engine.load(payload([{ id: 1, rules: [rule('a', 0), rule('b', 1)] }]));
    fire(0);
    fire(0);
    fire(1);
    fire(1);
    expect(records.filter((r) => r.endsWith('duplicate'))).toHaveLength(2);
    StubAction.runs[0].finish();
    await flush();
    expect(StubAction.runs[1].ruleId).toBe('b');
  });

  it('enforces cooldowns, except for "Run now"', async () => {
    const { engine, fire, scheduler, records } = setup();
    const cooled = rule('a', 0, { cooldown_seconds: 60 });
    engine.load(payload([{ id: 1, rules: [cooled] }]));

    fire(0);
    StubAction.runs[0].finish();
    await flush();
    scheduler.advance(30000);
    fire(0);
    expect(records).toContain('a:dropped:cooldown');

    engine.runNow({ id: 1, name: 'Automation 1', rules: [] }, cooled);
    expect(StubAction.runs).toHaveLength(2);
    StubAction.runs[1].finish();
    await flush();

    scheduler.advance(61000);
    fire(0);
    expect(StubAction.runs).toHaveLength(3);
  });

  it('runs "Run now" for rules that are not loaded and reports unsupported actions', () => {
    const { engine, records } = setup();
    engine.runNow({ id: 9, name: 'Remote', rules: [] }, rule('remote', 0));
    expect(StubAction.runs.map((run) => run.ruleId)).toEqual(['remote']);

    engine.runNow(
      { id: 9, name: 'Remote', rules: [] },
      rule('other', 1, { action: 'teleport' })
    );
    expect(records).toContain('other:dropped:unsupported');
    engine.runNow(undefined as never, undefined as never);
  });

  it('loops state conditions while active and ends them when inactive', async () => {
    const { engine, records } = setup();
    engine.load(
      payload([{ id: 1, rules: [rule('inside', 0, { kind: 'state' })] }])
    );
    const source = StubSource.instances[0];

    source.emit!({ type: 'active' });
    source.emit!({ type: 'active' });
    expect(StubAction.runs).toHaveLength(1);
    expect(StubAction.runs[0].kind).toBe('state');

    source.emit!({ type: 'inactive' });
    source.emit!({ type: 'inactive' });
    await flush();
    expect(StubAction.runs[0].aborted).toBe(true);
    expect(records).toContain('inside:ran');
  });

  it('removes queued state firings when the state ends', async () => {
    const { engine, fire } = setup();
    engine.load(
      payload([
        {
          id: 1,
          rules: [rule('busy', 0), rule('state', 1, { kind: 'state' })],
        },
      ])
    );
    fire(0);
    StubSource.instances[1].emit!({ type: 'active' });
    StubSource.instances[1].emit!({ type: 'inactive' });
    StubAction.runs[0].finish();
    await flush();
    expect(StubAction.runs).toHaveLength(1);
  });

  it('runs actions that do not use playback independently', async () => {
    const { engine, registry, fire, host } = setup();
    const run = vi.fn(async () => undefined);
    registry.registerAction('volume', () => ({ usesPlayback: false, run }));
    engine.load(
      payload([
        {
          id: 1,
          rules: [rule('busy', 0), rule('volume', 1, { action: 'volume' })],
        },
      ])
    );
    fire(0);
    fire(1);
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(engine.busy).toBe(true);
    expect(engine.lastFiring()?.ruleId).toBe('volume');
    expect(host.resumeProgramming).not.toHaveBeenCalled();
  });

  it('reports failing actions and continues with the next firing', async () => {
    const onError = vi.fn();
    const { registry, host, scheduler } = setup();
    registry.registerAction('broken', () => ({
      usesPlayback: true,
      run: () => {
        throw new Error('boom');
      },
    }));
    registry.registerAction('rejects', () => ({
      usesPlayback: false,
      run: async () => {
        throw new Error('nope');
      },
    }));
    const engine = new AutomationEngine({ registry, host, scheduler, onError });
    engine.load(
      payload([
        {
          id: 1,
          rules: [
            rule('broken', 0, { action: 'broken' }),
            rule('rejects', 1, { action: 'rejects' }),
          ],
        },
      ])
    );
    StubSource.instances[0].emit!({ type: 'fire' });
    StubSource.instances[1].emit!({ type: 'fire' });
    await flush();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(engine.history().map((r) => r.result)).toContainEqual({
      status: 'dropped',
      reason: 'failed',
    });
    expect(engine.busy).toBe(false);
  });

  it('reports sources that fail to start', () => {
    const onError = vi.fn();
    const { registry, host, scheduler } = setup();
    registry.registerSource('broken', () => ({
      start: () => {
        throw new Error('no gps');
      },
      stop: () => {
        throw new Error('still no gps');
      },
    }));
    const engine = new AutomationEngine({ registry, host, scheduler, onError });
    engine.load(
      payload([{ id: 1, rules: [rule('a', 0, { source: 'broken' })] }])
    );
    expect(onError).toHaveBeenCalledTimes(1);
    engine.load(undefined);
  });

  it('reloads payloads, dropping queued firings but keeping the running one', async () => {
    const { engine, fire, records, host } = setup();
    engine.load(payload([{ id: 1, rules: [rule('a', 0), rule('b', 1)] }]));
    fire(0);
    fire(1);
    const [first] = StubSource.instances;

    engine.load(payload([{ id: 1, rules: [rule('a', 0)] }]));
    expect(first.stopped).toBe(true);
    expect(records).toContain('b:dropped:stopped');
    // Emissions from stopped sources are ignored.
    first.emit!({ type: 'fire' });
    expect(StubAction.runs).toHaveLength(1);

    StubAction.runs[0].finish();
    await flush();
    expect(host.resumeProgramming).toHaveBeenCalledTimes(1);
  });

  it('stops everything without resuming programming on dispose', async () => {
    const { engine, fire, host, records } = setup();
    engine.load(payload([{ id: 1, rules: [rule('a', 0), rule('b', 1)] }]));
    fire(0);
    fire(1);
    engine.dispose();
    await flush();
    expect(StubAction.runs[0].aborted).toBe(true);
    expect(records).toContain('a:dropped:stopped');
    expect(host.resumeProgramming).not.toHaveBeenCalled();
    expect(engine.busy).toBe(false);
  });

  it('reports the next firing of all sources', () => {
    const { engine } = setup();
    expect(engine.nextFiring()).toBeUndefined();
    engine.load(
      payload([
        { id: 1, rules: [rule('late', 0, { source_payload: { next: 500 } })] },
        { id: 2, rules: [rule('soon', 0, { source_payload: { next: 100 } })] },
      ])
    );
    expect(engine.nextFiring()).toEqual({
      at: 100,
      automationId: 2,
      automationName: 'Automation 2',
      ruleId: 'soon',
    });
  });

  it('keeps a bounded firing history', () => {
    const { engine, fire } = setup();
    engine.load(payload([{ id: 1, rules: [rule('a', 0)] }]));
    for (let i = 0; i < 30; i++) fire(0);
    expect(engine.history()).toHaveLength(20);
  });
});

describe('clock to interrupt, end to end', () => {
  it('interrupts at the server-expanded occurrences with the default registry', async () => {
    const scheduler = new FakeScheduler();
    scheduler.time = 1000;
    const host = fakeHost();
    const engine = new AutomationEngine({
      registry: createDefaultRegistry(),
      host,
      scheduler,
    });
    engine.load({
      generated_at: 1000,
      valid_until: 10_000_000,
      automations: [
        {
          id: 1,
          name: 'Spring',
          rules: [
            {
              ...rule('clock', 0),
              source: 'clock',
              action: 'interrupt',
              source_payload: { occurrences: [60_000, 120_000] },
              action_config: { playlist_id: 12, plays: 2 },
            },
          ],
        },
      ],
    });
    // Content is preloaded when the payload is loaded.
    expect(host.preparePlaylist).toHaveBeenCalledWith(12);
    expect(engine.nextFiring()?.at).toBe(60_000);

    scheduler.advance(59_000);
    await flush();
    expect(host.playInterruption).toHaveBeenCalledTimes(1);
    expect(host.playInterruption).toHaveBeenCalledWith(
      { id: 12 },
      2,
      expect.anything()
    );
    expect(host.resumeProgramming).toHaveBeenCalledTimes(1);
  });

  it('exposes the default types for capabilities', () => {
    const registry = createDefaultRegistry();
    expect(registry.sourceTypes()).toEqual(['clock']);
    expect(registry.actionTypes()).toEqual(['interrupt']);
    expect(registry.createSource('clock')).toBeInstanceOf(ClockSource);
    expect(registry.createAction('interrupt')).toBeInstanceOf(InterruptAction);
    expect(registry.createSource('gps')).toBeUndefined();
  });
});
