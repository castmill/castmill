import type { Orientation, OrientationResult } from '@castmill/device';

export type NativePortrait = 'off' | '90' | '180' | '270';

export function toNativePortrait(orientation: Orientation): NativePortrait {
  switch (orientation) {
    case 0:
      return 'off';
    case 90:
      return '90';
    case 180:
      return '180';
    case 270:
      return '270';
  }
}

export interface NativePortraitApi {
  getNativePortraitMode(): Promise<{ nativePortrait: unknown }>;
  setNativePortraitMode(options: {
    nativePortrait: NativePortrait;
  }): Promise<void>;
}

export async function setWebosNativeOrientation(
  orientation: Orientation,
  api: NativePortraitApi
): Promise<void> {
  const current = await api.getNativePortraitMode();
  const value = current.nativePortrait;
  const normalized = value === 0 || value === '0' ? 'off' : String(value);
  if (!['off', '90', '180', '270'].includes(normalized)) {
    throw new Error('Invalid WebOS native portrait mode');
  }
  const desired = toNativePortrait(orientation);
  if (normalized !== desired) {
    await api.setNativePortraitMode({ nativePortrait: desired });
  }
}

export async function applyWebosOrientation(
  orientation: Orientation,
  native?: (orientation: Orientation) => Promise<void>
): Promise<OrientationResult> {
  if (native) {
    await native(orientation);
    return { mode: 'native' };
  }
  return { mode: 'css' };
}
