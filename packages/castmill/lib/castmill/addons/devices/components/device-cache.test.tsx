import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableView } from '@castmill/ui-common';
import { DeviceCache } from './device-cache';
import { DevicesService } from '../services/devices.service';

const reloadData = vi.fn();

vi.mock('@castmill/ui-common', () => ({
  ConfirmDialog: (props: any) => (
    <button onClick={props.onConfirm}>{`Confirm ${props.title}`}</button>
  ),
  TableView: vi.fn((props: any) => {
    props.ref?.({ reloadData });

    return (
      <section
        data-testid="table-view"
        data-initial-sort-key={props.initialSortOptions?.key}
        data-initial-sort-direction={props.initialSortOptions?.direction}
      >
        <button onClick={() => props.fetchData({ page: { num: 1, size: 10 } })}>
          Load page
        </button>
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
  }),
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
      'devices.cache.dataTab': 'Data',
      'devices.cache.mediaTab': 'Media',
      'common.delete': 'Delete',
    })[key] || key;

  beforeEach(() => {
    vi.clearAllMocks();
    reloadData.mockClear();
    vi.mocked(DevicesService.getDeviceCache).mockResolvedValue({
      data: [],
      count: 0,
    });
  });

  const renderCacheTable = async () => {
    const { TableView: RealTableView } = await vi.importActual<
      typeof import('@castmill/ui-common')
    >('@castmill/ui-common');
    vi.mocked(TableView).mockImplementationOnce(RealTableView);
    const entries = ['first.json', 'second.json', 'third.json'].map((url) => ({
      url,
      timestamp: 1720000000000,
      size: 128,
      accessed: 1,
      mimeType: 'application/json',
    }));
    vi.mocked(DevicesService.getDeviceCache).mockResolvedValue({
      data: entries,
      count: entries.length,
    });

    render(() => (
      <DeviceCache
        baseUrl="/api"
        device={{ id: 'device-1', online: true } as any}
        t={t}
      />
    ));
    await screen.findByText(entries[0].url);
    return entries;
  };

  it('selects and deselects cache entries independently', async () => {
    const entries = await renderCacheTable();
    const checkboxes = entries.map((entry) =>
      screen.getByRole('checkbox', { name: `Select row ${entry.url}` })
    );
    const deleteSelected = screen.getByRole('button', {
      name: 'Delete selected items',
    });
    expect(deleteSelected).toBeDisabled();

    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
    expect(deleteSelected).not.toBeDisabled();

    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();

    fireEvent.click(deleteSelected);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm devices.cache.confirmDeleteMultiple',
      })
    );
    await waitFor(() => {
      expect(DevicesService.deleteDeviceCache).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'data',
        [entries[1].url]
      );
    });
  });

  it('selects all cache URLs for bulk deletion', async () => {
    const entries = await renderCacheTable();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows' }));
    for (const entry of entries) {
      expect(
        screen.getByRole('checkbox', { name: `Select row ${entry.url}` })
      ).toBeChecked();
    }
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete selected items' })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Confirm devices.cache.confirmDeleteMultiple',
      })
    );
    await waitFor(() => {
      expect(DevicesService.deleteDeviceCache).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'data',
        entries.map((entry) => entry.url)
      );
    });
  });

  it('sorts cache entries newest first by default', () => {
    render(() => (
      <DeviceCache
        baseUrl="/api"
        device={{ id: 'device-1', online: true } as any}
        t={t}
      />
    ));

    const tableView = screen.getByTestId('table-view');
    expect(tableView).toHaveAttribute('data-initial-sort-key', 'timestamp');
    expect(tableView).toHaveAttribute(
      'data-initial-sort-direction',
      'descending'
    );
  });

  it('switches cache type with a single segmented control', () => {
    render(() => (
      <DeviceCache
        baseUrl="/api"
        device={{ id: 'device-1', online: true } as any}
        t={t}
      />
    ));

    const data = screen.getByRole('tab', { name: 'Data' });
    const media = screen.getByRole('tab', { name: 'Media' });
    expect(data).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      data.id
    );

    fireEvent.click(media);
    expect(media).toHaveAttribute('aria-selected', 'true');
    expect(data).toHaveAttribute('aria-selected', 'false');
    expect(screen.getAllByTestId('table-view')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Load page' }));
    expect(DevicesService.getDeviceCache).toHaveBeenCalledWith(
      '/api',
      'device-1',
      expect.objectContaining({ type: 'media' })
    );
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
