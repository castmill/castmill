import {
  createSignal,
  createResource,
  onMount,
  type JSX,
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

export const MenuComponent: Component<MenuProps> = ({ device }) => {
  const [deviceInfo] = createResource(device, fetchDeviceInfo);

  const header = (
    <>
      <h1>Castmill Player</h1>
      <p>
        Player: {deviceInfo()?.appType} {deviceInfo()?.appVersion}
      </p>
      <p>OS: {deviceInfo()?.os}</p>
    </>
  );

  const capabilities = device.getCapabilities();

  const entries: MenuEntry[] = [
    // optional actions
    ...(capabilities.restart
      ? [createAction('Restart App', () => device.restart())]
      : []),
    ...(capabilities.quit
      ? [createAction('Quit App', () => device.quit())]
      : []),
    ...(capabilities.reboot
      ? [createAction('Reboot Device', () => device.reboot())]
      : []),
    ...(capabilities.shutdown
      ? [createAction('Shutdown Device', () => device.shutdown())]
      : []),
    ...(capabilities.update
      ? [createAction('Update App', () => device.update())]
      : []),
    ...(capabilities.updateFirmware
      ? [createAction('Update Firmware', () => device.updateFirmware())]
      : []),
  ];

  return <BaseMenu header={header} entries={entries} />;
};
