import {
  createSignal,
  createResource,
  onMount,
  type JSX,
  type Component,
} from 'solid-js';
import { Machine } from '../interfaces/machine';
import { BaseMenu, type MenuEntry } from './basemenu.component';

// The menu entries. Make these talk to the host app. Also make sure to on
// show actions and settings that are available on the current device.
//
// There are three types of menu entries: - action: a simple action such as restart or shutdown
// - checkbox: a checkbox with a state
// - submenu: a submenu with children

interface MenuProps {
  integration: Machine;
}

const fetchDeviceInfo = (integration: Machine) => {
  return integration.getDeviceInfo();
};

export const MenuComponent: Component<MenuProps> = ({ integration }) => {
  const [deviceInfo] = createResource(integration, fetchDeviceInfo);

  const header = (
    <>
      <h1>Castmill Player</h1>
      <p>
        Player: {deviceInfo()?.appType} {deviceInfo()?.appVersion}
      </p>
      <p>OS: {deviceInfo()?.os}</p>
    </>
  );

  const entries: MenuEntry[] = [
    // optional actions
    ...((integration.restart
      ? [
          {
            name: 'Restart App',
            id: 'restart',
            type: 'action',
            action: () => {
              integration.restart?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((integration.quit
      ? [
          {
            name: 'Quit App',
            id: 'quit',
            type: 'action',
            action: () => {
              integration.quit?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((integration.reboot
      ? [
          {
            name: 'Reboot Device',
            id: 'reboot',
            type: 'action',
            action: () => {
              integration.reboot?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((integration.shutdown
      ? [
          {
            name: 'Shutdown Device',
            id: 'shutdown',
            type: 'action',
            action: () => {
              integration.shutdown?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((integration.update
      ? [
          {
            name: 'Update App',
            id: 'update',
            type: 'action',
            action: () => {
              integration.update?.();
            },
          },
        ]
      : []) as MenuEntry[]),
    ...((integration.updateFirmware
      ? [
          {
            name: 'Update Firmware',
            id: 'updateFirmware',
            type: 'action',
            action: () => {
              integration.updateFirmware?.();
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
