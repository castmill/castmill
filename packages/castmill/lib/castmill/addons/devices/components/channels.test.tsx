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

  it('navigates to the selected channel details in the current view', () => {
    const navigate = vi.fn();

    render(() => (
      <Channels
        baseUrl="/api"
        organizationId="organization-1"
        device={device}
        store={
          {
            router: {
              navigate,
              location: () => ({
                pathname: '/',
                search: '',
                hash: '',
              }),
            },
          } as any
        }
        t={(key) => (key === 'common.view' ? 'View' : key)}
      />
    ));

    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    expect(navigate).toHaveBeenCalledWith(
      '/org/organization-1/channels?itemId=42'
    );
  });
});
