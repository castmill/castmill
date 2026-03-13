import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  createMemo,
  Show,
  type Component,
  type JSX,
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
const createSubmenu = (
  name: string,
  entries: MenuEntry[],
  badge?: string
): MenuEntry => {
  const id = name.toLowerCase().replace(' ', '-');
  return {
    name,
    id,
    type: 'submenu',
    children: entries,
    badge,
    action: () => {},
  };
};

// Helper function to create a menu entry for an info item
const createInfo = (id: string, content: JSX.Element): MenuEntry => {
  return { id, type: 'info', content };
};

// Helper function to create a menu entry for radio buttons
const createRadioButtons = (
  options: { name: string; id: string; description?: string }[],
  groupId: string,
  selectedId: string,
  action: (state: string) => void
): MenuEntry[] => {
  return options.map((option) => {
    return {
      name: option.name,
      description: option.description,
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
  const [timerOff, setTimerOff] = createSignal(false);
  const [nextOnTime, setNextOnTime] = createSignal<string>('');
  const [nextOffTime, setNextOffTime] = createSignal<string>('');
  const [playing, setPlaying] = createSignal(false);

  const deviceStartedHandler = ({ id, name }: { id: string; name: string }) => {
    setDeviceName(name);
    setDeviceId(id);
  };

  const refreshTimerStatus = async () => {
    const isOff = await props.device.isTimerOff();
    if (isOff) {
      setTimerOff(true);
      setPlaying(false);
      const nextOn = await props.device.getNextOnTime();
      setNextOnTime(nextOn ? nextOn.toLocaleString() : '');
      setNextOffTime('');
    } else {
      setTimerOff(false);
      setPlaying(true);
      const nextOff = await props.device.getNextOffTime();
      setNextOffTime(nextOff ? nextOff.toLocaleString() : '');
      setNextOnTime('');
    }
  };

  onMount(() => {
    props.device.once('ready', deviceStartedHandler);

    // Check timer-off status for menu display
    refreshTimerStatus();
  });

  onCleanup(() => {
    props.device.off('ready', deviceStartedHandler);
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
      <p>© 2011-{new Date().getFullYear()} Castmill AB</p>
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
              availableUrls().map(({ name, url }) => ({
                name,
                id: url,
                description: url,
              })),
              'base-url-group',
              selectedUrl(),
              (state: string) => {
                props.device.setBaseUrl(state);
              }
            ),
          ]),
        ]),
        createSubmenu(
          'Status',
          [
            createInfo(
              'timer-status',
              <>
                <div style={{ display: 'flex', 'flex-direction': 'column' }}>
                  <Show
                    when={playing()}
                    fallback={
                      <>
                        <span
                          style={{ color: '#ff9900', 'font-weight': 'bold' }}
                        >
                          Playback turned off by timer
                        </span>
                        <Show when={nextOnTime()}>
                          <span
                            style={{
                              color: '#ccc',
                              'font-size': '0.9em',
                              'margin-top': '0.3em',
                            }}
                          >
                            Next on: {nextOnTime()}
                          </span>
                        </Show>
                      </>
                    }
                  >
                    <span style={{ color: '#4caf50', 'font-weight': 'bold' }}>
                      Playing
                    </span>
                    <Show when={nextOffTime()}>
                      <span
                        style={{
                          color: '#ccc',
                          'font-size': '0.9em',
                          'margin-top': '0.3em',
                        }}
                      >
                        Next off: {nextOffTime()}
                      </span>
                    </Show>
                  </Show>
                </div>
              </>
            ),
          ],
          timerOff() ? '#ff9900' : '#4caf50'
        ),
      ],
    ];
  });

  return (
    <BaseMenu
      header={header}
      entries={entries()}
      footer={footer}
      onShow={refreshTimerStatus}
    />
  );
};
