export interface PlayerRuntimeError {
  category: 'playback' | 'media-load' | 'runtime';
  code?: string;
  error: unknown;
}

export interface PlayerGlobals {
  target: 'thumbnail' | 'preview' | 'poster';
  /**
   * Whether audio should be muted. This is important for browser previews
   * where autoplay restrictions require videos to be muted.
   * Default: false
   */
  muted?: boolean;
  reportError?: (input: PlayerRuntimeError) => void;
}
