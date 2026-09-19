import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Maintainance } from './maintainance';
import { DevicesService } from '../services/devices.service';

vi.mock('@castmill/ui-common', () => ({
  Button: (props: any) => (
    <button disabled={props.disabled} onClick={props.onClick}>
      {props.label}
    </button>
  ),
  MenuButton: (props: any) => (
    <button disabled={props.disabled} onClick={() => props.items[0]?.onClick()}>
      {props.label}
    </button>
  ),
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

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Clear cache' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Restart app' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Restart device' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Check updates' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Update firmware' })
    ).toBeDisabled();
    expect(screen.getAllByText('Not supported.')).toHaveLength(4);
  });

  it('enables each optional action the player supports', async () => {
    renderMaintenance({
      restart: true,
      reboot: true,
      update: true,
      updateFirmware: true,
    });

    const firmwareButton = screen.getByRole('button', {
      name: 'Update firmware',
    });
    expect(screen.getByRole('button', { name: 'Restart app' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Restart device' })
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Check updates' })).toBeEnabled();
    expect(firmwareButton).toBeEnabled();

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
            info: { capabilities: { updateFirmware: true } },
          } as any
        }
        t={t}
      />
    ));

    expect(
      screen.getByRole('button', { name: 'Update firmware' })
    ).toBeDisabled();
  });
});
