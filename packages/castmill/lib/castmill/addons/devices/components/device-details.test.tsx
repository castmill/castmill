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

const orientationGroup = () =>
  screen.getByRole('radiogroup', { name: 'devices.orientation.label' });
const orientationOption = (value: string) =>
  screen.getByRole('radio', { name: new RegExp(`^${value}°`) });
const changeButton = () =>
  screen.queryByRole('button', { name: 'devices.orientation.change' });
const openPicker = () => {
  if (!screen.queryByRole('radiogroup')) fireEvent.click(changeButton()!);
};
const chooseOrientation = (value: string) => {
  openPicker();
  fireEvent.click(orientationOption(value));
};
const selectedOrientation = () =>
  document
    .querySelector('.device-orientation-value')
    ?.getAttribute('data-value');

describe('Details orientation', () => {
  it('offers a visual picker with help in an accessible tooltip', () => {
    render(() => <DeviceDetails device={fixture} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const toggle = changeButton()!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const group = orientationGroup();
    expect(toggle).toHaveAttribute('aria-controls', group.id);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(orientationOption('90')).toHaveAccessibleName(
      /devices\.orientation\.options\.deg90/
    );
    const help = screen.getByRole('button', {
      name: 'devices.orientation.help',
    });
    expect(help).toHaveAttribute('type', 'button');
    expect(
      document.getElementById(help.getAttribute('aria-describedby')!)
    ).toHaveTextContent('devices.orientation.help');
    expect(group).toHaveAttribute(
      'aria-describedby',
      help.getAttribute('aria-describedby')
    );
  });
  it('locks fields and hides save actions for a read-only role', () => {
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
    expect(changeButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(selectedOrientation()).toBe('0');
    fireEvent.input(screen.getByLabelText('common.name'), {
      target: { value: 'Changed player' },
    });
    expect(screen.getByLabelText('common.name')).toBeDisabled();
    expect(screen.queryByText('common.save')).not.toBeInTheDocument();
    fireEvent.submit(screen.getByLabelText('common.name').closest('form')!);
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
      chooseOrientation(value);
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
    chooseOrientation('270');
    expect(screen.getByText('common.save')).not.toBeDisabled();
    fireEvent.click(screen.getByText('common.reset'));
    expect(selectedOrientation()).toBe('0');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('retains edits when saving fails', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(() => <DeviceDetails device={fixture} onSubmit={onSubmit} />);
    chooseOrientation('90');
    fireEvent.click(screen.getByText('common.save'));
    await Promise.resolve();
    expect(selectedOrientation()).toBe('90');
    expect(screen.getByText('common.save')).not.toBeDisabled();
  });

  it('permits offline editing but reports pending application', () => {
    render(() => (
      <DeviceDetails
        device={{ ...fixture, online: false }}
        onSubmit={vi.fn()}
      />
    ));
    openPicker();
    expect(orientationOption('90')).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'devices.orientation.offline'
    );
  });

  it('clears offline-change pending feedback only after a matching reconnect acknowledgement', () => {
    const [device, setDevice] = createSignal<Device>({
      ...fixture,
      online: false,
      orientation: 270,
      orientation_status: { orientation: 0, status: 'applied', mode: 'css' },
    });
    render(() => <DeviceDetails device={device()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'devices.orientation.offline'
    );

    setDevice({ ...device(), online: true });
    expect(screen.getByRole('status')).toHaveTextContent(
      'devices.orientation.pending'
    );
    setDevice({
      ...device(),
      orientation_status: { orientation: 270, status: 'applied', mode: 'css' },
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('gates old players without breaking name edits', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(() => (
      <DeviceDetails
        device={{ ...fixture, info: undefined }}
        onSubmit={onSubmit}
      />
    ));
    expect(changeButton()).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
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
    expect(selectedOrientation()).toBe('90');
    chooseOrientation('270');
    setDevice({ ...fixture, orientation: 180 });
    expect(selectedOrientation()).toBe('270');
    setDevice({ ...fixture, id: 'device-2', orientation: 180 });
    expect(selectedOrientation()).toBe('180');
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
