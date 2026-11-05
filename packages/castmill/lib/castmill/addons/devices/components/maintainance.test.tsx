import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Maintainance } from './maintainance';
import { DevicesService } from '../services/devices.service';

vi.mock('@castmill/ui-common', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    sendCommand: vi.fn().mockResolvedValue(undefined),
    updateDevice: vi.fn().mockResolvedValue(undefined),
  },
}));

const t = (key: string) =>
  (
    ({
      'devices.maintenance.run': 'Run',
      'devices.maintenance.edit': 'Edit',
      'devices.maintenance.enableForOneHour': 'Enable for one hour',
      'devices.maintenance.enableForever': 'Enable forever',
      'devices.maintenance.disable': 'Disable',
      'devices.maintenance.disabled': 'Disabled',
      'devices.maintenance.recoverLostSettingsLabel': 'Recover lost settings',
      'devices.maintenance.refresh': 'Refresh',
      'devices.maintenance.clearCache': 'Clear cache',
      'devices.maintenance.restartApp': 'Restart app',
      'devices.maintenance.restartDevice': 'Restart device',
      'devices.maintenance.checkUpdates': 'Check updates',
      'devices.maintenance.updateFirmware': 'Update firmware',
      'devices.maintenance.actionNotSupported': 'Not supported.',
      'devices.maintenance.refreshDescription': 'Refresh description',
      'devices.maintenance.clearCacheDescription': 'Clear cache description',
      'devices.maintenance.restartAppDescription': 'Restart app description',
      'devices.maintenance.restartDeviceDescription':
        'Restart device description',
      'devices.maintenance.checkUpdatesDescription':
        'Check updates description',
      'devices.maintenance.updateFirmwareDescription':
        'Update firmware description',
    }) as Record<string, string>
  )[key] || key;

const renderMaintenance = (capabilities?: {
  restart?: boolean;
  reboot?: boolean;
  update?: boolean;
  updateFirmware?: boolean;
}) =>
  render(() => (
    <Maintainance
      baseUrl="/api"
      organizationId="organization-1"
      device={
        {
          id: 'device-1',
          online: true,
          info: capabilities ? { capabilities } : undefined,
        } as any
      }
      t={t}
    />
  ));

describe('Maintainance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables optional actions until the player reports support', () => {
    renderMaintenance();

    expect(screen.getByRole('button', { name: 'Run Refresh' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Run Clear cache' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Run Restart app' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Restart device' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Check updates' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Update firmware' })
    ).toBeDisabled();
    expect(screen.getAllByText('Not supported.')).toHaveLength(4);
  });

  it('enables and sends each optional action the player supports', async () => {
    renderMaintenance({
      restart: true,
      reboot: true,
      update: true,
      updateFirmware: true,
    });

    const firmwareButton = screen.getByRole('button', {
      name: 'Run Update firmware',
    });
    expect(
      screen.getByRole('button', { name: 'Run Restart app' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Run Restart device' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Run Check updates' })
    ).toBeEnabled();
    expect(firmwareButton).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Run Restart app' }));
    await vi.waitFor(() => {
      expect(DevicesService.sendCommand).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'restart_app'
      );
    });
    await vi.waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Run Restart device' })
      ).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Restart device' }));
    await vi.waitFor(() => {
      expect(DevicesService.sendCommand).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'restart_device'
      );
    });
    await vi.waitFor(() => {
      expect(firmwareButton).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Check updates' }));
    await vi.waitFor(() => {
      expect(DevicesService.sendCommand).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'update_app'
      );
    });
    await vi.waitFor(() => {
      expect(firmwareButton).toBeEnabled();
    });

    fireEvent.click(firmwareButton);
    await vi.waitFor(() => {
      expect(DevicesService.sendCommand).toHaveBeenCalledWith(
        '/api',
        'device-1',
        'update_firmware'
      );
    });
  });

  it('keeps supported actions disabled while the device is offline', () => {
    render(() => (
      <Maintainance
        baseUrl="/api"
        organizationId="organization-1"
        device={
          {
            id: 'device-1',
            online: false,
            info: { capabilities: { update: true, updateFirmware: true } },
          } as any
        }
        t={t}
      />
    ));

    expect(
      screen.getByRole('button', { name: 'Run Update firmware' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Check updates' })
    ).toBeDisabled();
  });

  it('marks the active autorecovery mode and updates it', async () => {
    const onDeviceUpdated = vi.fn();
    render(() => (
      <Maintainance
        baseUrl="/api"
        organizationId="organization-1"
        device={{ id: 'device-1', online: true } as any}
        onDeviceUpdated={onDeviceUpdated}
        t={t}
      />
    ));

    const disable = screen.getByRole('button', { name: 'Disable' });
    const forever = screen.getByRole('button', { name: 'Enable forever' });
    expect(disable).toHaveAttribute('aria-pressed', 'true');
    expect(forever).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(forever);
    await vi.waitFor(() =>
      expect(forever).toHaveAttribute('aria-pressed', 'true')
    );
    expect(DevicesService.updateDevice).toHaveBeenCalledWith(
      '/api',
      'organization-1',
      'device-1',
      { autorecover_until: '9999-12-31T23:59:59Z' }
    );
    expect(onDeviceUpdated).toHaveBeenCalledWith({
      autorecover_until: '9999-12-31T23:59:59Z',
    });
  });
});
