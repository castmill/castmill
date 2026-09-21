import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { DeviceLogs } from './device-events';

const tableEvent: {
  id: string;
  timestamp: string;
  last_occurred_at: string;
  first_occurred_at: string;
  type: string;
  type_name: string;
  msg: string;
  occurrence_count: number;
  category: string;
  stack?: string;
  context?: Record<string, number>;
} = {
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
    return (
      <table
        data-initial-sort-key={props.initialSortOptions?.key}
        data-initial-sort-direction={props.initialSortOptions?.direction}
      >
        <thead>
          <tr>
            {props.table.columns.map((column: any) => (
              <th>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {props.table.columns.map((column: any) => (
              <td>
                {column.render
                  ? column.render(tableEvent)
                  : tableEvent[column.key]}
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
      'devices.events.filterOnline': 'Online',
      'devices.events.filterOffline': 'Offline',
      'devices.events.clearAll': 'Clear all',
      'devices.events.confirmClearAll': 'Clear all',
      'devices.events.confirmClearAllMessage': 'Confirm',
      'common.type': 'Type',
      'common.message': 'Message',
      'common.timestamp': 'Timestamp',
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
    expect(screen.getAllByText('Media unavailable')).toHaveLength(2);
  });

  it('uses a timestamp heading, hides warning/info filters, and truncates messages visually', () => {
    render(() => (
      <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
    ));

    expect(
      screen.getByRole('columnheader', { name: 'Timestamp' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Warnings')).not.toBeInTheDocument();
    expect(screen.queryByText('Info')).not.toBeInTheDocument();
    expect(screen.getByText('Media unavailable')).toHaveStyle({
      'text-align': 'left',
      'text-overflow': 'ellipsis',
      'white-space': 'nowrap',
    });
  });

  it('renders diagnostic markup as inert text in the details modal', () => {
    const originalMessage = tableEvent.msg;
    tableEvent.msg = '<img src=x onerror=alert(1)>';

    try {
      render(() => (
        <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
      ));
      fireEvent.click(screen.getByRole('button', { name: 'Details' }));

      expect(screen.getAllByText(tableEvent.msg)).toHaveLength(2);
      expect(document.querySelector('img[src="x"]')).toBeNull();
    } finally {
      tableEvent.msg = originalMessage;
    }
  });

  it('hides the details action for lifecycle-only events', () => {
    const originalType = tableEvent.type;
    const originalStack = tableEvent.stack;
    const originalContext = tableEvent.context;
    tableEvent.type = 'o';
    tableEvent.stack = undefined;
    tableEvent.context = undefined;

    try {
      render(() => (
        <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
      ));

      expect(
        screen.queryByRole('button', { name: 'Details' })
      ).not.toBeInTheDocument();
    } finally {
      tableEvent.type = originalType;
      tableEvent.stack = originalStack;
      tableEvent.context = originalContext;
    }
  });

  it('shows the details action for errors without stack or context', () => {
    const originalStack = tableEvent.stack;
    const originalContext = tableEvent.context;
    tableEvent.stack = undefined;
    tableEvent.context = undefined;

    try {
      render(() => (
        <DeviceLogs baseUrl="/api" device={{ id: 'device-1' } as any} t={t} />
      ));

      expect(
        screen.getByRole('button', { name: 'Details' })
      ).toBeInTheDocument();
    } finally {
      tableEvent.stack = originalStack;
      tableEvent.context = originalContext;
    }
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
