import type { ExecFileAsync } from './types';
import { BRIGHTNESS_NOT_SUPPORTED_ERROR } from './types';

export const getDarwinBrightness = async (
  execFileAsync: ExecFileAsync
): Promise<number | null> => {
  try {
    const output = await execFileAsync('brightness', ['-l']);
    const match = output.match(/brightness\s+([0-9.]+)/i);
    if (!match) {
      return null;
    }

    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed)
      ? Math.max(0, Math.min(100, Math.round(parsed * 100)))
      : null;
  } catch {
    return null;
  }
};

export const setDarwinBrightness = async (
  execFileAsync: ExecFileAsync,
  brightness: number
): Promise<void> => {
  const normalized = (brightness / 100).toFixed(2);

  try {
    await execFileAsync('brightness', [normalized]);
  } catch {
    throw new Error(BRIGHTNESS_NOT_SUPPORTED_ERROR);
  }
};
