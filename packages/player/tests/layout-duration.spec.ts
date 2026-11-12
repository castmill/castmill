import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { SinonFakeTimers, useFakeTimers } from 'sinon';
import {
  Layer,
  LayoutComponent,
  Player,
  Playlist,
  Renderer,
} from '../dist/index.js';

const fakePlaylist = (duration: () => number) => ({ duration }) as any;

describe('LayoutComponent.resolveDuration', () => {
  const create = () =>
    LayoutComponent.fromJSON(
      { name: 'layout', opts: { containers: [] }, style: {} },
      {} as any,
      { target: 'poster' }
    );

  it('uses the live duration of rendered playlists', () => {
    const layout = create();
    let duration = 30000;
    layout.attachRenderedPlaylist(fakePlaylist(() => duration));
    expect(layout.resolveDuration({})).to.equal(30000);

    // Video items report their real length once metadata loads.
    duration = 37946;
    expect(layout.resolveDuration({})).to.equal(37946);
  });

  it('uses the longest rendered playlist and ignores invalid durations', () => {
    const layout = create();
    layout.attachRenderedPlaylist(fakePlaylist(() => 12000));
    layout.attachRenderedPlaylist(fakePlaylist(() => NaN));
    layout.attachRenderedPlaylist(fakePlaylist(() => 20000));
    expect(layout.resolveDuration({})).to.equal(20000);
  });

  it('keeps the last live duration after the playlist is unmounted', () => {
    const layout = create();
    const detach = layout.attachRenderedPlaylist(fakePlaylist(() => 37946));
    expect(layout.resolveDuration({})).to.equal(37946);
    detach();
    expect(layout.resolveDuration({})).to.equal(37946);
  });

  it('returns 0 without playlists', () => {
    expect(create().resolveDuration({})).to.equal(0);
  });
});

describe('Layout widget duration before rendering', () => {
  const globals = globalThis as any;
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
  const saved: Record<string, unknown> = {};
  let dom: any;
  let clock: SinonFakeTimers | undefined;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = key === 'window' ? dom.window : dom.window[key];
    });
    globals.document = dom.window.document;
  });

  afterEach(() => {
    clock?.restore();
    clock = undefined;
    keys.forEach((key) => {
      globals[key] = saved[key];
    });
  });

  const videoItem = (name: string, duration: number) => ({
    name,
    duration,
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
        video: { files: { poster: { uri: `https://media.test/${name}.mp4` } } },
      },
      data: {},
    },
  });

  // Mirrors the JSON of a "Layout Widget" item whose zones bind playlists
  // through the `layoutRef` option.
  const layoutItem = () => ({
    name: 'layout',
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
          layoutId: 2,
          aspectRatio: '16:9',
          zones: {
            zones: [
              { id: 'z1', rect: { x: 0, y: 0, width: 50, height: 100 } },
              { id: 'z2', rect: { x: 50, y: 0, width: 50, height: 100 } },
              { id: 'z3', rect: { x: 0, y: 0, width: 10, height: 10 } },
            ],
          },
          zonePlaylistMap: {
            z1: {
              playlistId: 1,
              playlist: {
                name: 'left',
                items: [videoItem('a', 20800), videoItem('b', 6976)],
              },
            },
            z2: {
              playlistId: 2,
              playlist: { name: 'right', items: [videoItem('c', 11979)] },
            },
            // A zone without a playlist must not break the resolution.
            z3: { playlistId: 3 },
          },
        },
      },
    },
  });

  const resources = {
    getMedia: async (url: string) => url,
    refreshMedia: async (url: string) => url,
  } as any;

  it('resolves layoutRef playlists so the layout duration is known up front', () => {
    const layer = Layer.fromJSON(layoutItem() as any, resources, {
      target: 'poster',
    });
    expect(layer.duration()).to.equal(27776);
  });

  it('reports an empty layout ready without waiting for media', () => {
    const item = layoutItem();
    item.config.options.layoutRef.zones.zones = [];
    const layer = Layer.fromJSON(item as any, resources, { target: 'poster' });
    const renderer = new Renderer(dom.window.document.getElementById('root'));
    let ready = false;
    const subscription = renderer.show(layer, 0).subscribe(() => {
      ready = true;
    });
    try {
      expect(ready).to.equal(true);
    } finally {
      subscription.unsubscribe();
      renderer.clear();
      layer.unload();
    }
  });

  it('only reports a layout ready after all populated zones initialize', async () => {
    clock = useFakeTimers({
      shouldClearNativeTimers: true,
      toFake: ['setTimeout', 'clearTimeout', 'Date'],
    });
    const item = layoutItem();
    item.config.options.layoutRef.zonePlaylistMap.z1.playlist.items = [
      videoItem('a', 0),
    ];
    item.config.options.layoutRef.zonePlaylistMap.z2.playlist.items = [
      videoItem('c', 0),
    ];
    let ready = false;
    const layer = Layer.fromJSON(item as any, resources, {
      target: 'poster',
      createVideoPlaybackController: (video: HTMLVideoElement) => {
        video.load = () => {
          setTimeout(
            () => {
              Object.defineProperty(video, 'duration', { value: 26 });
              Object.defineProperty(video, 'readyState', { value: 4 });
              const event = video.ownerDocument.createEvent('Event');
              event.initEvent('canplaythrough', false, false);
              video.dispatchEvent(event);
            },
            video.src.includes('/a.mp4') ? 100 : 700
          );
        };
        return {
          play: () => {},
          pause: () => {},
          seek: () => {},
          dispose: () => {},
        };
      },
    });
    const renderer = new Renderer(dom.window.document.getElementById('root'));
    const subscription = renderer.show(layer, 0).subscribe(() => {
      ready = true;
    });
    try {
      await clock.tickAsync(200);
      expect(ready).to.equal(false);
      await clock.tickAsync(500);
      expect(ready).to.equal(true);
      expect(layer.duration()).to.equal(26000);
    } finally {
      subscription.unsubscribe();
      renderer.clear();
      layer.unload();
    }
  });

  it('does not restart the layout videos after a 10s default duration', async () => {
    clock = useFakeTimers({
      now: 0,
      shouldClearNativeTimers: true,
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    });
    const plays: string[] = [];
    const name = (video: HTMLVideoElement) =>
      /\/(\w+)\.mp4$/.exec(video.src)![1];
    // Solid clones cached template nodes, which may belong to another test's
    // document, so the media behavior is stubbed per element.
    const globalsWithVideo = {
      target: 'poster' as const,
      createVideoPlaybackController: (video: HTMLVideoElement) => {
        video.load = () => {
          setTimeout(() => {
            const seconds = { a: 20.8, b: 6.976, c: 11.979 }[name(video)];
            Object.defineProperty(video, 'duration', { value: seconds });
            Object.defineProperty(video, 'readyState', { value: 4 });
            const event = video.ownerDocument.createEvent('Event');
            event.initEvent('canplaythrough', false, false);
            video.dispatchEvent(event);
          }, 500);
        };
        return {
          play: () => plays.push(name(video)),
          pause: () => {},
          seek: () => {},
          dispose: () => {},
        };
      },
    };

    // The device wraps each channel playlist in a layout layer.
    const queue = new Playlist('queue', resources);
    queue.add(
      Layer.fromPlaylist(
        { name: 'channel', items: [layoutItem()] } as any,
        resources,
        globalsWithVideo
      )
    );
    const player = new Player(
      queue,
      new Renderer(dom.window.document.getElementById('root'))
    );
    player.play({ loop: true });
    await clock.tickAsync(19000);
    player.stop();

    // Before the fix the layout was scheduled for 10s, so the player
    // restarted it and "a" played again at 10s.
    expect(plays.filter((name) => name === 'a')).to.have.length(1);
    expect(plays.filter((name) => name === 'b')).to.have.length(0);
  });

  it('waits for blocked nested playlist content before finite completion', async () => {
    clock = useFakeTimers({
      now: 0,
      shouldClearNativeTimers: true,
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'Date',
      ],
    });
    const block = {
      category: 'playback' as const,
      code: 'video-decoder-limit',
      error: new Error('blocked'),
    };
    let blocked = false;
    let finished = false;
    const globalsWithVideo = {
      target: 'poster' as const,
      createVideoPlaybackController: (
        video: HTMLVideoElement,
        context: { setBlocked?: (value?: typeof block) => void }
      ) => {
        video.load = () => {
          setTimeout(() => {
            Object.defineProperty(video, 'duration', { value: 10 });
            Object.defineProperty(video, 'readyState', { value: 4 });
            const event = video.ownerDocument.createEvent('Event');
            event.initEvent('canplaythrough', false, false);
            video.dispatchEvent(event);
          }, 500);
        };
        return {
          play: () => {
            if (blocked) return;
            blocked = true;
            context.setBlocked?.(block);
            setTimeout(() => context.setBlocked?.(), 15000);
          },
          pause: () => {},
          seek: () => {},
          dispose: () => {},
        };
      },
    };

    const queue = new Playlist('interruption', resources);
    queue.add(
      Layer.fromPlaylist(
        { name: 'channel', items: [videoItem('blocked', 10000)] } as any,
        resources,
        globalsWithVideo
      )
    );
    const player = new Player(
      queue,
      new Renderer(dom.window.document.getElementById('root'))
    );
    player.on('completed', () => (finished = true));

    try {
      player.play({ loop: false });
      await clock.tickAsync(12000);
      expect(finished).to.equal(false);

      await clock.tickAsync(14000);
      expect(finished).to.equal(true);
    } finally {
      player.stop();
    }
  });
});
