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
  /**
   * Resolves when the element may load its source. Platforms with a limited
   * number of hardware decoders delay loading until one is free.
   */
  whenLoadable?(): Promise<void>;
}

export type VideoPlaybackControllerFactory = (
  video: HTMLVideoElement,
  context: {
    reportError?: (input: PlayerRuntimeError) => void;
    refreshMedia: () => Promise<string | void>;
    /**
     * Signals that the video cannot play right now (e.g. no free hardware
     * decoder), or that it can again when called without a block. Playlists
     * skip an item that stays blocked and report the block.
     */
    setBlocked?: (block?: PlayerRuntimeError) => void;
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
  /**
   * Set by each template widget for the components it renders, so a blocked
   * video marks the nearest playlist item as blocked. Not meant to be
   * provided by the player host.
   */
  setPlaybackBlocked?: (source: object, block?: PlayerRuntimeError) => void;
}
