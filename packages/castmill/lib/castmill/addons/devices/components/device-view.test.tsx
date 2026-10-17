import { fireEvent, render, screen, cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import { DevicesService } from '../services/devices.service';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@castmill/ui-common', () => ({
  Tabs: (props: { tabs: Array<{ content: () => unknown }> }) =>
    props.tabs[0].content(),
  LoadingOverlay: () => null,
  useToast: () => toast,
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
