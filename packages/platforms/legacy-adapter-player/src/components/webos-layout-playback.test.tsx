import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Layer } from '../../../../player/src/layer';
import { Player } from '../../../../player/src/player';
import { Playlist } from '../../../../player/src/playlist';
import { Renderer } from '../../../../player/src/renderer';
import type { PlayerRuntimeError } from '../../../../player/src/interfaces/player-globals.interface';
import { BLOCKED_ITEM_SKIP_MS } from '../../../../player/src/playlist';
import {
  DECODER_LIMIT_ERROR_CODE,
  MAX_LOADED_VIDEOS,
  WebosVideoPlayback,
  createWebosVideoPlayback,
  webosDecoderBudget,
} from '@castmill/webos-player/shared';

// End-to-end guard for WebOS playback: the real Player renders layouts with
// real video widgets and the WebOS playback controller, while a simulated
// media stack enforces how the hardware behaves. Every tick the test checks
// that no more than MAX_LOADED_VIDEOS video tags hold a source or play.

const LOAD_MS = 300;
const TICK_MS = 100;

interface MediaState {
  name?: string;
  readyState: number;
  paused: boolean;
  position: number;
  startedAt: number;
  loadTimer?: ReturnType<typeof setTimeout>;
}

interface PlaySession {
  name: string;
  startedAt: number;
  from: number;
  to?: number;
}

const durations = new Map<string, number>();
const media = new WeakMap<HTMLMediaElement, MediaState>();
let sessions: PlaySession[] = [];

const nameOf = (url: string) => /\/(\w+)\.mp4$/.exec(url)?.[1];

const stateOf = (video: HTMLMediaElement): MediaState => {
  let state = media.get(video);
  if (!state) {
    state = { readyState: 0, paused: true, position: 0, startedAt: 0 };
    media.set(video, state);
  }
  return state;
};

const durationOf = (state: MediaState) =>
  state.readyState >= 1 && state.name ? durations.get(state.name)! : NaN;

const positionOf = (state: MediaState) =>
  state.paused
    ? state.position
    : Math.min(
        durationOf(state),
        state.position + (Date.now() - state.startedAt) / 1000
      );

const scheduleLoad = (video: HTMLMediaElement) => {
  const state = stateOf(video);
  clearTimeout(state.loadTimer);
  state.readyState = 0;
  state.paused = true;
  state.position = 0;
  const src = video.getAttribute('src');
  state.name = src ? nameOf(src) : undefined;
  if (!src) return;
  state.loadTimer = setTimeout(() => {
    state.readyState = 4;
    ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough'].forEach(
      (type) => video.dispatchEvent(new Event(type))
    );
  }, LOAD_MS);
};

const closeSession = (state: MediaState) => {
  const session = sessions.find(
    (entry) => entry.name === state.name && entry.to === undefined
  );
  if (session) session.to = positionOf(state);
};

const installMediaSimulation = () => {
  const proto = HTMLMediaElement.prototype;
  const srcDescriptor = Object.getOwnPropertyDescriptor(proto, 'src')!;
  const originals = [
    'src',
    'readyState',
    'paused',
    'ended',
    'duration',
    'currentTime',
    'load',
    'play',
    'pause',
  ].map((key) => [key, Object.getOwnPropertyDescriptor(proto, key)] as const);

  Object.defineProperties(proto, {
    src: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return srcDescriptor.get!.call(this);
      },
      set(this: HTMLMediaElement, value: string) {
        srcDescriptor.set!.call(this, value);
        scheduleLoad(this);
      },
    },
    readyState: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).readyState;
      },
    },
    paused: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return stateOf(this).paused;
      },
    },
    duration: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return durationOf(stateOf(this));
      },
    },
    ended: {
      configurable: true,
      get(this: HTMLMediaElement) {
        const state = stateOf(this);
        return state.readyState >= 1 && positionOf(state) >= durationOf(state);
      },
    },
    currentTime: {
      configurable: true,
      get(this: HTMLMediaElement) {
        return positionOf(stateOf(this));
      },
      set(this: HTMLMediaElement, value: number) {
        const state = stateOf(this);
        if (state.readyState < 1) {
          throw new DOMException('HAVE_NOTHING', 'InvalidStateError');
        }
        state.position = value;
        state.startedAt = Date.now();
      },
    },
    load: {
      configurable: true,
      value(this: HTMLMediaElement) {
        const state = stateOf(this);
        if (!state.paused) closeSession(state);
        scheduleLoad(this);
      },
    },
    play: {
      configurable: true,
      value(this: HTMLMediaElement) {
        const state = stateOf(this);
        if (state.readyState < 1 || !state.name) {
          return Promise.reject(new Error('Media not loaded'));
        }
        if (state.paused) {
          state.paused = false;
          state.startedAt = Date.now();
          sessions.push({
            name: state.name,
            startedAt: Date.now(),
            from: state.position,
          });
        }
        return Promise.resolve();
      },
    },
    pause: {
      configurable: true,
      value(this: HTMLMediaElement) {
        const state = stateOf(this);
        if (state.paused) return;
        closeSession(state);
        state.position = positionOf(state);
        state.paused = true;
      },
    },
  });

  return () =>
    originals.forEach(([key, descriptor]) => {
      if (descriptor) Object.defineProperty(proto, key, descriptor);
      else delete (proto as unknown as Record<string, unknown>)[key];
    });
};

const videoItem = (name: string, seconds: number) => {
  durations.set(name, seconds);
  return {
    name,
    duration: seconds * 1000,
    widget: {
      name: 'Video',
      template: {
        name: 'video',
        type: 'video',
        opts: { url: { key: 'options.video.files[@target].uri' } },
      },
    },
    config: {
      options: {
        video: {
          files: { poster: { uri: `https://media.test/${name}.mp4` } },
        },
      },
      data: {},
    },
  };
};

const imageItem = (name: string, seconds: number) => ({
  name,
  duration: seconds * 1000,
  widget: {
    name: 'Image',
    template: {
      name: 'image',
      type: 'image',
      opts: { url: `https://media.test/${name}.png` },
    },
  },
  config: { options: {}, data: {} },
});

type Item = ReturnType<typeof videoItem> | ReturnType<typeof imageItem>;

// Mirrors a "Layout Widget" item whose zones bind playlists via layoutRef.
const layoutItem = (name: string, zonePlaylists: Item[][]) => {
  const width = 100 / zonePlaylists.length;
  const zones = zonePlaylists.map((_, index) => ({
    id: `${name}-z${index}`,
    rect: { x: index * width, y: 0, width, height: 100 },
  }));
  const zonePlaylistMap = Object.fromEntries(
    zonePlaylists.map((items, index) => [
      `${name}-z${index}`,
      { playlistId: index + 1, playlist: { name: `${name}-${index}`, items } },
    ])
  );
  return {
    name,
    duration: 0,
    widget: {
      name: 'Layout Widget',
      template: {
        name: 'layout-ref-widget',
        type: 'layout',
        opts: { layoutRef: { key: 'options.layoutRef' } },
        style: { width: '100%', height: '100%' },
      },
    },
    config: {
      data: {},
      options: {
        layoutRef: {
          layoutId: 1,
          aspectRatio: '16:9',
          zones: { zones },
          zonePlaylistMap,
        },
      },
    },
  };
};

interface Stats {
  maxVideoTags: number;
  maxWithSource: number;
  maxPlaying: number;
}

describe('WebOS layout playback with the decoder budget', () => {
  let restoreMedia: () => void;
  let root: HTMLDivElement;
  let player: Player | undefined;
  let reports: PlayerRuntimeError[];
  let stats: Stats;
  let holders: WebosVideoPlayback[];

  const resources = {
    getMedia: async (url: string) => url,
    refreshMedia: async (url: string) => url,
  } as never;

  beforeEach(() => {
    vi.useFakeTimers({
      now: 0,
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    restoreMedia = installMediaSimulation();
    webosDecoderBudget.clear();
    durations.clear();
    sessions = [];
    reports = [];
    stats = { maxVideoTags: 0, maxWithSource: 0, maxPlaying: 0 };
    holders = [];
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(async () => {
    player?.clear();
    player = undefined;
    holders.forEach((holder) => holder.dispose());
    // Let the controllers settle the pauses and seeks of the removed layers
    // while the media simulation is still installed.
    await vi.advanceTimersByTimeAsync(1000);
    root.remove();
    webosDecoderBudget.clear();
    restoreMedia();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const videos = () => Array.from(document.querySelectorAll('video'));

  const sample = () => {
    const tags = videos();
    const withSource = tags.filter((video) => video.getAttribute('src'));
    const playing = tags.filter((video) => !video.paused);
    stats.maxVideoTags = Math.max(stats.maxVideoTags, tags.length);
    stats.maxWithSource = Math.max(stats.maxWithSource, withSource.length);
    stats.maxPlaying = Math.max(stats.maxPlaying, playing.length);
    // Blocked videos are skipped or leave their area empty; the adapter no
    // longer covers them with a notice.
    expect(
      document.querySelectorAll('[data-component="video-decoder-notice"]')
    ).toHaveLength(0);
    expect(withSource.length).toBeLessThanOrEqual(MAX_LOADED_VIDEOS);
    expect(playing.length).toBeLessThanOrEqual(MAX_LOADED_VIDEOS);
    expect(webosDecoderBudget.size).toBeLessThanOrEqual(MAX_LOADED_VIDEOS);
  };

  const run = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
      await vi.advanceTimersByTimeAsync(TICK_MS);
      sample();
    }
  };

  const start = (items: object[]) => {
    const queue = new Playlist('queue', resources);
    queue.add(
      Layer.fromPlaylist({ name: 'channel', items } as never, resources, {
        target: 'poster',
        reportError: (report) => reports.push(report),
        createVideoPlaybackController: createWebosVideoPlayback,
      })
    );
    player = new Player(queue, new Renderer(root));
    player.play({ loop: true });
  };

  const startsOf = (name: string) =>
    sessions
      .filter((session) => session.name === name && session.from < 0.1)
      .map((session) => session.startedAt);

  // Each zone renders its current item and at most the preloaded next one.
  const maxTagsFor = (zones: number) => zones * 2;

  const played = (name: string) =>
    sessions.filter(
      (session) => session.name === name && session.to !== undefined
    );

  const loops = (names: string[], count: number) =>
    Array.from({ length: count }, () => names).reduce(
      (all, loop) => all.concat(loop),
      [] as string[]
    );

  const order = (names: string[]) =>
    sessions
      .filter((session) => names.indexOf(session.name) >= 0)
      .map((session) => session.name);

  const expectFullPlayback = (names: string[]) =>
    names.forEach((name) => {
      const sessionsOf = played(name);
      expect(sessionsOf.length).toBeGreaterThan(0);
      sessionsOf.forEach((session) =>
        // Loading a released video costs LOAD_MS of its slot.
        expect(session.to!).toBeGreaterThanOrEqual(
          durations.get(name)! - (LOAD_MS + TICK_MS) / 1000
        )
      );
    });

  // A looping zone reloads its video, and the controller may defer a restart
  // by up to RESTART_DEFER_MS (250) so the handoff does not blank the screen.
  const LOOP_TOLERANCE_MS = 250 + TICK_MS;

  const expectLoopPeriod = (name: string, period: number) => {
    const starts = startsOf(name);
    expect(starts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < starts.length; i++) {
      expect(Math.abs(starts[i] - starts[i - 1] - period)).toBeLessThanOrEqual(
        LOOP_TOLERANCE_MS
      );
    }
  };

  const expectStableTagCount = async (period: number, loops: number) => {
    const counts: number[] = [];
    for (let i = 0; i < loops; i++) {
      await run(period);
      counts.push(videos().length);
    }
    expect(new Set(counts).size).toBe(1);
    return counts[0];
  };

  const expectNoDecoderReports = () =>
    expect(
      reports.filter((report) => report.code === DECODER_LIMIT_ERROR_CODE)
    ).toEqual([]);

  const decoderReports = () =>
    reports.filter((report) => report.code === DECODER_LIMIT_ERROR_CODE);

  // Plays videos outside the player so they keep the decoders taken.
  const occupyDecoders = async (count: number) => {
    durations.set('hold', 3600);
    for (let i = 0; i < count; i++) {
      const video = document.createElement('video');
      document.body.appendChild(video);
      const holder = new WebosVideoPlayback(video);
      holders.push(holder);
      video.src = 'https://media.test/hold.mp4';
      holder.play(0);
    }
    await run(LOAD_MS + TICK_MS);
    expect(webosDecoderBudget.size).toBe(count);
  };

  const releaseDecoder = () => {
    const holder = holders.shift()!;
    holder.dispose();
    const video = document.querySelector('video[src$="hold.mp4"]');
    video?.remove();
  };

  const isShown = (name: string) =>
    Array.from(
      document.querySelectorAll<HTMLElement>(`[data-layer="${name}"]`)
    ).some(
      (layer) =>
        document.body.contains(layer) && layer.style.visibility !== 'hidden'
    );

  const shownAt = async (name: string, limit: number) => {
    const from = Date.now();
    while (!isShown(name)) {
      if (Date.now() - from > limit) throw new Error(`${name} not shown`);
      await run(TICK_MS);
    }
    return Date.now() - from;
  };

  it('plays a layout with two video playlists in full, loop after loop', async () => {
    start([
      layoutItem('layout', [
        [videoItem('a', 12), videoItem('b', 6)],
        [videoItem('c', 9), videoItem('d', 9)],
      ]),
    ]);

    await run(1000);
    const tags = await expectStableTagCount(18_000, 4);

    expect(tags).toBeLessThanOrEqual(maxTagsFor(2));
    expect(stats.maxVideoTags).toBeLessThanOrEqual(maxTagsFor(2));
    expect(stats.maxPlaying).toBe(2);
    expect(order(['a', 'b'])).toEqual(loops(['a', 'b'], 4).concat('a'));
    expect(order(['c', 'd'])).toEqual(loops(['c', 'd'], 4).concat('c'));
    expectFullPlayback(['a', 'b', 'c', 'd']);
    // A layout that restarts early (e.g. at a 10 s default) breaks the period.
    expectLoopPeriod('a', 18_000);
    expectLoopPeriod('c', 18_000);
    expect(reports).toEqual([]);
  });

  it('hands the decoders over between consecutive video layouts', async () => {
    start([
      layoutItem('first', [[videoItem('a', 6)], [videoItem('b', 6)]]),
      layoutItem('second', [[videoItem('c', 6)], [videoItem('d', 6)]]),
    ]);

    await run(1000);
    const tags = await expectStableTagCount(12_000, 5);

    expect(tags).toBeLessThanOrEqual(maxTagsFor(4));
    expect(stats.maxVideoTags).toBeLessThanOrEqual(maxTagsFor(4));
    expect(order(['a', 'c'])).toEqual(loops(['a', 'c'], 5).concat('a'));
    expect(order(['b', 'd'])).toEqual(loops(['b', 'd'], 5).concat('b'));
    // The second layout starts as soon as the first one stops.
    startsOf('c').forEach((at, index) =>
      expect(Math.abs(at - startsOf('a')[index] - 6000)).toBeLessThanOrEqual(
        TICK_MS
      )
    );
    expectFullPlayback(['a', 'b', 'c', 'd']);
    expectLoopPeriod('a', 12_000);
    expectNoDecoderReports();
  });

  it('plays a full-screen video playlist with at most one video playing', async () => {
    start([videoItem('a', 5), videoItem('b', 5), videoItem('c', 5)]);

    await run(1000);
    const tags = await expectStableTagCount(15_000, 3);

    expect(tags).toBeLessThanOrEqual(maxTagsFor(1));
    expect(stats.maxVideoTags).toBeLessThanOrEqual(maxTagsFor(1));
    expect(stats.maxPlaying).toBe(1);
    expect(order(['a', 'b', 'c'])).toEqual(
      loops(['a', 'b', 'c'], 3).concat('a')
    );
    expectFullPlayback(['a', 'b', 'c']);
    expectLoopPeriod('a', 15_000);
    expect(reports).toEqual([]);
  });

  it('keeps playing and reports blocked videos when zones exceed the decoders', async () => {
    start([
      layoutItem('crowded', [
        [videoItem('a', 8)],
        [videoItem('b', 8)],
        [videoItem('c', 8)],
      ]),
    ]);

    await run(1000);
    const tags = await expectStableTagCount(8000, 4);

    expect(tags).toBeLessThanOrEqual(maxTagsFor(3));
    expect(stats.maxPlaying).toBe(2);
    // Playback is not stopped: two videos keep playing in every loop.
    for (let loop = 0; loop < 4; loop++) {
      const from = 1000 + loop * 8000;
      const inLoop = sessions.filter(
        (session) =>
          session.startedAt >= from && session.startedAt < from + 8000
      );
      expect(inLoop.length).toBeGreaterThanOrEqual(2);
    }
    expect(
      played('a').length + played('b').length + played('c').length
    ).toBeGreaterThanOrEqual(8);
    expect(reports.length).toBeGreaterThan(0);
    reports.forEach((report) => {
      expect(report).toMatchObject({
        category: 'playback',
        code: DECODER_LIMIT_ERROR_CODE,
      });
      expect(String(report.error)).toContain(
        `more than ${MAX_LOADED_VIDEOS} videos at the same time`
      );
      expect(String(report.error)).toContain('was skipped');
    });
  });

  it('releases every decoder when the content is cleared', async () => {
    start([
      layoutItem('crowded', [
        [videoItem('a', 8)],
        [videoItem('b', 8)],
        [videoItem('c', 8)],
      ]),
    ]);
    await run(3000);
    expect(webosDecoderBudget.size).toBe(MAX_LOADED_VIDEOS);
    expect(webosDecoderBudget.waiting).toBe(1);
    const reported = reports.length;

    player!.clear();
    await run(10_000);

    // Removed layers keep their widgets mounted, but none of their videos may
    // hold or take a decoder, or report blocked playback.
    expect(videos()).toHaveLength(0);
    expect(webosDecoderBudget.size).toBe(0);
    expect(reports).toHaveLength(reported);
  });

  it('plays new content at once after a channel change', async () => {
    start([
      layoutItem('crowded', [
        [videoItem('a', 8)],
        [videoItem('b', 8)],
        [videoItem('c', 8)],
      ]),
    ]);
    await run(3000);

    // Mirrors Device.resetPlaybackQueue followed by new channel content.
    player!.clear();
    start([layoutItem('next', [[videoItem('d', 6)], [videoItem('e', 6)]])]);
    const switchedAt = Date.now();
    await run(13_000);

    expect(startsOf('d')[0] - switchedAt).toBeLessThanOrEqual(
      LOAD_MS + TICK_MS
    );
    expect(startsOf('e')[0] - switchedAt).toBeLessThanOrEqual(
      LOAD_MS + TICK_MS
    );
    expectFullPlayback(['d', 'e']);
    expectLoopPeriod('d', 6000);
  });

  it('skips a blocked video in a zone and plays the next item at once', async () => {
    start([
      layoutItem('mixed', [
        [videoItem('a', 20)],
        [videoItem('b', 20)],
        [videoItem('c', 5), imageItem('pic', 5)],
      ]),
    ]);

    // The image replaces the blocked video right after the skip delay.
    const skippedAfter = await shownAt('pic', 3000);
    expect(skippedAfter).toBeGreaterThanOrEqual(BLOCKED_ITEM_SKIP_MS);
    expect(skippedAfter).toBeLessThanOrEqual(
      BLOCKED_ITEM_SKIP_MS + LOAD_MS + 3 * TICK_MS
    );
    expect(decoderReports()).toHaveLength(1);
    expect(String(decoderReports()[0].error)).toContain('was skipped');

    // The image keeps its full slot; then the video is tried and skipped
    // again while the other zones still hold both decoders.
    await run(4500);
    expect(isShown('pic')).toBe(true);
    await run(2500);
    expect(decoderReports()).toHaveLength(2);
    expect(isShown('pic')).toBe(true);
    expect(played('c')).toHaveLength(0);
    expect(stats.maxPlaying).toBe(2);
  });

  it('waits with an empty zone when every item of the zone is blocked', async () => {
    await occupyDecoders(2);
    start([layoutItem('waiting', [[videoItem('c', 5), videoItem('d', 5)]])]);

    // c is skipped, d cannot be skipped to anything that could play.
    await run(2 * BLOCKED_ITEM_SKIP_MS + 500);
    expect(decoderReports()).toHaveLength(2);
    await run(5000);
    expect(decoderReports()).toHaveLength(2);
    expect(sessions.filter((session) => session.name !== 'hold')).toEqual([]);
    expect(isShown('c')).toBe(false);

    // The waiting video starts once a decoder is free, from its beginning
    // apart from its load time, and keeps its full slot.
    releaseDecoder();
    const freedAt = Date.now();
    await run(LOAD_MS + 3 * TICK_MS);
    const started = sessions.filter((session) => session.name === 'd');
    expect(started).toHaveLength(1);
    expect(started[0].startedAt - freedAt).toBeLessThanOrEqual(
      LOAD_MS + 2 * TICK_MS
    );
    expect(started[0].from).toBeLessThanOrEqual((LOAD_MS + TICK_MS) / 1000);
    await run(5500);
    expectFullPlayback(['d']);
  });

  it('skips a blocked video in a channel playlist', async () => {
    await occupyDecoders(2);
    start([videoItem('x', 5), imageItem('pic', 5)]);

    const skippedAfter = await shownAt('pic', 3000);
    expect(skippedAfter).toBeLessThanOrEqual(
      BLOCKED_ITEM_SKIP_MS + LOAD_MS + 3 * TICK_MS
    );
    expect(decoderReports()).toHaveLength(1);

    // Once a decoder is free the video plays in full on its next turn.
    releaseDecoder();
    await run(5000);
    await run(6000);
    expect(played('x').length).toBeGreaterThan(0);
    expectFullPlayback(['x']);
    expect(decoderReports()).toHaveLength(1);
  });

  it('does not skip a video that waits briefly for a handoff', async () => {
    start([
      layoutItem('handoff', [[videoItem('a', 3), videoItem('b', 3)]]),
      layoutItem('pair', [[videoItem('c', 3)], [videoItem('d', 3)]]),
    ]);

    await run(1000);
    await run(24_000);

    expectNoDecoderReports();
    expectFullPlayback(['a', 'b', 'c', 'd']);
  });
});
