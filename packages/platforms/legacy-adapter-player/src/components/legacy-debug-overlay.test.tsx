import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from 'solid-js';
import {
  LegacyDebugOverlay,
  type LegacyDebugDevice,
} from './legacy-debug-overlay';

const createDevice = (): LegacyDebugDevice => ({
  id: 'device-42',
  name: 'Lobby Player',
  getServerConnectionStatus: () => 'connected',
  refreshIdentity: vi
    .fn()
    .mockResolvedValue({ id: 'device-42', name: 'Lobby Player' }),
  getOrganizationName: vi.fn().mockResolvedValue('Castmill AB'),
  getCastmillNetworkName: vi.fn().mockResolvedValue('Stockholm'),
  on: vi.fn(),
  off: vi.fn(),
});

const createMachine = () => ({
  getDeviceInfo: vi.fn().mockResolvedValue({
    appType: 'Legacy Android adapter',
    appVersion: '3.2.12-legacy',
    os: 'Android 5.1.1',
    hardware: 'cht_cr_rvp',
    environmentVersion: 'Crosswalk 23',
    chromiumVersion: '53.0.2785.143',
    v8Version: '5.3',
    nodeVersion: '6.0',
    userAgent: 'Legacy player user agent',
  }),
  getTimezone: vi.fn().mockResolvedValue('Europe/Stockholm'),
});

afterEach(() => {
  cleanup();
});

describe('LegacyDebugOverlay', () => {
  it('shows all configured diagnostics when visible and hides when toggled', async () => {
    const [visible, setVisible] = createSignal(false);
    const device = createDevice();
    const machine = createMachine();

    render(() => (
      <LegacyDebugOverlay
        visible={visible()}
        device={device}
        machine={machine}
        serverUrl="https://example.test"
        platform="android"
      />
    ));

    expect(
      screen.queryByLabelText('Legacy player diagnostics')
    ).not.toBeInTheDocument();

    setVisible(true);

    await waitFor(() => {
      expect(screen.getByText('Lobby Player')).toBeInTheDocument();
      expect(screen.getByText('Android 5.1.1')).toBeInTheDocument();
      expect(screen.getByText('Europe/Stockholm')).toBeInTheDocument();
    });

    expect(screen.getByText('device-42')).toBeInTheDocument();
    expect(screen.getByText('https://example.test')).toBeInTheDocument();
    expect(screen.getByText('Legacy player user agent')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.getByText('Castmill AB')).toBeInTheDocument();
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('1024 x 768')).toBeInTheDocument();

    setVisible(false);

    expect(
      screen.queryByLabelText('Legacy player diagnostics')
    ).not.toBeInTheDocument();
    expect(device.off).toHaveBeenCalledWith('ready', expect.any(Function));
  });

  it('keeps runtime diagnostics visible when machine information fails', async () => {
    const device = createDevice();
    const machine = {
      getDeviceInfo: vi
        .fn()
        .mockRejectedValue(new Error('native bridge failed')),
      getTimezone: vi.fn().mockRejectedValue(new Error('timezone failed')),
    };

    render(() => (
      <LegacyDebugOverlay
        visible
        device={device}
        machine={machine}
        serverUrl="https://example.test"
        platform="electron"
      />
    ));

    expect(screen.getByText('Lobby Player')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText('Device information: native bridge failed')
      ).toBeInTheDocument();
      expect(screen.getByText('Timezone: timezone failed')).toBeInTheDocument();
    });
  });

  it('refreshes the player name whenever the overlay opens', async () => {
    const [visible, setVisible] = createSignal(false);
    const device = createDevice();
    device.refreshIdentity = vi.fn(async () => {
      device.name = 'Renamed Player';
      return { id: 'device-42', name: device.name };
    });

    render(() => (
      <LegacyDebugOverlay
        visible={visible()}
        device={device}
        machine={createMachine()}
        serverUrl="https://example.test"
        platform="android"
      />
    ));

    setVisible(true);

    await waitFor(() => {
      expect(screen.getByText('Renamed Player')).toBeInTheDocument();
    });
    expect(device.refreshIdentity).toHaveBeenCalledTimes(1);

    setVisible(false);
    setVisible(true);

    await waitFor(() => {
      expect(device.refreshIdentity).toHaveBeenCalledTimes(2);
    });
  });

  it('renders localized strings for supported locales', async () => {
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'sv-SE',
    });

    render(() => (
      <LegacyDebugOverlay
        visible
        device={createDevice()}
        machine={createMachine()}
        serverUrl="https://example.test"
        platform="browser"
      />
    ));

    await waitFor(() => {
      expect(
        screen.getByLabelText('Diagnostik för äldre spelare')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Spelarnamn')).toBeInTheDocument();
    expect(screen.getByText('Webbläsare')).toBeInTheDocument();
  });
});
