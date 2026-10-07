import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VideoPlaybackControllerFactory } from '@castmill/player';
import type { StorageIntegration } from '@castmill/cache';
import type { Machine } from '../interfaces/machine';
import { Device } from './device';
import { DeviceErrorReporter } from './error-reporter';

describe('Device player globals', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const create = (factory?: VideoPlaybackControllerFactory) =>
    new Device({} as Machine, {} as StorageIntegration, {
      createVideoPlaybackController: factory,
    });

  it('passes the platform video playback controller to the content', () => {
    const factory: VideoPlaybackControllerFactory = vi.fn();
    const globals = create(factory).getPlayerGlobals();

    expect(globals.target).toBe('poster');
    expect(globals.createVideoPlaybackController).toBe(factory);
  });

  it('leaves default video playback to the player without a controller', () => {
    expect(create().getPlayerGlobals().createVideoPlaybackController).toBe(
      undefined
    );
  });

  it('forwards playback errors to the device error reporter', () => {
    const report = vi
      .spyOn(DeviceErrorReporter.prototype, 'report')
      .mockImplementation(() => {});
    const error = new Error('Video playback blocked');

    create().getPlayerGlobals().reportError!({
      category: 'playback',
      code: 'video-decoder-limit',
      error,
    });

    expect(report).toHaveBeenCalledWith({
      category: 'playback',
      code: 'video-decoder-limit',
      error,
    });
  });
});
