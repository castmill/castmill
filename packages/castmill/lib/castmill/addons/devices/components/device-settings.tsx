import { Component, createSignal, onMount, Show } from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

import './device-settings.scss';

export const DeviceSettings: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [brightness, setBrightness] = createSignal<number | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [notSupported, setNotSupported] = createSignal(false);

  onMount(async () => {
    if (!props.device.online) {
      return;
    }
    setLoading(true);
    try {
      const result = await DevicesService.getDeviceBrightness(
        props.baseUrl,
        props.device.id
      );
      if (result.brightness === null || result.brightness === undefined) {
        setNotSupported(true);
      } else {
        setBrightness(result.brightness);
      }
    } catch (error) {
      setNotSupported(true);
    } finally {
      setLoading(false);
    }
  });

  const handleSave = async () => {
    const value = brightness();
    if (value === null) return;

    setSaving(true);
    try {
      await DevicesService.setDeviceBrightness(
        props.baseUrl,
        props.device.id,
        value
      );
      toast.success(t('devices.settings.brightnessSaveSuccess'));
    } catch (error) {
      toast.error(
        t('devices.settings.brightnessSaveError', { error: String(error) })
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="device-settings">
      <div class="device-settings-section">
        <h3 class="device-settings-section-title">
          {t('devices.settings.brightnessTitle')}
        </h3>

        <Show when={!props.device.online}>
          <p class="device-settings-offline-message">
            {t('devices.settings.offlineMessage')}
          </p>
        </Show>

        <Show when={props.device.online && loading()}>
          <p class="device-settings-loading">{t('common.loading')}</p>
        </Show>

        <Show when={props.device.online && !loading() && notSupported()}>
          <p class="device-settings-not-supported">
            {t('devices.settings.brightnessNotSupported')}
          </p>
        </Show>

        <Show
          when={props.device.online && !loading() && !notSupported()}
        >
          <div class="device-settings-row">
            <label class="device-settings-label">
              {t('devices.settings.brightness')}
            </label>
            <div class="device-settings-slider-container">
              <input
                type="range"
                min="0"
                max="100"
                value={brightness() ?? 50}
                class="device-settings-slider"
                onInput={(e) =>
                  setBrightness(parseInt(e.currentTarget.value, 10))
                }
              />
              <span class="device-settings-value">{brightness()}%</span>
            </div>
            <p class="device-settings-description">
              {t('devices.settings.brightnessDescription')}
            </p>
          </div>

          <div class="device-settings-actions">
            <Button
              color="primary"
              label={saving() ? t('common.saving') : t('common.save')}
              disabled={saving() || brightness() === null}
              onClick={handleSave}
            />
          </div>
        </Show>
      </div>
    </div>
  );
};
