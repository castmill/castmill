import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DeviceLocation } from './device-location';

// The real picker loads Leaflet and OpenStreetMap: a button that picks a
// fixed place stands in for it.
vi.mock('@castmill/ui-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/ui-common')>()),
  Button: (props: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.label}
    </button>
  ),
  LocationPicker: (props: {
    value?: { lat: number; lng: number };
    disabled?: boolean;
    onChange: (value: { lat: number; lng: number }) => void;
  }) => (
    <div>
      <span data-testid="picked">
        {props.value ? `${props.value.lat},${props.value.lng}` : 'none'}
      </span>
      <button
        disabled={props.disabled}
        onClick={() => props.onChange({ lat: 59.33, lng: 18.07 })}
      >
        pick
      </button>
    </div>
  ),
}));

const t = (key: string) => key;

const device = (extra: Partial<Device> = {}): Device =>
  ({
    id: 'device-1',
    name: 'Lobby',
    description: '',
    online: true,
    last_online: new Date(),
    location: '',
    city: '',
    country: '',
    last_ip: '',
    inserted_at: new Date(),
    updated_at: new Date(),
    ...extra,
  }) as Device;

describe('DeviceLocation', () => {
  afterEach(cleanup);

  it('saves a picked location', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(() => (
      <DeviceLocation device={device()} canEdit onSubmit={onSubmit} t={t} />
    ));

    const save = screen.getByText('common.save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.queryByText('devices.location.clear')).toBeNull();

    fireEvent.click(screen.getByText('pick'));
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    expect(onSubmit).toHaveBeenCalledWith({ loc_lat: 59.33, loc_long: 18.07 });
  });

  it('shows and clears the saved location', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(() => (
      <DeviceLocation
        device={device({ loc_lat: 40.4, loc_long: -3.7 })}
        canEdit
        onSubmit={onSubmit}
        t={t}
      />
    ));

    expect(screen.getByTestId('picked').textContent).toBe('40.4,-3.7');
    fireEvent.click(screen.getByText('devices.location.clear'));

    expect(onSubmit).toHaveBeenCalledWith({ loc_lat: null, loc_long: null });
  });

  it('keeps an unsaved pick when a status update replaces the device', () => {
    const [current, setCurrent] = createSignal(
      device({ loc_lat: 40.4, loc_long: -3.7 })
    );
    render(() => (
      <DeviceLocation device={current()} canEdit onSubmit={vi.fn()} t={t} />
    ));

    fireEvent.click(screen.getByText('pick'));
    // A heartbeat: a new object with the same id and location.
    setCurrent(device({ loc_lat: 40.4, loc_long: -3.7, online: false }));
    expect(screen.getByTestId('picked').textContent).toBe('59.33,18.07');

    // A location saved elsewhere does replace the draft.
    setCurrent(device({ loc_lat: 1, loc_long: 2 }));
    expect(screen.getByTestId('picked').textContent).toBe('1,2');
  });

  it('is read-only without the update permission', () => {
    render(() => (
      <DeviceLocation
        device={device({ loc_lat: 40.4, loc_long: -3.7 })}
        canEdit={false}
        onSubmit={vi.fn()}
        t={t}
      />
    ));

    expect(screen.queryByText('common.save')).toBeNull();
    expect((screen.getByText('pick') as HTMLButtonElement).disabled).toBe(true);
  });
});
