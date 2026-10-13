import { createSignal } from 'solid-js';
import { fireEvent, render, screen, cleanup } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DeviceDetails } from './device-details';
import type { AddonStore } from '../../common/interfaces/addon-store';

vi.mock('@castmill/ui-common', () => ({
  Button: (props: {
    label: string;
    disabled?: boolean;
    type?: 'submit';
    onClick?: () => void;
  }) => (
    <button
      type={props.type || 'button'}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  ),
  FormItem: (props: {
    id: string;
    label: string;
    value: string;
    disabled?: boolean;
    onInput: (value: string) => void;
  }) => (
    <label>
      {props.label}
      <input
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        onInput={(event) => props.onInput(event.currentTarget.value)}
      />
    </label>
  ),
}));

const fixture = {
  id: 'device-1',
  name: 'Player one',
  description: 'First player',
  orientation: 0,
  online: true,
  info: { capabilities: { orientation: true } },
} as Device;

afterEach(cleanup);

describe('Details orientation', () => {
  it('uses the existing form card styling and puts help in an accessible tooltip', () => {
    render(() => <DeviceDetails device={fixture} onSubmit={vi.fn()} />);
    const select = screen.getByLabelText('devices.orientation.label');
    expect(select.closest('.form-item1')).not.toBeNull();
    const help = screen.getByRole('button', {
      name: 'devices.orientation.help',
    });
    expect(help).toHaveAttribute('type', 'button');
    expect(
      document.getElementById(help.getAttribute('aria-describedby')!)
    ).toHaveTextContent('devices.orientation.help');
    expect(select).toHaveAttribute(
      'aria-describedby',
      help.getAttribute('aria-describedby')
    );
  });
  it('disables orientation and submission for a read-only role', () => {
    const onSubmit = vi.fn();
    const store = {
      permissions: { role: 'guest', matrix: { devices: ['show'] } },
    } as AddonStore;
    render(() => (
      <DeviceDetails
        device={fixture}
        store={store}
        t={(key) => key}
        onSubmit={onSubmit}
      />
    ));
    expect(screen.getByLabelText('devices.orientation.label')).toBeDisabled();
    fireEvent.input(screen.getByLabelText('common.name'), {
      target: { value: 'Changed player' },
    });
    expect(screen.getByText('common.save')).toBeDisabled();
    fireEvent.submit(screen.getByText('common.save').closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['0', '90', '180', '270'])(
    'offers %s degrees and saves orientation-only changes',
    async (value) => {
      const onSubmit = vi.fn().mockResolvedValue(true);
      render(() => (
        <DeviceDetails
          device={{ ...fixture, orientation: value === '0' ? 90 : 0 }}
          onSubmit={onSubmit}
        />
      ));
      fireEvent.change(screen.getByLabelText('devices.orientation.label'), {
        target: { value },
      });
      fireEvent.click(screen.getByText('common.save'));
      expect(onSubmit).toHaveBeenCalledWith({
        name: fixture.name,
        description: fixture.description,
        orientation: Number(value),
      });
    }
  );

  it('resets orientation and leaves Save disabled when unchanged', () => {
    render(() => <DeviceDetails device={fixture} onSubmit={vi.fn()} />);
    expect(screen.getByText('common.save')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('devices.orientation.label'), {
      target: { value: '270' },
    });
    expect(screen.getByText('common.save')).not.toBeDisabled();
    fireEvent.click(screen.getByText('common.reset'));
    expect(screen.getByLabelText('devices.orientation.label')).toHaveValue('0');
    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('retains edits when saving fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(() => <DeviceDetails device={fixture} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('devices.orientation.label'), {
      target: { value: '90' },
    });
    fireEvent.click(screen.getByText('common.save'));
    await Promise.resolve();
    expect(screen.getByLabelText('devices.orientation.label')).toHaveValue(
      '90'
    );
    expect(screen.getByText('common.save')).not.toBeDisabled();
  });

  it('permits offline editing but reports pending application', () => {
    render(() => (
      <DeviceDetails
        device={{ ...fixture, online: false }}
        onSubmit={vi.fn()}
      />
    ));
    expect(
      screen.getByLabelText('devices.orientation.label')
    ).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'devices.orientation.offline'
    );
  });

  it('gates old players without breaking name edits', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(() => (
      <DeviceDetails
        device={{ ...fixture, info: undefined }}
        onSubmit={onSubmit}
      />
    ));
    expect(screen.getByLabelText('devices.orientation.label')).toBeDisabled();
    fireEvent.input(screen.getByLabelText('common.name'), {
      target: { value: 'New player' },
    });
    fireEvent.click(screen.getByText('common.save'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'New player',
      description: fixture.description,
    });
  });

  it('synchronizes untouched orientation while preserving an unsaved choice', () => {
    const [device, setDevice] = createSignal(fixture);
    render(() => <DeviceDetails device={device()} onSubmit={vi.fn()} />);
    setDevice({ ...fixture, orientation: 90 });
    expect(screen.getByLabelText('devices.orientation.label')).toHaveValue(
      '90'
    );
    fireEvent.change(screen.getByLabelText('devices.orientation.label'), {
      target: { value: '270' },
    });
    setDevice({ ...fixture, orientation: 180 });
    expect(screen.getByLabelText('devices.orientation.label')).toHaveValue(
      '270'
    );
    setDevice({ ...fixture, id: 'device-2', orientation: 180 });
    expect(screen.getByLabelText('devices.orientation.label')).toHaveValue(
      '180'
    );
  });

  it.each(['applied', 'error'] as const)(
    'only accepts matching %s reports',
    (status) => {
      const [device, setDevice] = createSignal<Device>({
        ...fixture,
        orientation_status: { orientation: 90, status, mode: 'css' },
      });
      render(() => <DeviceDetails device={device()} onSubmit={vi.fn()} />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'devices.orientation.pending'
      );
      setDevice({
        ...device(),
        orientation_status: { orientation: 0, status, mode: 'css' },
      });
      if (status === 'applied') {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(
          screen.queryByText('devices.orientation.applied')
        ).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole('status')).toHaveTextContent(
          'devices.orientation.applyError'
        );
      }
    }
  );
});
