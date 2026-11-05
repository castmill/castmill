import { Component, createEffect, createSignal, For, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { IconTypes } from 'solid-icons';
import { useToast } from '@castmill/ui-common';
import {
  BsArrowClockwise,
  BsArrowRepeat,
  BsCloudDownload,
  BsCpu,
  BsEraser,
  BsPower,
  BsShieldCheck,
  BsTools,
} from 'solid-icons/bs';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceCardHeader, DeviceNotice } from './device-section';

import './maintainance.scss';
import { DeviceCommand } from '../types/device-command.type';

interface MaintenanceAction {
  command: DeviceCommand;
  icon: IconTypes;
  label: string;
  description: string;
}

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
      toast.success(t('devices.maintenance.commandSent'));
    } catch (error) {
      console.error(error);
      toast.error(
        t('devices.maintenance.commandFailed', { error: String(error) })
      );
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

  const isCommandSupported = (command: DeviceCommand) => {
    const capabilities = props.device.info?.capabilities;

    switch (command) {
      case 'restart_app':
        return capabilities?.restart === true;
      case 'restart_device':
        return capabilities?.reboot === true;
      case 'update_app':
        return capabilities?.update === true;
      case 'update_firmware':
        return capabilities?.updateFirmware === true;
      case 'refresh':
      case 'clear_cache':
        return true;
    }
  };

  const isCommandDisabled = (command: DeviceCommand) => {
    return isDisabled() || !isCommandSupported(command);
  };

  const autorecoveryMode = () => {
    if (!autoRecoverIsActive()) return 'disabled';
    return autoRecoverIsForever() ? 'forever' : 'timed';
  };

  const contentActions = (): MaintenanceAction[] => [
    {
      command: 'refresh',
      icon: BsArrowClockwise,
      label: t('devices.maintenance.refresh'),
      description: t('devices.maintenance.refreshDescription'),
    },
    {
      command: 'clear_cache',
      icon: BsEraser,
      label: t('devices.maintenance.clearCache'),
      description: t('devices.maintenance.clearCacheDescription'),
    },
    {
      command: 'restart_app',
      icon: BsArrowRepeat,
      label: t('devices.maintenance.restartApp'),
      description: t('devices.maintenance.restartAppDescription'),
    },
  ];

  const systemActions = (): MaintenanceAction[] => [
    {
      command: 'update_app',
      icon: BsCloudDownload,
      label: t('devices.maintenance.checkUpdates'),
      description: t('devices.maintenance.checkUpdatesDescription'),
    },
    {
      command: 'restart_device',
      icon: BsPower,
      label: t('devices.maintenance.restartDevice'),
      description: t('devices.maintenance.restartDeviceDescription'),
    },
    {
      command: 'update_firmware',
      icon: BsCpu,
      label: t('devices.maintenance.updateFirmware'),
      description: t('devices.maintenance.updateFirmwareDescription'),
    },
  ];

  const actionId = (command: DeviceCommand, part: string) =>
    `maintenance-${props.device.id}-${command}-${part}`;

  const ActionList = (listProps: { actions: MaintenanceAction[] }) => (
    <ul class="maintenance-actions">
      <For each={listProps.actions}>
        {(action) => (
          <li
            class="maintenance-action"
            classList={{ unsupported: !isCommandSupported(action.command) }}
          >
            <span class="maintenance-action-icon" aria-hidden="true">
              <Dynamic component={action.icon} />
            </span>
            <div class="maintenance-action-text">
              <span class="maintenance-action-title">
                <span id={actionId(action.command, 'title')}>
                  {action.label}
                </span>
                <Show when={!isCommandSupported(action.command)}>
                  <span class="maintenance-badge">
                    {t('devices.maintenance.actionNotSupported')}
                  </span>
                </Show>
              </span>
              <span class="maintenance-action-description">
                {action.description}
              </span>
            </div>
            <button
              type="button"
              id={actionId(action.command, 'run')}
              class="device-text-button"
              aria-labelledby={`${actionId(action.command, 'run')} ${actionId(action.command, 'title')}`}
              disabled={isCommandDisabled(action.command)}
              onClick={() => handleRequest(action.command)}
            >
              {t('devices.maintenance.run')}
            </button>
          </li>
        )}
      </For>
    </ul>
  );

  return (
    <div class="maintainance device-panel-stack">
      <Show when={!props.device.online}>
        <DeviceNotice tone="offline">
          <p>{t('devices.maintenance.offlineMessage')}</p>
        </DeviceNotice>
      </Show>

      <section class="device-card">
        <DeviceCardHeader
          icon={BsTools}
          title={t('devices.maintenance.contentGroup')}
          description={t('devices.maintenance.contentGroupDescription')}
        />
        <ActionList actions={contentActions()} />
      </section>

      <section class="device-card">
        <DeviceCardHeader
          icon={BsPower}
          title={t('devices.maintenance.systemGroup')}
          description={t('devices.maintenance.systemGroupDescription')}
        />
        <ActionList actions={systemActions()} />
      </section>

      <section class="device-card maintenance-autorecovery">
        <DeviceCardHeader
          icon={BsShieldCheck}
          title={t('devices.maintenance.recoverLostSettingsLabel')}
          description={t('devices.maintenance.recoverLostSettingsDescription')}
          actions={
            <span
              class="maintenance-status"
              classList={{ active: autoRecoverIsActive() }}
            >
              {autoRecoverStatusText()}
            </span>
          }
        />
        <div
          class="device-segmented"
          role="group"
          aria-label={t('devices.maintenance.recoverLostSettingsLabel')}
        >
          <button
            type="button"
            aria-pressed={autorecoveryMode() === 'timed'}
            disabled={handlingRequest()}
            onClick={() =>
              setAutorecovery(
                new Date(Date.now() + 60 * 60 * 1000).toISOString()
              )
            }
          >
            {t('devices.maintenance.enableForOneHour')}
          </button>
          <button
            type="button"
            aria-pressed={autorecoveryMode() === 'forever'}
            disabled={handlingRequest()}
            onClick={() => setAutorecovery(foreverAutoRecoverUntil)}
          >
            {t('devices.maintenance.enableForever')}
          </button>
          <button
            type="button"
            aria-pressed={autorecoveryMode() === 'disabled'}
            disabled={handlingRequest()}
            onClick={() => setAutorecovery(null)}
          >
            {t('devices.maintenance.disable')}
          </button>
        </div>
      </section>
    </div>
  );
};
