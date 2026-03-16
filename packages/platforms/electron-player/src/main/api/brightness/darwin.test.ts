import { describe, expect, it, vi } from 'vitest';
import { getDarwinBrightness, setDarwinBrightness } from './darwin';

describe('darwin brightness', () => {
  it('parses brightness output and converts to percent', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('display 0: brightness 0.42');

    await expect(getDarwinBrightness(execFileAsync)).resolves.toBe(42);
    expect(execFileAsync).toHaveBeenCalledWith('brightness', ['-l']);
  });

  it('returns null when output does not contain brightness value', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('display 0: unknown');

    await expect(getDarwinBrightness(execFileAsync)).resolves.toBeNull();
  });

  it('returns null when brightness command fails', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockRejectedValue(new Error('not installed'));

    await expect(getDarwinBrightness(execFileAsync)).resolves.toBeNull();
  });

  it('passes normalized value to brightness command', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('ok');

    await setDarwinBrightness(execFileAsync, 7);

    expect(execFileAsync).toHaveBeenCalledWith('brightness', ['0.07']);
  });

  it('throws unsupported error when setting fails', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockRejectedValue(new Error('failed'));

    await expect(setDarwinBrightness(execFileAsync, 20)).rejects.toThrow(
      'Brightness control not supported on this platform'
    );
  });
});
