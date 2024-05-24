import { Component, createSignal, Show } from 'solid-js';
import { Button } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

import './maintainance.scss';
import { DeviceCommand } from '../types/device-command.type';

// Modal component that will be used to display the device details and allow the user to edit the device
export const Maintainance: Component<{ device: Device }> = (props) => {
  const [handlingRequest, setHandlingRequest] = createSignal(false);

  const handleRequest = async (command: DeviceCommand) => {
    try {
      await DevicesService.sendCommand(props.device.id, command);
    } catch (error) {
      console.error(error);
      alert('An error occurred while processing your request');
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
            variant="primary"
            label="Refresh"
            onClick={() => handleRequest('refresh')}
          />
        </div>

        <p>
          Refreshes the device. Useful if the device is still running but
          exhibiting anomalous behaviour
        </p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            variant="primary"
            label="Clear Cache"
            onClick={() => handleRequest('clear_cache')}
          />
        </div>

        <p>Clear the cache to force download of all fresh content</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            variant="primary"
            label="Restart App"
            onClick={() => handleRequest('restart_app')}
          />
        </div>

        <p>Restarts the application</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            variant="primary"
            label="Restart Device"
            onClick={() => handleRequest('restart_device')}
          />
        </div>
        <p>Performs a complete hardware shutdown and start of the device</p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            variant="primary"
            label="Check for updates"
            onClick={() => handleRequest('update_app')}
          />
        </div>
        <p>
          Check for updates and install them. This will not restart the device
        </p>
      </div>
      <div class="maintainance-row">
        <div class="button-wrapper">
          <Button
            disabled={isDisabled()}
            variant="primary"
            label="Update Firmware"
            onClick={() => handleRequest('update_firmware')}
          />
        </div>
        <p>Updates the firmware of the device.</p>
      </div>
      <Show when={!props.device.online}>
        <div>
          <p class="offline-message">
            Device is offline, so no commands can be sent to it.
          </p>
        </div>
      </Show>
    </div>
  );
};
