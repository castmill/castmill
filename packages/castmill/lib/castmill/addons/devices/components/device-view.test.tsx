import { fireEvent, render, screen, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import { DevicesService } from '../services/devices.service';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@castmill/ui-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@castmill/ui-common')>();
  return {
    ...actual,
    LoadingOverlay: () => null,
    useToast: () => toast,
    formatTimestamp: (value: string) => value,
  };
});
vi.mock('./device-info', () => ({ DeviceInfo: () => null }));
vi.mock('./device-health', () => ({ DeviceHealth: () => null }));
const mounts = vi.hoisted(() => ({ channels: 0 }));
vi.mock('./channels', () => ({
  Channels: () => {
    mounts.channels++;
    return <p>Channels panel</p>;
  },
}));
vi.mock('./maintainance', () => ({ Maintainance: () => null }));
vi.mock('./device-telemetry', () => ({ DeviceTelemetry: () => null }));
vi.mock('./device-events', () => ({ DeviceLogs: () => null }));
vi.mock('./device-cache', () => ({ DeviceCache: () => null }));
vi.mock('./device-schedule', () => ({
  DeviceSchedule: () => <p>Schedule panel</p>,
}));
vi.mock('./device-automations', () => ({
  DeviceAutomations: () => <p>Automations panel</p>,
}));
vi.mock('./device-details', () => ({
  DeviceDetails: (props: {
    onSubmit: (value: { orientation: 90 }) => Promise<boolean>;
  }) => (
    <button onClick={() => props.onSubmit({ orientation: 90 })}>
      Save orientation
    </button>
  ),
}));
// The preview tab pulls in the built player bundle, which this suite does not need.
vi.mock('./device-preview', () => ({ DevicePreview: () => null }));
vi.mock('./device-os-update', () => ({
  DeviceOsUpdate: () => <p>OS update panel</p>,
}));
vi.mock('../services/devices.service', () => ({
  DevicesService: { updateDevice: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.clearAllMocks();
});

describe('Details save results', () => {
  it('preserves an application report received before the save response', async () => {
    const [device, setDevice] = createSignal({
      id: 'device-1',
      orientation: 0,
    } as Device);
    vi.mocked(DevicesService.updateDevice).mockResolvedValue({
      id: 'device-1',
      orientation: 90,
    } as Device);
    const onChange = vi.fn();
    render(() => (
      <DeviceView
        baseUrl="/api"
        organization_id="org-1"
        device={device()}
        onChange={onChange}
      />
    ));
    fireEvent.click(screen.getByText('Save orientation'));
    const report = { orientation: 90, status: 'applied', mode: 'css' } as const;
    setDevice({
      id: 'device-1',
      orientation: 90,
      orientation_status: report,
    } as Device);
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        id: 'device-1',
        orientation: 90,
        orientation_status: report,
      })
    );
  });
  it('notifies the parent only with the successful server response', async () => {
    const updated = { id: 'device-1', orientation: 90 } as Device;
    vi.mocked(DevicesService.updateDevice).mockResolvedValue(updated);
    const onChange = vi.fn();
    render(() => (
      <DeviceView
        baseUrl="/api"
        organization_id="org-1"
        device={{ id: 'device-1' } as Device}
        onChange={onChange}
      />
    ));
    fireEvent.click(screen.getByText('Save orientation'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(updated));
  });

  it('never reports an unsuccessful save as an updated device', async () => {
    vi.mocked(DevicesService.updateDevice).mockRejectedValue(
      new Error('denied')
    );
    const onChange = vi.fn();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(() => (
      <DeviceView
        baseUrl="/api"
        organization_id="org-1"
        device={{ id: 'device-1' } as Device}
        onChange={onChange}
      />
    ));
    fireEvent.click(screen.getByText('Save orientation'));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('Device view layout', () => {
  const renderView = (device: Partial<Device>) =>
    render(() => (
      <DeviceView
        baseUrl="/api"
        organization_id="org-1"
        device={{ id: 'device-1', online: true, ...device } as Device}
        t={(key, params) => (params ? `${key}:${params.time}` : key)}
      />
    ));

  it('summarizes connectivity and when an offline player was last seen', () => {
    renderView({
      online: false,
      last_online: new Date(Date.now() - 5 * 60_000),
    });
    expect(screen.getByText('common.offline')).toBeInTheDocument();
    expect(
      screen.getByText('devices.details.lastSeen:5 minutes ago')
    ).toBeInTheDocument();
  });

  it('refreshes last seen without device updates and stops its clock on disposal', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const timerCount = vi.getTimerCount();
    const { unmount } = renderView({
      online: false,
      last_online: new Date('2026-10-15T11:55:00Z'),
    });
    expect(
      screen.getByText('devices.details.lastSeen:5 minutes ago')
    ).toBeInTheDocument();

    vi.advanceTimersByTime(60_000);
    expect(
      screen.getByText('devices.details.lastSeen:6 minutes ago')
    ).toBeInTheDocument();

    unmount();
    expect(vi.getTimerCount()).toBe(timerCount);
  });

  it('switches sections by click and arrow keys with tab semantics', () => {
    renderView({});
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Save orientation')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'common.channels' }));
    expect(screen.getByText('Channels panel')).toBeInTheDocument();
    expect(screen.queryByText('Save orientation')).not.toBeInTheDocument();

    fireEvent.keyDown(tabs[1], { key: 'ArrowRight' });
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[2]).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      tabs[2].id
    );
    expect(screen.getByText('Schedule panel')).toBeInTheDocument();

    fireEvent.keyDown(tabs[2], { key: 'Home' });
    expect(tabs[0]).toHaveFocus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(tabs[tabs.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the automations section', () => {
    renderView({});
    fireEvent.click(
      screen.getByRole('tab', { name: 'automations.device.title' })
    );
    expect(screen.getByText('Automations panel')).toBeInTheDocument();
  });

  it('copies the device id and confirms it accessibly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderView({});
    fireEvent.click(
      screen.getByRole('button', { name: 'devices.details.copyId' })
    );
    expect(writeText).toHaveBeenCalledWith('device-1');
    expect(
      await screen.findByText('devices.details.copied')
    ).toBeInTheDocument();
  });
});

describe('Castmill OS tab', () => {
  it('appears when the first report arrives and keeps the selected tab', () => {
    const [device, setDevice] = createSignal({
      id: 'device-1',
      orientation: 0,
    } as Device);
    render(() => (
      <DeviceView baseUrl="/api" organization_id="org-1" device={device()} />
    ));
    const titles = () => screen.getAllByRole('tab').map((tab) => tab.title);

    expect(titles()).not.toContain('devices.osUpdate.title');
    fireEvent.click(screen.getByRole('tab', { name: 'common.channels' }));

    setDevice({
      ...device(),
      os_status: { compatible: 'castmill-os-genericx86-64', state: 'idle' },
    } as Device);

    expect(titles()).toContain('devices.osUpdate.title');
    expect(
      screen.getByRole('tab', { name: 'common.channels' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Channels panel')).toBeInTheDocument();
  });

  it('keeps the open panel mounted across live status updates', () => {
    const [device, setDevice] = createSignal({
      id: 'device-1',
      orientation: 0,
      online: true,
    } as Device);
    render(() => (
      <DeviceView baseUrl="/api" organization_id="org-1" device={device()} />
    ));
    fireEvent.click(screen.getByRole('tab', { name: 'common.channels' }));
    const before = mounts.channels;

    // A heartbeat, the first OS report (adds a tab) and a progress report.
    setDevice({ ...device(), online: false } as Device);
    setDevice({
      ...device(),
      os_status: { compatible: 'castmill-os-genericx86-64', state: 'idle' },
    } as Device);
    setDevice({
      ...device(),
      os_status: {
        compatible: 'castmill-os-genericx86-64',
        state: 'installing',
        progress: 40,
      },
    } as Device);

    expect(mounts.channels).toBe(before);
  });

  it('moves keyboard focus to the right tab after the OS tab appears', () => {
    const [device, setDevice] = createSignal({
      id: 'device-1',
      orientation: 0,
    } as Device);
    render(() => (
      <DeviceView baseUrl="/api" organization_id="org-1" device={device()} />
    ));
    const channels = screen.getByRole('tab', { name: 'common.channels' });
    fireEvent.click(channels);
    setDevice({
      ...device(),
      os_status: { compatible: 'castmill-os-genericx86-64', state: 'idle' },
    } as Device);

    fireEvent.keyDown(channels, { key: 'ArrowRight' });
    const schedule = screen.getByRole('tab', {
      name: 'devices.details.schedule',
    });
    expect(schedule).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(schedule);

    fireEvent.keyDown(schedule, { key: 'ArrowRight' });
    const os = screen.getByRole('tab', { name: 'devices.osUpdate.title' });
    expect(os).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(os);

    fireEvent.keyDown(os, { key: 'End' });
    const tabs = screen.getAllByRole('tab');
    expect(document.activeElement).toBe(tabs[tabs.length - 1]);
    expect(tabs[tabs.length - 1]).toHaveAttribute('aria-selected', 'true');
  });
});
