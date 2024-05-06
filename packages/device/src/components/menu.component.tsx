import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  type Component,
} from 'solid-js';
import { Device } from '../classes/device';
import { BaseMenu, type MenuEntry } from './basemenu.component';

interface MenuProps {
  device: Device;
}

const fetchDeviceInfo = (device: Device) => {
  return device.getDeviceInfo();
};

// Helper function to create a menu entry for an action
const createAction = (name: string, action: () => void): MenuEntry => {
  const id = name.toLowerCase().replace(' ', '-');
  return { name, id, type: 'action', action };
};

const shortDeviceId = (deviceId?: string) => deviceId?.split('-').shift();

export const MenuComponent: Component<MenuProps> = (props) => {
  const [deviceInfo] = createResource(props.device, fetchDeviceInfo);
  const [deviceName, setDeviceName] = createSignal<string>(
    props.device.name || 'N/A'
  );
  const [deviceId, setDeviceId] = createSignal<string>(
    props.device.id || 'N/A'
  );

  const deviceStartedHandler = ({ id, name }: { id: string; name: string }) => {
    setDeviceName(name);
    setDeviceId(id);
  };

  onMount(() => {
    props.device.once('started', deviceStartedHandler);
  });

  onCleanup(() => {
    props.device.off('started', deviceStartedHandler);
  });

  const header = (
    <>
      <h1>Castmill Player</h1>
      <p>
        Version: {deviceInfo()?.appType} {deviceInfo()?.appVersion}
      </p>
      <p>OS: {deviceInfo()?.os}</p>
    </>
  );

  const footer = (
    <>
      <p>Device ID: {shortDeviceId(deviceId()) || 'N/A'} </p>
      <p>Device Name: {deviceName()}</p>
      <p>(c) 2024 Castmill AB</p>
    </>
  );

  const capabilities = props.device.getCapabilities();

  const entries: MenuEntry[] = [
    // optional actions
    ...(capabilities.restart
      ? [createAction('Restart App', () => props.device.restart())]
      : []),
    ...(capabilities.quit
      ? [createAction('Quit App', () => props.device.quit())]
      : []),
    ...(capabilities.reboot
      ? [createAction('Reboot Device', () => props.device.reboot())]
      : []),
    ...(capabilities.shutdown
      ? [createAction('Shutdown Device', () => props.device.shutdown())]
      : []),
    ...(capabilities.update
      ? [createAction('Update App', () => props.device.update())]
      : []),
    ...(capabilities.updateFirmware
      ? [createAction('Update Firmware', () => props.device.updateFirmware())]
      : []),
  ];

  return <BaseMenu header={header} entries={entries} footer={footer} />;
};
