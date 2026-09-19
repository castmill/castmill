import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceCache } from './device-cache';
import { DevicesService } from '../services/devices.service';

const reloadData = vi.fn();

vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button onClick={props.onClick} disabled={props.loading}>
      {props.label}
    </button>
  ),
  ConfirmDialog: (props: any) => (
    <button onClick={props.onConfirm}>{`Confirm ${props.title}`}</button>
  ),
  IconButton: (props: any) => (
    <button onClick={props.onClick} aria-label={props.title} />
  ),
  TableView: (props: any) => {
    props.ref?.({ reloadData });

    return (
      <section>
        {props.toolbar.actions()}
        <button
          onClick={() =>
            props.table.actions[0].handler({
              url: `${props.resource}.json`,
            })
          }
        >
          {props.table.actions[0].label}
        </button>
      </section>
    );
  },
  Tabs: (props: any) => <>{props.tabs.map((tab: any) => tab.content())}</>,
  formatBytes: (size: number) => String(size),
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    deleteDeviceCache: vi.fn().mockResolvedValue({ success: true, deleted: 3 }),
    getDeviceCache: vi.fn(),
  },
}));

describe('DeviceCache', () => {
  const t = (key: string) =>
    ({
      'devices.cache.clearAll': 'Clear Entire Cache',
      'devices.cache.confirmClearAll': 'Clear Entire Cache',
      'devices.cache.deleteSelected': 'Delete selected items',
      'common.delete': 'Delete',
    })[key] || key;

  beforeEach(() => {
    vi.clearAllMocks();
    reloadData.mockClear();
  });

  it('renders one global clear action and sends the all-cache request after confirmation', async () => {
    render(() => (
      <DeviceCache
        baseUrl="/api"
        device={{ id: 'device-1', online: true } as any}
        t={t}
      />
    ));

    expect(
      screen.getAllByRole('button', { name: 'Clear Entire Cache' })
    ).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Entire Cache' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm Clear Entire Cache' })
    );

    await waitFor(() => {
      expect(DevicesService.deleteDeviceCache).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'all',
        []
      );
    });
    expect(reloadData).not.toHaveBeenCalled();
  });
});
