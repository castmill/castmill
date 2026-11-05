import { fireEvent, render, screen } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Channels } from './channels';
import { Device } from '../interfaces/device.interface';
import { DevicesService } from '../services/devices.service';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@castmill/ui-common', () => ({
  ComboBox: (props: any) => (
    <button
      onClick={() => props.onSelect({ id: 7, name: 'New', timezone: 'UTC' })}
    >
      {props.label}
    </button>
  ),
  useToast: () => toast,
}));

vi.mock('../services/devices.service', () => ({
  DevicesService: {
    fetchChannelByDeviceId: vi.fn(),
    addChannelToDevice: vi.fn().mockResolvedValue(undefined),
    removeChannelFromDevice: vi.fn().mockResolvedValue(undefined),
    fetchChannels: vi.fn(),
  },
}));

const device = { id: 'device-1', name: 'Test device' } as Device;
const lobby = { id: 42, name: 'Lobby', timezone: 'Europe/Stockholm' };
const menu = { id: 43, name: 'Menu', timezone: 'UTC' };

const renderChannels = (navigate = vi.fn(), completeStep = vi.fn()) =>
  render(() => (
    <Channels
      baseUrl="/api"
      organizationId="organization-1"
      device={device}
      store={{ router: { navigate }, onboarding: { completeStep } } as any}
      t={(key, params) =>
        params?.name ? `${key}:${params.name}` : (key as string)
      }
    />
  ));

describe('Device channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists assigned channels and opens the selected channel', async () => {
    vi.mocked(DevicesService.fetchChannelByDeviceId).mockResolvedValue({
      data: [lobby, menu],
    } as any);
    const navigate = vi.fn();
    renderChannels(navigate);

    expect(await screen.findByText('Lobby')).toBeInTheDocument();
    expect(screen.getByText('Europe/Stockholm')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'common.view' })[0]);
    expect(navigate).toHaveBeenCalledWith(
      '/org/organization-1/channels?itemId=42'
    );
  });

  it('prevents removing the last channel', async () => {
    vi.mocked(DevicesService.fetchChannelByDeviceId).mockResolvedValue({
      data: [lobby],
    } as any);
    renderChannels();

    const remove = await screen.findByRole('button', { name: 'common.remove' });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute('title', 'devices.cannotDeleteLastChannel');
  });

  it('removes a channel and reloads the list', async () => {
    vi.mocked(DevicesService.fetchChannelByDeviceId)
      .mockResolvedValueOnce({ data: [lobby, menu] } as any)
      .mockResolvedValueOnce({ data: [menu] } as any);
    renderChannels();

    await screen.findByText('Lobby');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'common.remove' })[0]
    );

    await vi.waitFor(() =>
      expect(screen.queryByText('Lobby')).not.toBeInTheDocument()
    );
    expect(DevicesService.removeChannelFromDevice).toHaveBeenCalledWith(
      '/api',
      'device-1',
      42
    );
    expect(toast.success).toHaveBeenCalledWith(
      'devices.channelList.removed:Lobby'
    );
  });

  it('adds a channel and completes the onboarding step', async () => {
    vi.mocked(DevicesService.fetchChannelByDeviceId).mockResolvedValue({
      data: [lobby],
    } as any);
    const completeStep = vi.fn();
    renderChannels(vi.fn(), completeStep);

    await screen.findByText('Lobby');
    fireEvent.click(screen.getByRole('button', { name: 'devices.addChannel' }));

    await vi.waitFor(() =>
      expect(completeStep).toHaveBeenCalledWith('assign_channel')
    );
    expect(DevicesService.addChannelToDevice).toHaveBeenCalledWith(
      '/api',
      'device-1',
      7
    );
  });

  it('rejects channels that are already assigned', async () => {
    vi.mocked(DevicesService.fetchChannelByDeviceId).mockResolvedValue({
      data: [{ ...lobby, id: 7 }],
    } as any);
    renderChannels();

    await screen.findByText('Lobby');
    fireEvent.click(screen.getByRole('button', { name: 'devices.addChannel' }));

    expect(toast.error).toHaveBeenCalledWith(
      'devices.channelList.alreadyAssigned'
    );
    expect(DevicesService.addChannelToDevice).not.toHaveBeenCalled();
  });
});
