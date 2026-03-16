import { describe, expect, it, vi } from 'vitest';
import { getBrightnessForPlatform, setBrightnessForPlatform } from './index';

describe('brightness platform dispatcher', () => {
  it('returns null for unsupported platform on get', async () => {
    const execFileAsync = vi.fn<[string, string[]], Promise<string>>();

    const result = await getBrightnessForPlatform('aix', execFileAsync);

    expect(result).toBeNull();
    expect(execFileAsync).not.toHaveBeenCalled();
  });

  it('returns null if get operation throws', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockRejectedValue(new Error('failed'));

    const result = await getBrightnessForPlatform('win32', execFileAsync);

    expect(result).toBeNull();
  });

  it('throws for unsupported platform on set', async () => {
    const execFileAsync = vi.fn<[string, string[]], Promise<string>>();

    await expect(
      setBrightnessForPlatform('aix', execFileAsync, 50)
    ).rejects.toThrow('Brightness control not supported on this platform');
  });

  it('clamps and rounds brightness for windows set', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('ok');

    await setBrightnessForPlatform('win32', execFileAsync, 120.4);

    expect(execFileAsync).toHaveBeenCalledWith('powershell', [
      '-NoProfile',
      '-Command',
      '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1).WmiSetBrightness(1,[int]$args[0])',
      '100',
    ]);
  });
});
