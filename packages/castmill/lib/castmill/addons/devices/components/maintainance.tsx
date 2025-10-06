import { Component, createSignal, Show } from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

import './maintainance.scss';
import { DeviceCommand } from '../types/device-command.type';

// Modal component that will be used to display the device details and allow the user to edit the device
export const Maintainance: Component<{
  baseUrl: string;
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [handlingRequest, setHandlingRequest] = createSignal(false);

  const handleRequest = async (command: DeviceCommand) => {
    try {
      await DevicesService.sendCommand(props.baseUrl, props.device.id, command);
      toast.success(`Command "${command}" sent successfully`);
    } catch (error) {
      console.error(error);
      toast.error(`An error occurred while processing your request: ${error}`);
    }
  };

  const isDisabled = () => {
    return !props.device.online || handlingRequest();
  };

  return (
    <div class="maintainance">
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
