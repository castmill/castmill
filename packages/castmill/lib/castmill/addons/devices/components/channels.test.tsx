import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channels } from './channels';
import { Device } from '../interfaces/device.interface';

vi.mock('@castmill/ui-common', () => ({
  ComboBox: () => null,
  TableView: (props: any) => (
    <button
      aria-label={props.table.actions[0].label}
      onClick={() =>
        props.table.actions[0].handler({
          id: 42,
          name: 'Test channel',
          timezone: 'UTC',
        })
      }
    >
      {props.table.actions[0].label}
    </button>
  ),
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

describe('Device channels', () => {
  const device = {
    id: 'device-1',
    name: 'Test device',
  } as Device;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the selected channel details in a new tab', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(() => (
      <Channels
        baseUrl="/api"
        organizationId="organization-1"
        device={device}
        t={(key) => (key === 'common.openInNewTab' ? 'Open in new tab' : key)}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Open in new tab' }));

    expect(open).toHaveBeenCalledWith(
      '/org/organization-1/channels?itemId=42',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
