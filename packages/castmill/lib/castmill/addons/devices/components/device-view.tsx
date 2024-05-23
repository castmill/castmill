import { Component, createSignal } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Tabs, LoadingOverlay } from '@castmill/ui-common';
import { Maintainance } from './maintainance';
import { DeviceLogs } from './device-events';
import { DeviceDetails, DeviceUpdate } from './device-details';
import { DevicesService } from '../services/devices.service';
import { DeviceCache } from './device-cache';

// Optionally we should allow using protonmaps
// https://protomaps.com/

// Modal component that will be used to display the device details and allow the user to edit the device
const DeviceView: Component<{
  device: Device;
  organization_id: string;
  onChange?: (device: Device) => void;
}> = (props) => {
  const [loading, setLoading] = createSignal(false);

  const updateDevice = async (device: DeviceUpdate) => {
    setLoading(true);

    try {
      await Promise.all([
        await DevicesService.updateDevice(
          props.organization_id,
          props.device.id,
          device
        ),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
      return true;
    } catch (err) {
      alert('Error updating device');
      return false;
    } finally {
      setLoading(false);
      if (props.onChange) {
        props.onChange({ ...props.device, ...device });
      }
    }
  };

  const tabs = [
    {
      title: 'Details',
      content: () => (
        <DeviceDetails device={props.device} onSubmit={updateDevice} />
      ),
    },
    {
      title: 'Preview',
      content: () => <div>Preview</div>,
    },
    {
      title: 'Cache',
      content: () => (
        <div>
          <DeviceCache device={props.device} />
        </div>
      ),
    },
    {
      title: 'Maintainance',
      content: () => (
        <div>
          <Maintainance device={props.device} />
        </div>
      ),
    },
    {
      title: 'Events',
      content: () => (
        <div>
          <DeviceLogs device={props.device} />
        </div>
      ),
    },
    {
      title: 'Telemetry',
      content: () => (
        // Telemetry consists of Traces, Logs and Metrics
        <div>Traces, Logs, Metrics and Connectivity (as Wifi quality, etc)</div>
      ),
    },
  ];

  return (
    <>
      <Tabs tabs={tabs} />
      <LoadingOverlay show={loading()} />
    </>
  );
};

export default DeviceView;
