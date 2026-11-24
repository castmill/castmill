import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';
import { DeviceOsUpdate } from './device-os-update';

vi.mock('@castmill/ui-common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@castmill/ui-common')>()),
  Button: (props: {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.label}
    </button>
  ),
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    getOsUpdates: vi.fn(),
    setOsUpdatePolicy: vi.fn(),
    setDeviceOsUpdate: vi.fn(),
  },
}));

const t = (key: string, params?: Record<string, any>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

const release = (version: string, prerelease = false) => ({
  version,
  prerelease,
  security: false,
  published_at: '2026-12-01T10:00:00Z',
  notes_url: `https://github.com/castmill/castmill-os/releases/tag/v${version}`,
  artifacts: {
    'castmill-os-genericx86-64': {
      url: 'https://x/b.raucb',
      sha256: 'a',
      size: 1,
    },
  },
});

const device = (extra: Partial<Device> = {}): Device => ({
  id: 'device-1',
  name: 'Lobby',
  description: '',
  online: true,
  last_online: new Date(),
  location: '',
  city: '',
  country: '',
  last_ip: '',
  inserted_at: new Date(),
  updated_at: new Date(),
  log_level: 'info',
  os_status: {
    compatible: 'castmill-os-genericx86-64',
    current_version: '0.2.0',
    target_version: '0.3.0',
    state: 'installing',
    version: '0.3.0',
    progress: 40,
  },
  ...extra,
});

describe('DeviceOsUpdate', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the device status and the releases for its hardware', async () => {
    vi.mocked(DevicesService.getOsUpdates).mockResolvedValue({
      policy: { mode: 'latest', prereleases: false },
      releases: [release('0.3.0'), release('0.4.0-rc.1', true)],
    });
    render(() => (
      <DeviceOsUpdate
        baseUrl=""
        organizationId="org-1"
        device={device()}
        t={t}
      />
    ));

    expect(screen.getByText('0.2.0')).toBeInTheDocument();
    expect(
      screen.getByText(
        'devices.osUpdate.state.installing {"version":"0.3.0"} (40 %)'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('castmill-os-genericx86-64')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '0.3.0' })).toBeInTheDocument()
    );
  });

  it('flags a rollback and its error', async () => {
    vi.mocked(DevicesService.getOsUpdates).mockResolvedValue({
      policy: { mode: 'manual', prereleases: false },
      releases: [],
    });
    render(() => (
      <DeviceOsUpdate
        baseUrl=""
        organizationId="org-1"
        device={device({
          os_status: {
            compatible: 'castmill-os-genericx86-64',
            state: 'rolled_back',
            version: '0.3.0',
            last_error: 'health check failed: frames',
          },
        })}
        t={t}
      />
    ));

    expect(
      document.querySelector('[data-field="os-update-state"]')
    ).toHaveClass('warning');
    expect(screen.getByText('health check failed: frames')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('devices.osUpdate.noReleases')
      ).toBeInTheDocument()
    );
  });

  it('pins the device to a version and updates it now', async () => {
    vi.mocked(DevicesService.getOsUpdates).mockResolvedValue({
      policy: { mode: 'manual', prereleases: false },
      releases: [release('0.3.0')],
    });
    vi.mocked(DevicesService.setDeviceOsUpdate).mockResolvedValue({
      os_update: { mode: 'version', version: '0.3.0', now: false },
    });
    render(() => (
      <DeviceOsUpdate
        baseUrl="https://castmill.test"
        organizationId="org-1"
        device={device({
          os_update: { mode: 'version', version: '0.3.0', now: false },
        })}
        t={t}
      />
    ));

    fireEvent.click(
      screen.getByRole('button', { name: 'devices.osUpdate.updateNow' })
    );
    await waitFor(() =>
      expect(DevicesService.setDeviceOsUpdate).toHaveBeenCalledWith(
        'https://castmill.test',
        'device-1',
        { mode: 'version', version: '0.3.0', now: true }
      )
    );
  });
});
