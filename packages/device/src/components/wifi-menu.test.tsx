import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Device } from '../classes/device';
import type { WifiStatus } from '../interfaces/machine';
import { BaseMenu } from './basemenu.component';
import { createWifiMenu, wifiErrorMessage } from './wifi-menu';

const offline: WifiStatus = {
  available: true,
  online: false,
  networks: [
    { ssid: 'Venue', signal: 80, secure: true },
    { ssid: 'Cafe', signal: 40, secure: false },
  ],
};

function setup(status: WifiStatus | undefined, connect = vi.fn()) {
  const device = {
    getWifiStatus: vi.fn(async () => status),
    connectWifi: connect,
  } as unknown as Device;
  render(() => {
    const wifi = createWifiMenu(device);
    return (
      <BaseMenu
        header={<h1>Menu</h1>}
        footer={<p>footer</p>}
        entries={wifi.entry() ? [wifi.entry()!] : []}
      />
    );
  });
  return { device, connect };
}

// Opens the menu and expands the Wi-Fi submenu.
async function openWifi() {
  fireEvent.click(window);
  fireEvent.click(await screen.findByText(/▶ Wi-Fi/));
}

const key = (keyCode: number) =>
  fireEvent.keyDown(window, { keyCode, key: String(keyCode) });

describe('Wi-Fi menu', () => {
  afterEach(cleanup);

  it('is not shown without Wi-Fi', async () => {
    setup({ available: false, online: true, networks: [] });
    fireEvent.click(window);
    await screen.findByText('Menu');
    expect(screen.queryByText(/Wi-Fi/)).toBeNull();
  });

  it('shows the network while online and offers no changes', async () => {
    setup({
      available: true,
      online: true,
      current: { ssid: 'Venue', signal: 70, secure: true },
      networks: [],
    });
    await openWifi();
    expect(screen.getByText('Connected to Venue (70%)')).toBeTruthy();
    expect(screen.getByText(/only be changed here while it is offline/)).toBeTruthy();
    expect(screen.queryByText('Scan again')).toBeNull();
  });

  it('joins a secured network with the typed password', async () => {
    const { connect } = setup(offline, vi.fn(async () => {}));
    await openWifi();
    fireEvent.click(screen.getByText('Venue · 80%'));

    const input = (await screen.findByText('Password for Venue'))
      .nextElementSibling as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.input(input, { target: { value: 'password123' } });
    // Up/Down/Enter navigation: the password row is selected after a click.
    fireEvent.click(input.closest('li')!);
    key(13);

    expect(connect).toHaveBeenCalledWith('Venue', 'password123', false);
    expect(await screen.findByText('Connected to Venue.')).toBeTruthy();
  });

  it('joins an open network directly and reports errors', async () => {
    const { connect } = setup(
      offline,
      vi.fn(async () => {
        throw new Error(
          "Error invoking remote method 'castmill:machine': Error: couldn't join \"Cafe\" (wrong password, or out of range?)"
        );
      })
    );
    await openWifi();
    fireEvent.click(screen.getByText('Cafe · 40% · open'));
    expect(connect).toHaveBeenCalledWith('Cafe', '', false);
    expect(
      await screen.findByText(
        'couldn\'t join "Cafe" (wrong password, or out of range?)'
      )
    ).toBeTruthy();
  });

  it('joins a hidden network by name', async () => {
    const { connect } = setup(offline, vi.fn(async () => {}));
    await openWifi();
    fireEvent.click(screen.getByText('Other network…'));
    const name = (await screen.findByText('Network name'))
      .nextElementSibling as HTMLInputElement;
    fireEvent.input(name, { target: { value: 'Backstage' } });
    fireEvent.click(name.closest('li')!);
    key(13);

    const psk = (await screen.findByText(/Password for Backstage/))
      .nextElementSibling as HTMLInputElement;
    fireEvent.input(psk, { target: { value: 'password123' } });
    fireEvent.click(psk.closest('li')!);
    key(13);
    expect(connect).toHaveBeenCalledWith('Backstage', 'password123', true);
  });

  it('forgets typed passwords when the menu hides', async () => {
    setup(offline);
    await openWifi();
    fireEvent.click(screen.getByText('Venue · 80%'));
    const input = (await screen.findByText('Password for Venue'))
      .nextElementSibling as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'secret-pass' } });

    key(27); // Escape hides the menu
    fireEvent.click(window);
    const again = (await screen.findByText('Password for Venue'))
      .nextElementSibling as HTMLInputElement;
    expect(again.value).toBe('');
  });
});

describe('wifiErrorMessage', () => {
  it('drops the IPC wrapping', () => {
    expect(
      wifiErrorMessage(
        new Error(
          "Error invoking remote method 'castmill:machine': Error: the device is online"
        )
      )
    ).toBe('the device is online');
    expect(wifiErrorMessage(undefined)).toBe('Could not join the network.');
  });
});
