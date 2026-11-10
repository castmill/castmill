import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import {
  DeviceAutomation,
  DeviceAutomationRule,
  DevicesService,
} from '../services/devices.service';
import {
  DeviceAutomations,
  deviceActionSummary,
  deviceRuleSummary,
  upcomingFirings,
} from './device-automations';

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    getDeviceAutomations: vi.fn(),
  },
}));

const device = {
  id: 'device-1',
  name: 'Player',
  online: true,
} as Device;

const t = (key: string, params?: Record<string, any>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const rule = (
  occurrences: number[],
  config: Record<string, any> = { playlist_id: 12, start: 'immediately' }
): DeviceAutomationRule => ({
  id: `r-${occurrences.join('-')}`,
  index: 0,
  source: 'clock',
  condition: 'at',
  kind: 'event',
  source_payload: { occurrences },
  action: 'interrupt',
  action_config: config,
  cooldown_seconds: 0,
});

const now = Date.now();
const HOUR = 3_600_000;

const automations: DeviceAutomation[] = [
  {
    id: 1,
    name: 'Spring offer',
    via: [{ type: 'device' }],
    rules: [rule([now + 3 * HOUR, now + HOUR, now - HOUR])],
  },
  {
    id: 2,
    name: 'Lunch',
    via: [{ type: 'channel', id: 3, name: 'Lobby' }],
    rules: [
      rule([now + 2 * HOUR], {
        playlist_id: 7,
        start: 'after_current_item',
        plays: 2,
        priority: 'high',
      }),
    ],
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('device automation helpers', () => {
  it('sorts upcoming firings across automations and drops past ones', () => {
    const firings = upcomingFirings(automations, now);
    expect(firings.map((f) => f.automation)).toEqual([
      'Spring offer',
      'Lunch',
      'Spring offer',
    ]);
    expect(upcomingFirings(automations, now, 1)).toHaveLength(1);
    expect(upcomingFirings([{ ...automations[0], rules: [] }], now)).toEqual(
      []
    );
  });

  it('limits the list to ten firings', () => {
    const many = Array.from({ length: 30 }, (_, i) => now + (i + 1) * HOUR);
    expect(
      upcomingFirings([{ ...automations[0], rules: [rule(many)] }], now)
    ).toHaveLength(10);
  });

  it('summarizes interrupt rules in plain language', () => {
    expect(deviceActionSummary(automations[0].rules[0], t)).toBe(
      'automations.summary.interruptImmediately:{"playlist":"automations.summary.playlistFallback:{\\"id\\":12}"}'
    );
    const summary = deviceActionSummary(automations[1].rules[0], t);
    expect(summary).toContain('automations.summary.interruptAfterItem');
    expect(summary).toContain('automations.summary.plays');
    expect(summary).toContain('automations.summary.highPriority');
    expect(
      deviceActionSummary(rule([], { start: 'immediately' }), t)
    ).toContain('automations.summary.noPlaylist');
  });

  it('falls back to the raw type names for unknown types', () => {
    const custom = { ...rule([]), source: 'motion', action: 'mute' };
    expect(deviceRuleSummary(custom, t)).toBe('motion → mute');
    const labels = (key: string) =>
      key === 'automations.sources.clock.label' ? 'Clock' : key;
    expect(deviceRuleSummary(rule([]), labels)).toMatch(/^Clock → /);
  });
});

describe('DeviceAutomations', () => {
  it('lists effective automations and upcoming firings', async () => {
    vi.mocked(DevicesService.getDeviceAutomations).mockResolvedValue({
      data: {
        generated_at: now,
        valid_until: now + 14 * 24 * HOUR,
        timezone: 'Europe/Stockholm',
        automations,
      },
    });

    render(() => <DeviceAutomations baseUrl="/api" device={device} t={t} />);

    expect(await screen.findAllByTestId('device-automation')).toHaveLength(2);
    expect(DevicesService.getDeviceAutomations).toHaveBeenCalledWith(
      '/api',
      'device-1'
    );
    expect(
      screen.getByText('automations.device.viaDevice')
    ).toBeInTheDocument();
    expect(
      screen.getByText('automations.device.viaChannel:{"name":"Lobby"}')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('device-automation-firing')).toHaveLength(3);
    expect(
      screen.getByText(
        'automations.device.timezoneNote:{"timezone":"Europe/Stockholm"}'
      )
    ).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    vi.mocked(DevicesService.getDeviceAutomations).mockResolvedValue({
      data: {
        generated_at: now,
        valid_until: now,
        timezone: '',
        automations: [],
      },
    });
    render(() => <DeviceAutomations baseUrl="/api" device={device} />);
    expect(
      await screen.findByText('automations.device.empty')
    ).toBeInTheDocument();
  });

  it('shows when nothing is upcoming', async () => {
    vi.mocked(DevicesService.getDeviceAutomations).mockResolvedValue({
      data: {
        generated_at: now,
        valid_until: now,
        timezone: 'Invalid/Zone',
        automations: [{ ...automations[0], via: [], rules: [rule([1])] }],
      },
    });
    render(() => <DeviceAutomations baseUrl="/api" device={device} t={t} />);
    expect(
      await screen.findByText('automations.device.noUpcoming')
    ).toBeInTheDocument();
  });

  it('shows an error and retries on refresh', async () => {
    vi.mocked(DevicesService.getDeviceAutomations)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        data: {
          generated_at: now,
          valid_until: now,
          timezone: 'UTC',
          automations,
        },
      });
    render(() => <DeviceAutomations baseUrl="/api" device={device} t={t} />);
    expect(
      await screen.findByText('automations.device.loadFailed')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'automations.device.refresh' })
    );
    await waitFor(() =>
      expect(screen.getAllByTestId('device-automation')).toHaveLength(2)
    );
    expect(
      screen.queryByText('automations.device.loadFailed')
    ).not.toBeInTheDocument();
  });
});
