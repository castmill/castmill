import { Component, createSignal } from 'solid-js';
import { Device } from '../interfaces/device.interface';
import { Tabs, LoadingOverlay, useToast } from '@castmill/ui-common';
import { Channels } from './channels';
import { Maintainance } from './maintainance';
import { DeviceLogs } from './device-events';
import { DeviceDetails, DeviceUpdate } from './device-details';
import { DevicesService } from '../services/devices.service';
import { DeviceCache } from './device-cache';
import { RemoteControl } from './remote-control';

// Optionally we should allow using protonmaps
// https://protomaps.com/

// Modal component that will be used to display the device details and allow the user to edit the device
const DeviceView: Component<{
  baseUrl: string;
  device: Device;
  organization_id: string;
  onChange?: (device: Device) => void;
  store?: import('../../common/interfaces/addon-store').AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);

  const toast = useToast();
  const [loading, setLoading] = createSignal(false);
  const updateDevice = async (device: DeviceUpdate) => {
    setLoading(true);

    try {
      await Promise.all([
        await DevicesService.updateDevice(
          props.baseUrl,
          props.organization_id,
          props.device.id,
          device
        ),
        new Promise((resolve) => setTimeout(resolve, 300)),
      ]);
      toast.success('Device updated successfully');
      return true;
    } catch (err) {
      toast.error(`Error updating device: ${err}`);
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
      title: t('common.details'),
      content: () => (
        <DeviceDetails device={props.device} onSubmit={updateDevice} t={t} />
      ),
    },
    {
      title: t('common.channels'),
      content: () => (
        <div>
          <Channels
            baseUrl={props.baseUrl}
            organizationId={props.organization_id}
            device={props.device}
            t={t}
          />
        </div>
      ),
    },
    {
      title: t('devices.remoteControl.title'),
      content: () => (
        <div>
          <RemoteControl
            baseUrl={props.baseUrl}
            device={props.device}
            organizationId={props.organization_id}
            store={props.store}
            t={t}
          />
        </div>
      ),
    },
    {
      title: t('common.preview'),
      content: () => <div>{t('devices.preview.placeholder')}</div>,
    },
    {
      title: t('common.cache'),
      content: () => (
        <div>
          <DeviceCache
            baseUrl={props.baseUrl}
            device={props.device}
            t={props.t}
          />
        </div>
      ),
    },
    {
      title: t('common.maintainance'),
      content: () => (
        <div>
          <Maintainance baseUrl={props.baseUrl} device={props.device} t={t} />
        </div>
      ),
    },
    {
      title: t('common.events'),
      content: () => (
        <div>
          <DeviceLogs
            baseUrl={props.baseUrl}
            device={props.device}
            t={props.t}
          />
        </div>
      ),
    },
    {
      title: t('common.telemetry'),
      content: () => <div>{t('devices.telemetry.placeholder')}</div>,
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
