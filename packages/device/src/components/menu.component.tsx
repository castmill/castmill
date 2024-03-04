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
    ...((capabilities.restart
      ? [
          {
            name: 'Restart App',
            id: 'restart',
            type: 'action',
            action: () => {
              device.restart?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((capabilities.quit
      ? [
          {
            name: 'Quit App',
            id: 'quit',
            type: 'action',
            action: () => {
              device.quit?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((capabilities.reboot
      ? [
          {
            name: 'Reboot Device',
            id: 'reboot',
            type: 'action',
            action: () => {
              device.reboot?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((capabilities.shutdown
      ? [
          {
            name: 'Shutdown Device',
            id: 'shutdown',
            type: 'action',
            action: () => {
              device.shutdown?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((capabilities.update
      ? [
          {
            name: 'Update App',
            id: 'update',
            type: 'action',
            action: () => {
              device.update?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((capabilities.updateFirmware
      ? [
          {
            name: 'Update Firmware',
            id: 'updateFirmware',
            type: 'action',
            action: () => {
              device.updateFirmware?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    // {
    //   name: 'Debug mode',
    //   id: 'debug1',
    //   type: 'checkbox',
    //   state: false,
    //   action: (state: boolean) => console.log('debug mode', state),
    // },
    // {
    //   name: 'Advanced options',
    //   id: 'advanced',
    //   type: 'submenu',
    //   action: (state: boolean) => console.log('Advanced options', state),
    //   children: [
    //     {
    //       name: 'Debug mode3',
    //       id: 'debug3',
    //       type: 'checkbox',
    //       state: true,
    //       action: (state: boolean) => console.log('debug mode3', state),
    //     },
    //     {
    //       name: 'Launch interstellar rocket',
    //       id: 'action5',
    //       type: 'action',
    //       action: () => console.log('launch interstellar rocket'),
    //     },
  ];

  return <BaseMenu header={header} entries={entries} />;
};
