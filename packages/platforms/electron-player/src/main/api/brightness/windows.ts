import type { ExecFileAsync } from './types';

const POWERSHELL_GET_BRIGHTNESS =
  '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1 -ExpandProperty CurrentBrightness)';

const POWERSHELL_SET_BRIGHTNESS =
  '(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1).WmiSetBrightness(1,[int]$args[0])';

export const getWindowsBrightness = async (
  execFileAsync: ExecFileAsync
): Promise<number | null> => {
  const output = await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    POWERSHELL_GET_BRIGHTNESS,
  ]);

  const parsed = Number.parseInt(output, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const setWindowsBrightness = async (
  execFileAsync: ExecFileAsync,
  brightness: number
): Promise<void> => {
  await execFileAsync('powershell', [
    '-NoProfile',
    '-Command',
    POWERSHELL_SET_BRIGHTNESS,
    String(brightness),
  ]);
};
