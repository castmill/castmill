import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaylistPreview } from './playlist-preview';
import type { PlaylistPreviewRef } from './playlist-preview';
import styles from './widget-view.module.scss';
import { NEVER } from 'rxjs';

const mocks = vi.hoisted(() => ({
  fromJSON: vi.fn(
    (
      _playlist: unknown,
      _resourceManager: unknown,
      _globals: { target: string; freezePreviewDuringLoad: () => boolean }
    ) => ({
      layers: (_playlist as { items: unknown[] }).items.map(() => ({
        duration: () => 10000,
        setDurationHint: vi.fn(),
      })),
      duration: () => (_playlist as { items: unknown[] }).items.length * 10000,
      unload: vi.fn(),
    })
  ),
  player: undefined as
    | { isPlaying: boolean; position: number; seek: ReturnType<typeof vi.fn> }
    | undefined,
  shown: [] as unknown[],
  setTimeDuration: vi.fn(),
  seek: 0,
}));

vi.mock('@castmill/cache', () => ({
  Cache: class {
    async init() {}
  },
  ResourceManager: class {},
  StorageDummy: class {},
}));

vi.mock('@castmill/player', () => ({
  Playlist: {
    fromJSON: mocks.fromJSON,
  },
  PlayerUIControls: class {
    setTimeDuration = mocks.setTimeDuration;
    get seek() {
      return mocks.seek;
    }
    destroy() {}
  },
  PlayerUI: class {
    isPlaying = false;
    position = 0;
    loop = true;
    seek = vi.fn();
    constructor() {
      mocks.player = this;
    }
    destroy() {}
  },
  Renderer: class {
    show(layer: unknown) {
      mocks.shown.push(layer);
      return NEVER;
    }
    clear() {}
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.player = undefined;
  mocks.shown.length = 0;
  mocks.seek = 0;
  vi.useRealTimers();
});

describe('PlaylistPreview', () => {
  it('uses the playlist toolbar layout independently of the widget editor', async () => {
    const { container } = render(() => (
      <PlaylistPreview
        playlist={{ id: 1, name: 'Test', status: 'live', items: [] }}
      />
    ));
    await waitFor(() => {
      expect(container.querySelector('#player')).not.toBeNull();
    });
    const controls = container.querySelector('#controls');
    expect(controls?.classList.contains(styles.playlistControls)).toBe(true);
    expect(controls?.classList.contains(styles.widgetControls)).toBe(false);
    const globals = mocks.fromJSON.mock.calls[0][2];
    expect(globals.target).toBe('preview');
    expect(globals.freezePreviewDuringLoad()).toBe(true);
    mocks.player!.isPlaying = true;
    expect(globals.freezePreviewDuringLoad()).toBe(false);
  });

  it('measures all layers offscreen without seeking or resetting the preview', async () => {
    vi.useFakeTimers();
    let ref: PlaylistPreviewRef | undefined;
    render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Test',
          status: 'live',
          items: [1, 2, 3, 4].map((id) => ({ id, duration: 0 })) as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));
    expect(ref).toBeDefined();
    const player = mocks.player!;
    const priming = ref!.primeAllLayers();
    player.position = 0;
    mocks.seek = 7500;
    await vi.advanceTimersByTimeAsync(40000);
    const offsets = await priming;
    expect(mocks.shown).toHaveLength(4);
    expect(player.seek).not.toHaveBeenCalled();
    expect(player.position).toBe(0);
    expect(mocks.setTimeDuration).toHaveBeenLastCalledWith(7500, 40000, true);
    expect(offsets?.map((item) => item.start)).toEqual([
      0, 10000, 20000, 30000,
    ]);
  });

  it('cancels measurement and removes the offscreen stage on unmount', async () => {
    vi.useFakeTimers();
    let ref: PlaylistPreviewRef | undefined;
    const { unmount } = render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Test',
          status: 'live',
          items: [{ id: 1, duration: 0 }] as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));
    const priming = ref!.primeAllLayers();
    const stage = document.querySelector<HTMLElement>('[style*="-10000px"]');
    expect(stage).not.toBeNull();
    unmount();
    expect(await priming).toBeUndefined();
    expect(stage?.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
