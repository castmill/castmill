import { Component, createEffect, createSignal, Show } from 'solid-js';
import { Button, MenuButton, useToast } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

import './maintainance.scss';
import { DeviceCommand } from '../types/device-command.type';

// Modal component that will be used to display the device details and allow the user to edit the device
export const Maintainance: Component<{
  baseUrl: string;
  organizationId: string;
  device: Device;
  onDeviceUpdated?: (device: Partial<Device>) => void;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();
  const foreverAutoRecoverUntil = '9999-12-31T23:59:59Z';

  const [handlingRequest, setHandlingRequest] = createSignal(false);
  const [autorecoverUntil, setAutorecoverUntil] = createSignal<string | null>(
    props.device.autorecover_until || null
  );

  createEffect(() => {
    setAutorecoverUntil(props.device.autorecover_until || null);
  });

  const getAutoRecoverDate = () => {
    if (!autorecoverUntil()) {
      return null;
    }

    const parsed = new Date(autorecoverUntil()!);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const autoRecoverIsForever = () => {
    return autorecoverUntil() === foreverAutoRecoverUntil;
  };

  const autoRecoverIsActive = () => {
    const date = getAutoRecoverDate();
    return !!date && date.getTime() > Date.now();
  };

  const autoRecoverStatusText = () => {
    if (!autoRecoverIsActive()) {
      return t('devices.maintenance.disabled');
    }

    if (autoRecoverIsForever()) {
      return t('devices.maintenance.enabledForever');
    }

    const date = getAutoRecoverDate();
    if (!date) {
      return t('devices.maintenance.disabled');
    }

    const minutesRemaining = Math.max(
      1,
      Math.ceil((date.getTime() - Date.now()) / (60 * 1000))
    );

    return t('devices.maintenance.enabledMinutesRemaining', {
      minutes: minutesRemaining,
    });
  };

  const handleRequest = async (command: DeviceCommand) => {
    setHandlingRequest(true);

    try {
      await DevicesService.sendCommand(props.baseUrl, props.device.id, command);
      toast.success(`Command "${command}" sent successfully`);
    } catch (error) {
      console.error(error);
      toast.error(`An error occurred while processing your request: ${error}`);
    } finally {
      setHandlingRequest(false);
    }
  };

  const setAutorecovery = async (until: string | null) => {
    setHandlingRequest(true);

    try {
      await DevicesService.updateDevice(
        props.baseUrl,
        props.organizationId,
        props.device.id,
        {
          autorecover_until: until,
        }
      );

      setAutorecoverUntil(until);
      props.onDeviceUpdated?.({ autorecover_until: until });
      toast.success(t('devices.maintenance.autorecoveryUpdated'));
    } catch (error) {
      console.error(error);
      toast.error(t('devices.maintenance.autorecoveryUpdateFailed'));
    } finally {
      setHandlingRequest(false);
    }
  };

  const isDisabled = () => {
    return !props.device.online || handlingRequest();
  };

  return (
    <div class="maintainance">
      <div class="maintainance-row autorecovery-row">
        <p class="autorecovery-status">
          {t('devices.maintenance.recoverLostSettingsLabel')}:{' '}
          {autoRecoverStatusText()}
        </p>

        <div class="button-wrapper">
          <MenuButton
            label={t('devices.maintenance.edit')}
            disabled={handlingRequest()}
            items={[
              {
                key: 'one-hour',
                label: t('devices.maintenance.enableForOneHour'),
                onClick: () =>
                  setAutorecovery(
                    new Date(Date.now() + 60 * 60 * 1000).toISOString()
                  ),
              },
              {
                key: 'forever',
                label: t('devices.maintenance.enableForever'),
                onClick: () => setAutorecovery(foreverAutoRecoverUntil),
              },
              {
                key: 'disable',
                label: t('devices.maintenance.disable'),
                onClick: () => setAutorecovery(null),
              },
            ]}
          />
        </div>
      </div>

      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.refresh')}
            onClick={() => handleRequest('refresh')}
          />
        </div>

        <p>{t('devices.maintenance.refreshDescription')}</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.clearCache')}
            onClick={() => handleRequest('clear_cache')}
          />
        </div>

        <p>{t('devices.maintenance.clearCacheDescription')}</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.restartApp')}
            onClick={() => handleRequest('restart_app')}
          />
        </div>

        <p>{t('devices.maintenance.restartAppDescription')}</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.restartDevice')}
            onClick={() => handleRequest('restart_device')}
          />
        </div>
        <p>{t('devices.maintenance.restartDeviceDescription')}</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.checkUpdates')}
            onClick={() => handleRequest('update_app')}
          />
        </div>
        <p>{t('devices.maintenance.checkUpdatesDescription')}</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            color="primary"
            label={t('devices.maintenance.updateFirmware')}
            onClick={() => handleRequest('update_firmware')}
          />
        </div>
        <p>{t('devices.maintenance.updateFirmwareDescription')}</p>
      </div>

      <Show when={!props.device.online}>
        <div>
          <p class="offline-message">
            {t('devices.maintenance.offlineMessage')}
          </p>
        </div>
      </Show>
    </div>
  );
};
