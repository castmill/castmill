import type { ExecFileAsync } from './types';

export const getLinuxBrightness = async (
  execFileAsync: ExecFileAsync
): Promise<number | null> => {
  const output = await execFileAsync('xrandr', ['--verbose', '--current']);
  const match = output.match(/Brightness:\s*([0-9.]+)/i);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.min(100, Math.round(parsed * 100)))
    : null;
};

export const setLinuxBrightness = async (
  execFileAsync: ExecFileAsync,
  brightness: number
): Promise<void> => {
  const displayOutput = await execFileAsync('xrandr', ['--current']);
  const displayMatch = displayOutput.match(/^([^\s]+)\s+connected\b/m);
  const display = displayMatch?.[1];

  if (!display) {
    throw new Error('Could not determine connected display');
  }

  const normalized = (brightness / 100).toFixed(2);
  await execFileAsync('xrandr', [
    '--output',
    display,
    '--brightness',
    normalized,
  ]);
};
