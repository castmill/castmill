import { getDarwinBrightness, setDarwinBrightness } from './darwin';
import { getLinuxBrightness, setLinuxBrightness } from './linux';
import { getWindowsBrightness, setWindowsBrightness } from './windows';
import { BRIGHTNESS_NOT_SUPPORTED_ERROR, type ExecFileAsync } from './types';

const clampBrightness = (brightness: number): number => {
  return Math.max(0, Math.min(100, Math.round(brightness)));
};

export const getBrightnessForPlatform = async (
  platform: NodeJS.Platform,
  execFileAsync: ExecFileAsync
): Promise<number | null> => {
  try {
    if (platform === 'win32') {
      return await getWindowsBrightness(execFileAsync);
    }

    if (platform === 'linux') {
      return await getLinuxBrightness(execFileAsync);
    }

    if (platform === 'darwin') {
      return await getDarwinBrightness(execFileAsync);
    }

    return null;
  } catch {
    return null;
  }
};

export const setBrightnessForPlatform = async (
  platform: NodeJS.Platform,
  execFileAsync: ExecFileAsync,
  brightness: number
): Promise<void> => {
  const clampedBrightness = clampBrightness(brightness);

  if (platform === 'win32') {
    await setWindowsBrightness(execFileAsync, clampedBrightness);
    return;
  }

  if (platform === 'linux') {
    await setLinuxBrightness(execFileAsync, clampedBrightness);
    return;
  }

  if (platform === 'darwin') {
    await setDarwinBrightness(execFileAsync, clampedBrightness);
    return;
  }

  throw new Error(BRIGHTNESS_NOT_SUPPORTED_ERROR);
};
