import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  createMemo,
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

const fetchAvailableUrls = async (device: Device) => {
  const urls = await device.getAvailableBaseUrls();
  return urls;
};

const fetchSelectedUrl = async (device: Device) => {
  const baseUrl = await device.getBaseUrl();
  // Fallback to origin if no baseUrl is set
  return baseUrl;
};

// Helper function to create a menu entry for an action
const createAction = (name: string, action: () => void): MenuEntry => {
  const id = name.toLowerCase().replace(' ', '-');
  return { name, id, type: 'action', action };
};

// Helper function to create a menu entry for a submenu
const createSubmenu = (name: string, entries: MenuEntry[]): MenuEntry => {
  const id = name.toLowerCase().replace(' ', '-');
  return { name, id, type: 'submenu', children: entries, action: () => {} };
};

// Helper function to create a menu entry for radio buttons
const createRadioButtons = (
  options: { name: string; id: string }[],
  groupId: string,
  selectedId: string,
  action: (state: string) => void
): MenuEntry[] => {
  return options.map((option) => {
    return {
      name: option.name,
      groupId,
      id: option.id,
      type: 'radiobutton',
      state: option.id === selectedId,
      action: (selectedId: string) => action(selectedId),
    };
  });
};

const shortDeviceId = (deviceId?: string) => deviceId?.split('-').shift();

export const MenuComponent: Component<MenuProps> = (props) => {
  const [deviceInfo] = createResource(() => props.device, fetchDeviceInfo);

  const [availableUrls] = createResource(
    () => props.device,
    fetchAvailableUrls,
    {
      initialValue: [],
    }
  );

  const [selectedUrl] = createResource(() => props.device, fetchSelectedUrl, {
    initialValue: '',
  });

  const [deviceName, setDeviceName] = createSignal<string>(
    props.device?.name || 'N/A'
  );
  const [deviceId, setDeviceId] = createSignal<string>(
    props.device?.id || 'N/A'
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
      <p>© 2024 Castmill AB</p>
    </>
  );

  const capabilities = props.device.getCapabilities();

  // Memoized entries that reactively update when availableUrls or selectedUrl change
  const entries = createMemo((): MenuEntry[] => {
    return [
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
      ...[
        createSubmenu('Settings', [
          createSubmenu('Server', [
            ...createRadioButtons(
              availableUrls().map(({ name, url }) => ({ name, id: url })),
              'base-url-group',
              selectedUrl(),
              (state: string) => {
                props.device.setBaseUrl(state);
              }
            ),
          ]),
        ]),
      ],
    ];
  });

  return <BaseMenu header={header} entries={entries()} footer={footer} />;
};
