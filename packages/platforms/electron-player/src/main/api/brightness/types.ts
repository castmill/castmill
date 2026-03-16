export type ExecFileAsync = (file: string, args: string[]) => Promise<string>;

export const BRIGHTNESS_NOT_SUPPORTED_ERROR =
  'Brightness control not supported on this platform';
