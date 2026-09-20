import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { DeviceLogs } from './device-events';

vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button onClick={props.onClick}>{props.label}</button>
  ),
  ConfirmDialog: () => null,
  Modal: (props: any) => (
    <section>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  ),
  TableView: (props: any) => {
    const event = {
      id: 'event-1',
      timestamp: '2026-09-20T12:00:00Z',
      last_occurred_at: '2026-09-20T12:00:00Z',
      first_occurred_at: '2026-09-20T11:00:00Z',
      type: 'e',
      type_name: 'error',
      msg: 'Media unavailable',
      occurrence_count: 4,
      category: 'media-load',
      stack: 'Error: Media unavailable',
      context: { mediaId: 12 },
    };

    return (
      <table
        data-initial-sort-key={props.initialSortOptions?.key}
        data-initial-sort-direction={props.initialSortOptions?.direction}
      >
        <tbody>
          <tr>
            {props.table.columns.map((column: any) => (
              <td>
                {column.render ? column.render(event) : event[column.key]}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );
  },
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    deleteDeviceEvents: vi.fn(),
    getDeviceEvents: vi.fn(),
  },
}));

describe('DeviceLogs', () => {
  const t = (key: string) =>
    ({
      'devices.events.lastSeen': 'Last seen',
      'devices.events.occurrences': 'Occurrences',
      'devices.events.details': 'Details',
      'devices.events.detailsTitle': 'Error details',
      'devices.events.firstSeen': 'First seen',
      'devices.events.errorDetails': 'Sanitized diagnostic details',
      'devices.events.title': 'Device Events',
      'devices.events.items': 'events',
      'devices.events.filterError': 'Errors',
      'devices.events.filterWarning': 'Warnings',
      'devices.events.filterInfo': 'Info',
      'devices.events.filterOnline': 'Online',
      'devices.events.filterOffline': 'Offline',
      'devices.events.clearAll': 'Clear all',
      'devices.events.confirmClearAll': 'Clear all',
      'devices.events.confirmClearAllMessage': 'Confirm',
      'common.type': 'Type',
      'common.message': 'Message',
    })[key] || key;

  it('shows grouped occurrence count and sanitized diagnostics on demand', () => {
    render(() => (
      <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
    ));

    expect(screen.getByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(
      screen.getByRole('heading', { name: 'Error details' })
    ).toBeInTheDocument();
    expect(screen.getByText('Error: Media unavailable')).toBeInTheDocument();
    expect(screen.getByText(/"mediaId": 12/)).toBeInTheDocument();
  });

  it('requests the newest events first', () => {
    render(() => (
      <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
    ));

    expect(screen.getByRole('table')).toHaveAttribute(
      'data-initial-sort-key',
      'timestamp'
    );
    expect(screen.getByRole('table')).toHaveAttribute(
      'data-initial-sort-direction',
      'descending'
    );
  });
});
