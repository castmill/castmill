import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { DeviceComponent } from '../src/components/device.component';
import { Status } from '../src/classes/device';
import { PlayerComponent } from '../src/components/player.component';

describe('PlayerComponent', () => {
  it('synchronizes the server schedule before checking standby state', async () => {
    const calls: string[] = [];
    const device = {
      syncSchedule: vi.fn(async () => {
        calls.push('sync');
      }),
      isTimerOff: vi.fn(async () => {
        calls.push('check');
        return false;
      }),
      start: vi.fn(async () => {
        calls.push('start');
      }),
    };

    render(() => <PlayerComponent device={device as any} />);

    await vi.waitFor(() => expect(device.start).toHaveBeenCalledOnce());
    expect(calls).toEqual(['sync', 'check', 'start']);
  });

  it('keeps the progress overlay visible until the player emits ready', async () => {
    let resolveStart!: () => void;
    const device = Object.assign(new EventEmitter(), {
      loginOrRegister: vi.fn().mockResolvedValue({ status: Status.Ready }),
      syncSchedule: vi.fn().mockResolvedValue(false),
      isTimerOff: vi.fn().mockResolvedValue(false),
      start: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveStart = resolve;
          })
      ),
    });

    render(() => <DeviceComponent device={device as any} />);

    await vi.waitFor(() => expect(device.start).toHaveBeenCalledOnce());
    expect(screen.getByText('Initializing…')).toBeInTheDocument();
    device.emit('ready', { id: 'device-1', name: 'Player' });
    await vi.waitFor(() =>
      expect(screen.queryByText('Initializing…')).not.toBeInTheDocument()
    );
    resolveStart();
  });

  it('displays login errors on the dark background', async () => {
    const device = Object.assign(new EventEmitter(), {
      loginOrRegister: vi.fn().mockRejectedValue(new Error('Login failed')),
      reportStartupError: vi.fn(),
    });

    render(() => <DeviceComponent device={device as any} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Login failed');
    expect(device.reportStartupError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Login failed' })
    );
    expect(alert).toHaveStyle({
      backgroundColor: 'rgb(0, 0, 0)',
      color: 'rgb(255, 255, 255)',
    });
  });

  it.each(['syncSchedule', 'isTimerOff', 'start'] as const)(
    'reports a %s failure and replaces the authentication overlay',
    async (failingStep) => {
      const failure = new Error(`Failed during ${failingStep}`);
      const device = Object.assign(new EventEmitter(), {
        loginOrRegister: vi.fn().mockResolvedValue({ status: Status.Ready }),
        syncSchedule:
          failingStep === 'syncSchedule'
            ? vi.fn().mockRejectedValue(failure)
            : vi.fn().mockResolvedValue(false),
        isTimerOff:
          failingStep === 'isTimerOff'
            ? vi.fn().mockRejectedValue(failure)
            : vi.fn().mockResolvedValue(false),
        start:
          failingStep === 'start'
            ? vi.fn().mockRejectedValue(failure)
            : vi.fn().mockResolvedValue(undefined),
        reportStartupError: vi.fn((error: Error) => {
          device.emit('startup-error', error);
        }),
      });

      render(() => <DeviceComponent device={device as any} />);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(failure.message);
      expect(alert).toHaveStyle({
        backgroundColor: 'rgb(0, 0, 0)',
        color: 'rgb(255, 255, 255)',
      });
      expect(device.reportStartupError).toHaveBeenCalledWith(failure);
      expect(screen.queryByText('Authenticating')).not.toBeInTheDocument();
      if (failingStep !== 'start') {
        expect(device.start).not.toHaveBeenCalled();
      }
    }
  );
});
