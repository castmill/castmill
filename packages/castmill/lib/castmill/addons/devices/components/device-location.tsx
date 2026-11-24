import { Component, Show, createEffect, createSignal, on } from 'solid-js';
import {
  Button,
  LocationPicker,
  LocationValue,
  SectionCard,
} from '@castmill/ui-common';

import { Device } from '../interfaces/device.interface';
import { DeviceUpdate } from './device-details';

type T = (key: string, params?: Record<string, any>) => string;

const savedLocation = (device: Device): LocationValue | undefined =>
  typeof device.loc_lat === 'number' && typeof device.loc_long === 'number'
    ? { lat: device.loc_lat, lng: device.loc_long }
    : undefined;

/**
 * Where the device is: devices that can't locate themselves (Castmill OS,
 * most signage players) get their location here.
 */
export const DeviceLocation: Component<{
  device: Device;
  canEdit: boolean;
  onSubmit: (update: DeviceUpdate) => Promise<boolean>;
  t: T;
}> = (props) => {
  const [location, setLocation] = createSignal(savedLocation(props.device));
  const [saving, setSaving] = createSignal(false);

  // Another device, or the saved location changed elsewhere.
  createEffect(
    on(
      () => [props.device.id, props.device.loc_lat, props.device.loc_long],
      () => setLocation(savedLocation(props.device))
    )
  );

  const saved = () => savedLocation(props.device);
  const dirty = () => {
    const a = location();
    const b = saved();
    return a?.lat !== b?.lat || a?.lng !== b?.lng;
  };

  const submit = async (next: LocationValue | undefined) => {
    setSaving(true);
    try {
      return await props.onSubmit({
        loc_lat: next?.lat ?? null,
        loc_long: next?.lng ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="device-location">
      <SectionCard title={props.t('devices.location.title')}>
        <p class="device-location-help">{props.t('devices.location.help')}</p>
        <LocationPicker
          value={location()}
          onChange={setLocation}
          disabled={!props.canEdit || saving()}
          placeholder={props.t('common.searchLocation')}
          searchLabel={props.t('devices.location.search')}
          coordinatesLabel={props.t('common.coordinates')}
          addressLabel={props.t('common.address')}
          noAddressText={props.t('common.noAddressAvailable')}
          editLabel={props.t('common.edit')}
          saveLabel={props.t('common.save')}
          cancelLabel={props.t('common.cancel')}
          closeLabel={props.t('common.close')}
        />
        <Show when={props.canEdit}>
          <div class="device-location-actions">
            <Show when={saved()}>
              <Button
                label={props.t('devices.location.clear')}
                color="secondary"
                disabled={saving()}
                onClick={async () => {
                  if (await submit(undefined)) setLocation(undefined);
                }}
              />
            </Show>
            <Button
              label={props.t('common.save')}
              color="primary"
              disabled={saving() || !dirty() || !location()}
              onClick={() => submit(location())}
            />
          </div>
        </Show>
      </SectionCard>
    </div>
  );
};
