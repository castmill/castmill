import { createSignal, createEffect, on, For, Show } from 'solid-js';
import type { Orientation } from '@castmill/device';

import { Device } from '../interfaces/device.interface';
import { Button, FormItem } from '@castmill/ui-common';
import { AddonStore } from '../../common/interfaces/addon-store';

import { BsArrowUp, BsCheckLg, BsInfoCircle, BsX } from 'solid-icons/bs';
import './device-details.scss';

const ORIENTATIONS: readonly Orientation[] = [0, 90, 180, 270];
const isPortrait = (angle: Orientation) => angle === 90 || angle === 270;

export interface DeviceUpdate {
  name?: string;
  description?: string;
  orientation?: Orientation;
  autorecover_until?: string | null;
}

export const DeviceDetails = (props: {
  device: Device;
  store?: AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
  onSubmit: (device: DeviceUpdate) => Promise<boolean>;
}) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.t?.(key, params) || props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal(props.device.name);
  const [description, setDescription] = createSignal(props.device.description);
  const [orientation, setOrientation] = createSignal<Orientation>(
    props.device.orientation ?? 0
  );
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map<string, string>());

  let initializedDeviceId = props.device.id;
  const canEdit = () =>
    !props.store?.permissions ||
    props.store.permissions.matrix.devices.includes('update');
  const supportsOrientation = () =>
    props.device.info?.capabilities?.orientation === true;
  const orientationLocked = () => !canEdit() || !supportsOrientation();
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

  const resetForm = () => {
    setName(props.device.name);
    setDescription(props.device.description);
    setOrientation(props.device.orientation ?? 0);
    setIsFormModified(false);
    setPickerOpen(false);
    setErrors(new Map());
  };

  createEffect(
    on(
      () => props.device.id,
      (id) => {
        if (id === initializedDeviceId) return;
        initializedDeviceId = id;
        resetForm();
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
          error = t('devices.details.nameRequired');
        } else if (value.length < 5) {
          error = t('devices.details.nameTooShort');
        }
        break;
      case 'description':
        if (value && value.length < 5) {
          error = t('devices.details.descriptionTooShort');
        }
        break;
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    setIsFormModified(
      name() !== props.device.name ||
        description() !== props.device.description ||
        orientation() !== (props.device.orientation ?? 0)
    );
  });

  const isFormValid = () =>
    canEdit() && ![...errors().values()].some((e) => e) && isFormModified();

  const helpId = () => `orientation-help-${props.device.id}`;
  const legendId = () => `orientation-label-${props.device.id}`;
  const pickerId = () => `orientation-picker-${props.device.id}`;

  return (
    <form
      class="device-settings device-card"
      classList={{ 'is-dirty': isFormModified() }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!isFormValid()) return;
        const saved = await props.onSubmit({
          name: name(),
          description: description(),
          ...(supportsOrientation() ? { orientation: orientation() } : {}),
        });
        if (saved) {
          setIsFormModified(false);
          setPickerOpen(false);
        }
      }}
    >
      <header class="device-card-header">
        <h3>{t('devices.details.settings')}</h3>
      </header>

      <div class="device-settings-fields">
        <FormItem
          label={t('common.name')}
          id="name"
          value={name()}
          placeholder={t('devices.enterDeviceName')}
          disabled={!canEdit()}
          onInput={(value: string | number | boolean) => {
            const nextValue = String(value);
            setName(nextValue);
            validateField('name', nextValue);
          }}
        >
          <div class="error">{errors().get('name')}</div>
        </FormItem>

        <FormItem
          label={t('common.description')}
          id="description"
          value={description()}
          placeholder={t('devices.enterDescription')}
          disabled={!canEdit()}
          onInput={(value: string | number | boolean) => {
            const nextValue = String(value);
            setDescription(nextValue);
            validateField('description', nextValue);
          }}
        >
          <div class="error">{errors().get('description')}</div>
        </FormItem>
      </div>

      <div class="device-orientation" classList={{ expanded: pickerOpen() }}>
        <div class="device-orientation-row">
          <span
            class="orientation-screen"
            classList={{ portrait: isPortrait(orientation()) }}
            aria-hidden="true"
          >
            <BsArrowUp style={{ transform: `rotate(${orientation()}deg)` }} />
          </span>
          <div class="device-orientation-summary">
            <div class="device-orientation-label">
              <span id={legendId()}>{t('devices.orientation.label')}</span>
              <div class="device-orientation-help">
                <button
                  type="button"
                  aria-label={t('devices.orientation.help')}
                  aria-describedby={helpId()}
                >
                  <BsInfoCircle />
                </button>
                <span id={helpId()} role="tooltip">
                  {t('devices.orientation.help')}
                </span>
              </div>
            </div>
            <span class="device-orientation-value" data-value={orientation()}>
              {orientation()}° ·{' '}
              {t(`devices.orientation.options.deg${orientation()}`)}
            </span>
          </div>
          <Show when={!orientationLocked()}>
            <button
              type="button"
              class="device-orientation-toggle"
              aria-expanded={pickerOpen()}
              aria-controls={pickerId()}
              onClick={() => setPickerOpen(!pickerOpen())}
            >
              {pickerOpen()
                ? t('devices.orientation.done')
                : t('devices.orientation.change')}
            </button>
          </Show>
        </div>

        <Show when={pickerOpen() && !orientationLocked()}>
          <fieldset
            id={pickerId()}
            class="orientation-options"
            role="radiogroup"
            aria-labelledby={legendId()}
            aria-describedby={helpId()}
          >
            <For each={ORIENTATIONS}>
              {(angle) => (
                <label
                  class="orientation-option"
                  classList={{ selected: orientation() === angle }}
                  title={t(`devices.orientation.options.deg${angle}`)}
                >
                  <input
                    type="radio"
                    name={`orientation-${props.device.id}`}
                    value={angle}
                    checked={orientation() === angle}
                    onChange={() => setOrientation(angle)}
                  />
                  <span
                    class="orientation-screen mini"
                    classList={{ portrait: isPortrait(angle) }}
                    aria-hidden="true"
                  >
                    <BsArrowUp style={{ transform: `rotate(${angle}deg)` }} />
                  </span>
                  <span class="orientation-angle">{angle}°</span>
                  <span class="visually-hidden">
                    {t(`devices.orientation.options.deg${angle}`)}
                  </span>
                </label>
              )}
            </For>
          </fieldset>
        </Show>

        <Show
          when={supportsOrientation()}
          fallback={
            <p class="device-settings-note">
              {t('devices.orientation.unsupported')}
            </p>
          }
        >
          <Show when={orientationStatus()}>
            <p class="device-settings-note" role="status">
              {orientationStatus()}
            </p>
          </Show>
        </Show>
      </div>

      <Show when={canEdit()}>
        <footer class="device-settings-actions">
          <span class="device-settings-dirty" aria-live="polite">
            {isFormModified() ? t('devices.details.unsavedChanges') : ''}
          </span>
          <Button
            label={t('common.reset')}
            onClick={resetForm}
            icon={BsX}
            color="secondary"
            disabled={!isFormModified()}
          />
          <Button
            label={t('common.save')}
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
        </footer>
      </Show>
    </form>
  );
};
