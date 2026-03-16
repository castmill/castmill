import { describe, expect, it, vi } from 'vitest';
import { getLinuxBrightness, setLinuxBrightness } from './linux';

describe('linux brightness', () => {
  it('parses xrandr brightness and converts to percent', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('Brightness: 0.63');

    await expect(getLinuxBrightness(execFileAsync)).resolves.toBe(63);
    expect(execFileAsync).toHaveBeenCalledWith('xrandr', [
      '--verbose',
      '--current',
    ]);
  });

  it('returns null when xrandr output has no brightness', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('no brightness info');

    await expect(getLinuxBrightness(execFileAsync)).resolves.toBeNull();
  });

  it('returns null when parsed brightness is invalid', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('Brightness: abc');

    await expect(getLinuxBrightness(execFileAsync)).resolves.toBeNull();
  });

  it('sets brightness on first connected display', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValueOnce('HDMI-1 connected primary 1920x1080+0+0')
      .mockResolvedValueOnce('ok');

    await setLinuxBrightness(execFileAsync, 55);

    expect(execFileAsync).toHaveBeenNthCalledWith(1, 'xrandr', ['--current']);
    expect(execFileAsync).toHaveBeenNthCalledWith(2, 'xrandr', [
      '--output',
      'HDMI-1',
      '--brightness',
      '0.55',
    ]);
  });

  it('throws when no connected display can be determined', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('disconnected');

    await expect(setLinuxBrightness(execFileAsync, 55)).rejects.toThrow(
      'Could not determine connected display'
    );
  });
});
