import { createSignal, createEffect, on, Show } from 'solid-js';
import type { Orientation } from '@castmill/device';

import { Device } from '../interfaces/device.interface';
import { Button, FormItem } from '@castmill/ui-common';
import { AddonStore } from '../../common/interfaces/addon-store';

import { BsCheckLg, BsInfoCircle, BsX } from 'solid-icons/bs';
import './device-details.scss';

const ORIENTATIONS: readonly Orientation[] = [0, 90, 180, 270];

export interface DeviceUpdate {
  name?: string;
  description?: string;
  orientation?: Orientation;
  autorecover_until?: string | null;
}

// Optionally we should allow using protonmaps
// https://protomaps.com/

export const DeviceDetails = (props: {
  device: Device;
  store?: AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
  onSubmit: (device: DeviceUpdate) => Promise<boolean>;
}) => {
  // Get i18n functions from store or use direct t function
  const t = (key: string, params?: Record<string, any>) =>
    props.t?.(key, params) || props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal(props.device.name);
  const [description, setDescription] = createSignal(props.device.description);
  const [orientation, setOrientation] = createSignal<Orientation>(
    props.device.orientation ?? 0
  );
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const [onlineStatus, setOnlineStatus] = createSignal('');
  let initializedDeviceId = props.device.id;
  const canEdit = () =>
    !props.store?.permissions ||
    props.store.permissions.matrix.devices.includes('update');
  const supportsOrientation = () =>
    props.device.info?.capabilities?.orientation === true;
  const orientationStatus = () => {
    if (!props.device.online) return t('devices.orientation.offline');
    const report = props.device.orientation_status;
    if (report?.orientation === (props.device.orientation ?? 0)) {
      return report.status === 'applied'
        ? ''
        : t('devices.orientation.applyError');
    }
    return t('devices.orientation.pending');
  };

  createEffect(
    on(
      () => props.device.id,
      (id) => {
        if (id === initializedDeviceId) return;
        initializedDeviceId = id;
        setName(props.device.name);
        setDescription(props.device.description);
        setOrientation(props.device.orientation ?? 0);
        setIsFormModified(false);
        setErrors(new Map());
      }
    )
  );

  createEffect(
    on(
      () => props.device.orientation,
      (next, previous) => {
        if (orientation() === (previous ?? 0)) setOrientation(next ?? 0);
      },
      { defer: true }
    )
  );

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = 'Name is required';
        } else if (value.length < 5) {
          error = 'Name must be at least 5 characters';
        }
        break;
      case 'description':
        if (value && value.length < 5) {
          error = 'Description must be at least 5 characters';
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    // We need to check both fields or create effect will not detect the dependencies.
    const hasModifiedName = name() !== props.device.name;
    const hasModifiedDescription = description() !== props.device.description;
    const hasModifiedOrientation =
      orientation() !== (props.device.orientation ?? 0);
    setIsFormModified(
      hasModifiedName || hasModifiedDescription || hasModifiedOrientation
    );

    setOnlineStatus(
      props.device.online
        ? 'Yes'
        : `No, last seen on ${props.device.last_online}`
    );
  });

  const isFormValid = () => {
    return (
      canEdit() && ![...errors().values()].some((e) => e) && isFormModified()
    );
  };

  return (
    <>
      <div style="font-size: 0.8em; color: darkgray;">
        <span>{t('common.addedOn')} </span>{' '}
        <span>{`${props.device.inserted_at}`}. </span>
        <span>{t('common.lastUpdatedOn')} </span>
        <span>{`${props.device.updated_at}`}</span>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isFormValid()) {
            if (
              await props.onSubmit({
                name: name(),
                description: description(),
                ...(supportsOrientation()
                  ? { orientation: orientation() }
                  : {}),
              })
            ) {
              setIsFormModified(false);
            }
          }
        }}
      >
        <div class="form-inputs">
          <FormItem
            label={t('common.name')}
            id="name"
            value={name()}
            placeholder={t('devices.enterDeviceName')}
            onInput={(value: string | number | boolean) => {
              const nextValue = String(value);
              setName(nextValue);
              validateField('name', nextValue);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>

          <div class="form-item-wrapper device-orientation">
            <div class="form-item1">
              <div class="device-orientation-label">
                <label for={`orientation-${props.device.id}`}>
                  {t('devices.orientation.label')}
                </label>
                <div class="device-orientation-help">
                  <button
                    type="button"
                    aria-label={t('devices.orientation.help')}
                    aria-describedby={`orientation-help-${props.device.id}`}
                  >
                    <BsInfoCircle />
                  </button>
                  <span
                    id={`orientation-help-${props.device.id}`}
                    role="tooltip"
                  >
                    {t('devices.orientation.help')}
                  </span>
                </div>
              </div>
              <select
                id={`orientation-${props.device.id}`}
                aria-describedby={`orientation-help-${props.device.id}`}
                value={orientation()}
                disabled={!canEdit() || !supportsOrientation()}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (ORIENTATIONS.includes(value as Orientation))
                    setOrientation(value as Orientation);
                }}
              >
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
            </div>
            <Show
              when={supportsOrientation()}
              fallback={
                <div class="description">
                  {t('devices.orientation.unsupported')}
                </div>
              }
            >
              <Show when={orientationStatus()}>
                <div class="description" role="status">
                  {orientationStatus()}
                </div>
              </Show>
            </Show>
          </div>

          <FormItem
            label={t('common.description')}
            id="description"
            value={description()}
            placeholder={t('devices.enterDescription')}
            onInput={(value: string | number | boolean) => {
              const nextValue = String(value);
              setDescription(nextValue);
              validateField('description', nextValue);
            }}
          >
            <div class="error">{errors().get('description')}</div>
          </FormItem>

          <FormItem
            label={t('common.online')}
            id="online"
            value={onlineStatus()}
            disabled={true}
            onInput={() => {}}
          ></FormItem>

          <FormItem
            label={t('common.ip')}
            id="last_ip"
            value={props.device.last_ip}
            disabled={true}
            onInput={() => {}}
          ></FormItem>

          <FormItem
            label={t('common.id')}
            id="device_id"
            value={props.device.id}
            disabled={true}
            onInput={() => {}}
          ></FormItem>
        </div>
        <div class="bottom-buttons">
          <Button
            label={t('common.save')}
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label={t('common.reset')}
            onClick={() => {
              setName(props.device.name);
              setDescription(props.device.description);
              setOrientation(props.device.orientation ?? 0);
              setErrors(new Map());
              setIsFormModified(false);
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </>
  );
};
