import { cleanup, render, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaylistPreview } from './playlist-preview';
import type { PlaylistPreviewRef } from './playlist-preview';
import styles from './widget-view.module.scss';
import { NEVER, of, ReplaySubject, Subject, throwError } from 'rxjs';

const mocks = vi.hoisted(() => ({
  fromJSON: vi.fn(
    (
      _playlist: unknown,
      _resourceManager: unknown,
      _globals: { target: string; freezePreviewDuringLoad: () => boolean }
    ) => ({
      layers: (_playlist as { items: { duration?: number }[] }).items.map(
        (item) => ({
          duration: () => item.duration || 10000,
          setDurationHint: vi.fn(),
        })
      ),
      duration: () =>
        (_playlist as { items: { duration?: number }[] }).items.reduce(
          (total, item) => total + (item.duration || 10000),
          0
        ),
      unload: vi.fn(),
    })
  ),
  player: undefined as
    | {
        isPlaying: boolean;
        position: number;
        seek: ReturnType<typeof vi.fn>;
        shown$: { next: () => void };
      }
    | undefined,
  shown: [] as unknown[],
  show: vi.fn(),
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
    shown$ = new ReplaySubject<void>(1);
    constructor() {
      mocks.player = this;
    }
    destroy() {}
  },
  Renderer: class {
    show(layer: unknown) {
      mocks.shown.push(layer);
      return mocks.show(layer);
    }
    clear() {}
  },
}));

beforeEach(() => {
  mocks.show.mockReturnValue(of('layer:show:end'));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.player = undefined;
  mocks.shown.length = 0;
  mocks.seek = 0;
  vi.useRealTimers();
});

describe('PlaylistPreview', () => {
  it('shows a loading indicator until the first item is shown', async () => {
    const { queryByTestId } = render(() => (
      <PlaylistPreview
        playlist={{ id: 1, name: 'Test', status: 'live', items: [] }}
        loadingLabel="Cargando..."
      />
    ));
    const indicator = queryByTestId('playlist-preview-loading');
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute('role')).toBe('status');
    expect(indicator?.getAttribute('aria-label')).toBe('Cargando...');

    mocks.player!.shown$.next();
    await waitFor(() => {
      expect(queryByTestId('playlist-preview-loading')).toBeNull();
    });
  });

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
    await vi.runAllTimersAsync();
    const offsets = await priming;
    expect(mocks.shown).toHaveLength(4);
    expect(player.seek).not.toHaveBeenCalled();
    expect(player.position).toBe(0);
    expect(mocks.setTimeDuration).toHaveBeenLastCalledWith(7500, 40000, true);
    expect(offsets?.map((item) => item.start)).toEqual([
      0, 10000, 20000, 30000,
    ]);
  });

  it('does not create or render a measurement playlist for fixed durations', async () => {
    let ref: PlaylistPreviewRef | undefined;
    render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Fixed',
          status: 'live',
          items: [
            { id: 1, duration: 26000 },
            { id: 2, duration: 18000 },
            { id: 3, duration: 20000 },
          ] as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));

    expect(await ref!.primeAllLayers()).toEqual([
      { start: 0, end: 26000, duration: 26000 },
      { start: 26000, end: 44000, duration: 18000 },
      { start: 44000, end: 64000, duration: 20000 },
    ]);
    expect(mocks.fromJSON).toHaveBeenCalledTimes(1);
    expect(mocks.shown).toHaveLength(0);
    expect(document.querySelector('[style*="-10000px"]')).toBeNull();
    expect(mocks.setTimeDuration).toHaveBeenLastCalledWith(0, 64000, true);
  });

  it('yields before measuring and only renders dynamic items in a mixed playlist', async () => {
    vi.useFakeTimers();
    let ref: PlaylistPreviewRef | undefined;
    render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Mixed',
          status: 'live',
          items: [
            { id: 1, duration: 26000 },
            { id: 2, duration: 0 },
            { id: 3, duration: 20000 },
          ] as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));

    const priming = ref!.primeAllLayers();
    expect(mocks.shown).toHaveLength(0);
    await vi.runAllTimersAsync();
    expect(mocks.shown).toEqual([
      mocks.fromJSON.mock.results[1].value.layers[1],
    ]);
    expect((await priming)?.map((item) => item.start)).toEqual([
      0, 26000, 36000,
    ]);
  });

  it('cancels measurement and removes the offscreen stage on unmount', async () => {
    vi.useFakeTimers();
    mocks.show.mockReturnValue(NEVER);
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
    await vi.advanceTimersByTimeAsync(0);
    const stage = document.querySelector<HTMLElement>('[style*="-10000px"]');
    expect(stage).not.toBeNull();
    unmount();
    expect(await priming).toBeUndefined();
    expect(stage?.isConnected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a ready ten-second item without waiting for the deadline', async () => {
    vi.useFakeTimers();
    let ref: PlaylistPreviewRef | undefined;
    render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Ten seconds',
          status: 'live',
          items: [{ id: 1, duration: 0 }] as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));
    const priming = ref!.primeAllLayers();
    await vi.advanceTimersByTimeAsync(0);
    expect(await priming).toEqual([{ start: 0, end: 10000, duration: 10000 }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for readiness even when the initial duration is not ten seconds', async () => {
    vi.useFakeTimers();
    const ready$ = new Subject<string>();
    mocks.show.mockReturnValue(ready$);
    let ref: PlaylistPreviewRef | undefined;
    render(() => (
      <PlaylistPreview
        playlist={{
          id: 1,
          name: 'Delayed',
          status: 'live',
          items: [{ id: 1, duration: 0 }] as never,
        }}
        onReady={(value) => {
          ref = value;
        }}
      />
    ));
    const priming = ref!.primeAllLayers();
    const measured = mocks.fromJSON.mock.results[1].value.layers[0];
    let duration = 18000;
    measured.duration = () => duration;
    await vi.advanceTimersByTimeAsync(700);
    const visible = mocks.fromJSON.mock.results[0].value.layers[0];
    expect(visible.setDurationHint).not.toHaveBeenCalled();
    duration = 26000;
    ready$.next('layer:show:end');
    await priming;
    expect(visible.setDurationHint).toHaveBeenCalledWith(26000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['timeout', 'error', 'reported error'])(
    'reports a measurement %s without publishing offsets and cleans up',
    async (failure) => {
      vi.useFakeTimers();
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.show.mockReturnValue(
        failure === 'timeout'
          ? NEVER
          : failure === 'error'
            ? throwError(() => new Error('Failed to show'))
            : of('error')
      );
      let ref: PlaylistPreviewRef | undefined;
      const { unmount } = render(() => (
        <PlaylistPreview
          playlist={{
            id: 1,
            name: 'Failure',
            status: 'live',
            items: [{ id: 1, duration: 0 }] as never,
          }}
          onReady={(value) => {
            ref = value;
          }}
        />
      ));
      const priming = ref!.primeAllLayers();
      await vi.advanceTimersByTimeAsync(10000);
      expect(await priming).toBeUndefined();
      expect(log).toHaveBeenCalledWith(
        '[PlaylistPreview] Duration measurement failed:',
        expect.any(Error)
      );
      expect(
        mocks.fromJSON.mock.results[0].value.layers[0].setDurationHint
      ).not.toHaveBeenCalled();
      expect(document.querySelector('[style*="-10000px"]')).toBeNull();
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      log.mockRestore();
    }
  );
});
