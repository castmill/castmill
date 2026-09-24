export interface PlayerRuntimeError {
  category: 'playback' | 'media-load' | 'runtime';
  code?: string;
  error: unknown;
}

/**
 * Per-video playback integration. Offsets are milliseconds.
 * Implementations own asynchronous preparation and must handle/report rejections.
 * Pause, newer operations, and disposal must cancel pending playback.
 */
export interface VideoPlaybackController {
  seek(offsetMs: number): void;
  play(offsetMs: number): void;
  pause(): void;
  dispose(): void;
  recoverMedia?(): Promise<string | void>;
}

export type VideoPlaybackControllerFactory = (
  video: HTMLVideoElement,
  context: {
    reportError?: (input: PlayerRuntimeError) => void;
    refreshMedia: () => Promise<string | void>;
  }
) => VideoPlaybackController;

export interface PlayerGlobals {
  target: 'thumbnail' | 'preview' | 'poster';
  /**
   * Whether audio should be muted. This is important for browser previews
   * where autoplay restrictions require videos to be muted.
   * Default: false
   */
  muted?: boolean;
  reportError?: (input: PlayerRuntimeError) => void;
  /** Optional per-element integration; omitted to use the default HTML video behavior. */
  createVideoPlaybackController?: VideoPlaybackControllerFactory;
}
