import { fireEvent, render, screen, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import { DevicesService } from '../services/devices.service';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@castmill/ui-common', () => ({
  LoadingOverlay: () => null,
  useToast: () => toast,
  formatRelativeTimeLocalized: () => '5 minutes ago',
  formatTimestamp: (value: string) => value,
}));
vi.mock('./device-info', () => ({ DeviceInfo: () => null }));
vi.mock('./channels', () => ({ Channels: () => <p>Channels panel</p> }));
vi.mock('./maintainance', () => ({ Maintainance: () => null }));
vi.mock('./device-telemetry', () => ({ DeviceTelemetry: () => null }));
vi.mock('./device-events', () => ({ DeviceLogs: () => null }));
vi.mock('./device-cache', () => ({ DeviceCache: () => null }));
vi.mock('./device-schedule', () => ({
  DeviceSchedule: () => <p>Schedule panel</p>,
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
vi.mock('../services/devices.service', () => ({
  DevicesService: { updateDevice: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

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
    renderView({ online: false, last_online: new Date() });
    expect(screen.getByText('common.offline')).toBeInTheDocument();
    expect(
      screen.getByText('devices.details.lastSeen:5 minutes ago')
    ).toBeInTheDocument();
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
