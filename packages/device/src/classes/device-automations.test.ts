import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageIntegration } from '@castmill/cache';
import type { Machine } from '../interfaces/machine';
import { Device } from './device';
import { AutomationRegistry, createDefaultRegistry } from '../automations';

const payload = {
  generated_at: 0,
  valid_until: Date.now() + 86400000,
  automations: [
    {
      id: 1,
      name: 'Spring',
      rules: [
        {
          id: 'r1',
          index: 0,
          source: 'clock',
          condition: 'at',
          kind: 'event',
          source_payload: { occurrences: [] },
          action: 'interrupt',
          action_config: { playlist_id: 12 },
          cooldown_seconds: 0,
        },
      ],
    },
  ],
};

type Internals = {
  id?: string;
  baseUrl: string;
  resourceManager?: unknown;
  automationsPayload?: unknown;
  automationEngine?: { runNow: ReturnType<typeof vi.fn> };
  automationPlayback?: unknown;
  startAutomations(id: string, container: HTMLElement): void;
  stopAutomations(final?: boolean): void;
  refreshAutomations(id: string, fresh: boolean): Promise<void>;
  runAutomationNow(message: unknown): void;
  updateAutomationsDebug(): void;
  resetPlaybackQueue(): void;
  loadAutomationPlaylist(id: number): Promise<unknown>;
};

const create = (registry?: AutomationRegistry) =>
  new Device({} as Machine, {} as StorageIntegration, {
    automationRegistry: registry,
  });

describe('Device automations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports the supported automation sources and actions', () => {
    const capabilities = create().getCapabilities();
    expect(capabilities.automation_sources).toEqual(['clock']);
    expect(capabilities.automation_actions).toEqual(['interrupt']);

    const registry = createDefaultRegistry().registerSource('gps', () => ({
      start: () => undefined,
      stop: () => undefined,
    }));
    expect(create(registry).getCapabilities().automation_sources).toEqual([
      'clock',
      'gps',
    ]);
  });

  it('loads the payload, refreshes it daily and runs rules on request', async () => {
    vi.useFakeTimers();
    const device = create();
    const internals = device as unknown as Internals;
    const getData = vi.fn(async () => ({ data: payload }));
    const getFreshData = vi.fn(async () => ({ data: payload }));
    internals.id = 'dev-1';
    internals.baseUrl = 'https://api';
    internals.resourceManager = { getData, getFreshData };

    // Before the player starts there is no engine to load.
    await internals.refreshAutomations('dev-1', true);
    expect(getFreshData).not.toHaveBeenCalled();

    internals.startAutomations('dev-1', document.createElement('div'));
    await vi.waitFor(() => expect(internals.automationsPayload).toBe(payload));
    expect(getData).toHaveBeenCalledWith(
      'https://api/devices/dev-1/automations',
      1000
    );

    // A request during a load queues one more fresh load.
    const first = internals.refreshAutomations('dev-1', true);
    const second = internals.refreshAutomations('dev-1', true);
    expect(first).toBe(second);
    await first;
    expect(getFreshData).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    await vi.waitFor(() => expect(getFreshData).toHaveBeenCalledTimes(3));

    const runNow = vi.fn();
    internals.automationEngine!.runNow = runNow;
    internals.runAutomationNow({
      automation_id: 1,
      rule: payload.automations[0].rules[0],
    });
    expect(runNow.mock.calls[0][0]).toBe(payload.automations[0]);
    internals.runAutomationNow({ automation_id: 7, rule: { id: 'x' } });
    expect(runNow.mock.calls[1][0]).toMatchObject({ id: 7, name: '7' });
    internals.runAutomationNow({});
    expect(runNow).toHaveBeenCalledTimes(2);

    internals.updateAutomationsDebug();
    internals.stopAutomations(true);
    await device.stop().catch(() => undefined);
  });

  it('keeps the cached payload when a load fails', async () => {
    const device = create();
    const internals = device as unknown as Internals;
    internals.resourceManager = {
      getData: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    internals.startAutomations('dev-1', document.createElement('div'));
    await internals.refreshAutomations('dev-1', false);
    expect(internals.automationsPayload).toBeUndefined();
    internals.stopAutomations(true);
  });

  it('loads automation playlists through the device playlist endpoint', async () => {
    const device = create();
    const internals = device as unknown as Internals;
    const json = { id: 12, name: 'Offer', status: 'live', items: [] };
    internals.id = 'dev-1';
    internals.baseUrl = 'https://api';
    internals.resourceManager = { getData: vi.fn(async () => json) };
    await expect(internals.loadAutomationPlaylist(12)).resolves.toBe(json);
    expect(
      (internals.resourceManager as { getData: ReturnType<typeof vi.fn> })
        .getData
    ).toHaveBeenCalledWith('https://api/devices/dev-1/playlists/12', 1000);
  });

  it('keeps an interruption when programming changes, resuming fresh content', () => {
    const device = create();
    const internals = device as unknown as Internals;
    const invalidateResume = vi.fn();
    internals.automationPlayback = { interrupted: true, invalidateResume };
    internals.resetPlaybackQueue();
    expect(invalidateResume).toHaveBeenCalled();
  });
});
