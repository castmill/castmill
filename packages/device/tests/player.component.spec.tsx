import { render } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';
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
});
