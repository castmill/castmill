import { describe, expect, it, vi } from 'vitest';
import { getWindowsBrightness, setWindowsBrightness } from './windows';

describe('windows brightness', () => {
  it('parses integer brightness from powershell output', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('67');

    await expect(getWindowsBrightness(execFileAsync)).resolves.toBe(67);
    expect(execFileAsync).toHaveBeenCalledWith('powershell', [
      '-NoProfile',
      '-Command',
      '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1 -ExpandProperty CurrentBrightness)',
    ]);
  });

  it('returns null for non-numeric output', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('not-a-number');

    await expect(getWindowsBrightness(execFileAsync)).resolves.toBeNull();
  });

  it('passes brightness value to powershell setter', async () => {
    const execFileAsync = vi
      .fn<[string, string[]], Promise<string>>()
      .mockResolvedValue('ok');

    await setWindowsBrightness(execFileAsync, 42);

    expect(execFileAsync).toHaveBeenCalledWith('powershell', [
      '-NoProfile',
      '-Command',
      '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1).WmiSetBrightness(1,[int]$args[0])',
      '42',
    ]);
  });
});
