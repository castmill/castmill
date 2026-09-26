import { expect } from 'chai';
import { describe, it, afterEach } from 'mocha';
import { firstValueFrom, NEVER, of, Subscription } from 'rxjs';
import { spy, stub, restore } from 'sinon';

import {
  getImageBackgroundSize,
  Layer,
  Player,
  Playlist,
  playVideo,
  Renderer,
  timer,
  Widget,
} from '../dist/index.js';

describe('Layer aspect ratio sizing', () => {
  it('forwards layout layer errors through the global reporter', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const reportError = spy();
    const error = new Error('Nested widget failed');

    try {
      (globalThis as any).document = {
        createElement: () => ({ style: {}, dataset: {} }),
      };
      (globalThis as any).window = {};
      const layer = Layer.fromPlaylist(
        { name: 'layout', items: [] } as any,
        {} as any,
        { target: 'poster', reportError }
      );

      layer.emit('error', error);

      expect(
        reportError.calledOnceWithExactly({ category: 'playback', error })
      ).to.equal(true);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    }
  });

  it('falls back to window resize events when ResizeObserver is unavailable', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalResizeObserver = globalThis.ResizeObserver;
    const widgetStyle: Record<string, string> = {};
    let resizeListener: (() => void) | undefined;
    let removedListener: (() => void) | undefined;

    const layerElement = {
      style: {},
      dataset: {},
      firstElementChild: { style: widgetStyle },
      getBoundingClientRect: () => ({ width: 1920, height: 1080 }),
    };

    try {
      (globalThis as any).document = {
        createElement: () => layerElement,
      };
      (globalThis as any).window = {
        addEventListener: (_event: string, listener: () => void) => {
          resizeListener = listener;
        },
        removeEventListener: (_event: string, listener: () => void) => {
          removedListener = listener;
        },
      };
      (globalThis as any).ResizeObserver = undefined;

      const layer = new Layer('layout', { widgetAspectRatio: '1:1' });

      expect(resizeListener).to.be.a('function');
      expect(widgetStyle.width).to.equal('1080px');
      expect(widgetStyle.height).to.equal('1080px');

      layer.unload();
      expect(removedListener).to.equal(resizeListener);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
      (globalThis as any).ResizeObserver = originalResizeObserver;
    }
  });

  it('reattaches the resize fallback when a reused layer is shown again', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const originalResizeObserver = globalThis.ResizeObserver;
    const listeners: Array<() => void> = [];

    const layerElement = {
      style: {},
      dataset: {},
      firstElementChild: { style: {} },
      getBoundingClientRect: () => ({ width: 1920, height: 1080 }),
    };

    try {
      (globalThis as any).document = {
        createElement: () => layerElement,
      };
      (globalThis as any).window = {
        addEventListener: (_event: string, listener: () => void) => {
          listeners.push(listener);
        },
        removeEventListener: () => {},
      };
      (globalThis as any).ResizeObserver = undefined;

      const layer = new Layer('layout', { widgetAspectRatio: '1:1' });
      layer.unload();
      layer.show(0);

      expect(listeners).to.have.length(2);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
      (globalThis as any).ResizeObserver = originalResizeObserver;
    }
  });
});

describe('Playlist.seek', () => {
  it('should wrap an end-of-playlist offset to the first layer', async () => {
    const seek = spy((offset: number) => of([offset, 1000]));
    const playlist = new Playlist('test', {} as any);
    playlist.add({ duration: () => 1000, seek } as any);

    const [offset, duration] = await firstValueFrom(playlist.seek(1000));

    expect(offset).to.equal(0);
    expect(duration).to.equal(1000);
    expect(playlist.position).to.equal(0);
    expect(seek.calledOnceWithExactly(0)).to.equal(true);
  });
});

describe('Player.play', () => {
  it('should ignore redundant non-synced play calls while active', () => {
    const seek = spy((_: number) => NEVER);
    const play = spy((_: any, __: any, ___: any) => NEVER);

    const playlist = {
      time: 5300,
      seek,
      play,
      toggleDebug: () => {},
    } as any;

    const renderer = {
      toggleDebug: () => {},
      setViewport: () => {},
    } as any;

    const player = new Player(playlist, renderer);
    const stopSpy = spy(player, 'stop');

    player.timerSubscription = new Subscription();
    player.playing = new Subscription();

    player.play({ loop: true, synced: false });

    expect(stopSpy.called).to.equal(false);
    expect(seek.called).to.equal(false);
    expect(play.called).to.equal(false);

    player.timerSubscription.unsubscribe();
    player.playing.unsubscribe();
  });

  it('should allow synced play calls while active', () => {
    const seek = spy((_: number) => NEVER);
    const play = spy((_: any, __: any, ___: any) => NEVER);

    const playlist = {
      time: 5300,
      seek,
      play,
      toggleDebug: () => {},
    } as any;

    const renderer = {
      toggleDebug: () => {},
      setViewport: () => {},
    } as any;

    const player = new Player(playlist, renderer);
    const stopSpy = spy(player, 'stop');

    player.timerSubscription = new Subscription();
    player.playing = new Subscription();

    player.play({ loop: true, synced: true, baseline: 12345 });

    expect(stopSpy.calledOnce).to.equal(true);
    expect(seek.calledOnce).to.equal(true);
    expect(seek.firstCall.args[0]).to.equal(12345);
    expect(play.calledOnce).to.equal(true);

    player.stop();
  });
});

describe('Player.clear', () => {
  it('stops playback and clears the rendered layer', () => {
    const renderer = {
      clear: spy(),
      setViewport: () => {},
    } as any;
    const player = new Player({} as any, renderer);
    const stopSpy = spy(player, 'stop');

    player.clear();

    expect(stopSpy.calledOnce).to.equal(true);
    expect(renderer.clear.calledOnce).to.equal(true);
  });
});

describe('Template video playback', () => {
  it('reports rejected autoplay promises without leaving them unhandled', async () => {
    const rejection = new Error('User activation is required');
    const reports: unknown[] = [];
    const errorSpy = stub(console, 'error');
    const video = {
      play: () => Promise.reject(rejection),
    };

    try {
      playVideo(video, (report) => reports.push(report));
      await Promise.resolve();

      expect(
        errorSpy.calledWith('[Video] Failed to start playback', rejection)
      ).to.equal(true);
      expect(reports).to.deep.equal([
        {
          category: 'playback',
          code: 'video-play-rejected',
          error: rejection,
        },
      ]);
    } finally {
      errorSpy.restore();
    }
  });
});

describe('Widget messaging', () => {
  it('posts widget responses back to the parent origin from document.referrer', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const parent = { postMessage: spy() };
    let messageHandler: ((event: MessageEvent) => void) | undefined;

    try {
      (globalThis as any).document = {
        referrer: 'https://parent.example/dashboard',
      };
      (globalThis as any).window = {
        location: { origin: 'https://player.example' },
        parent,
        addEventListener: (
          _event: string,
          listener: (event: MessageEvent) => void
        ) => {
          messageHandler = listener;
        },
        removeEventListener: () => {},
      };

      class TestWidget extends Widget {}

      new TestWidget({} as any);

      messageHandler?.({
        data: JSON.stringify({ counter: 1, method: 'show', args: [] }),
        origin: 'https://parent.example',
        source: parent,
      } as unknown as MessageEvent);

      expect(parent.postMessage.calledOnce).to.equal(true);
      expect(parent.postMessage.firstCall.args[1]).to.equal(
        'https://parent.example'
      );
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    }
  });

  it('ignores widget messages from unexpected origins', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const parent = { postMessage: spy() };
    let messageHandler: ((event: MessageEvent) => void) | undefined;

    try {
      (globalThis as any).document = {
        referrer: 'https://parent.example/dashboard',
      };
      (globalThis as any).window = {
        location: { origin: 'https://player.example' },
        parent,
        addEventListener: (
          _event: string,
          listener: (event: MessageEvent) => void
        ) => {
          messageHandler = listener;
        },
        removeEventListener: () => {},
      };

      class TestWidget extends Widget {}

      new TestWidget({} as any);

      messageHandler?.({
        data: JSON.stringify({ counter: 1, method: 'show', args: [] }),
        origin: 'https://other.example',
        source: parent,
      } as unknown as MessageEvent);

      expect(parent.postMessage.called).to.equal(false);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    }
  });

  it('ignores widget messages that do not come from the parent window', () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const parent = { postMessage: spy() };
    const otherWindow = {};
    let messageHandler: ((event: MessageEvent) => void) | undefined;

    try {
      (globalThis as any).document = {
        referrer: 'https://parent.example/dashboard',
      };
      (globalThis as any).window = {
        location: { origin: 'https://player.example' },
        parent,
        addEventListener: (
          _event: string,
          listener: (event: MessageEvent) => void
        ) => {
          messageHandler = listener;
        },
        removeEventListener: () => {},
      };

      class TestWidget extends Widget {}

      new TestWidget({} as any);

      messageHandler?.({
        data: JSON.stringify({ counter: 1, method: 'show', args: [] }),
        origin: 'https://parent.example',
        source: otherWindow,
      } as unknown as MessageEvent);

      expect(parent.postMessage.called).to.equal(false);
    } finally {
      (globalThis as any).document = originalDocument;
      (globalThis as any).window = originalWindow;
    }
  });
});

describe('Renderer.clear', () => {
  it('unloads and removes the current layer', () => {
    const removeChild = spy();
    const unload = spy();
    const reset = spy();
    const renderer = new Renderer({} as HTMLElement);
    const layer = {
      el: { parentElement: { removeChild } },
      unload,
    };

    (renderer as any).currentLayer = layer;
    (renderer as any).currentTransition = { reset };

    renderer.clear();

    expect(reset.calledOnce).to.equal(true);
    expect(unload.calledOnce).to.equal(true);
    expect(removeChild.calledOnceWithExactly(layer.el)).to.equal(true);
    expect((renderer as any).currentLayer).to.equal(undefined);
    expect((renderer as any).currentTransition).to.equal(undefined);
  });

  it('also unloads and removes a pending layer', () => {
    const currentRemoveChild = spy();
    const pendingRemoveChild = spy();
    const currentLayer = {
      el: { parentElement: { removeChild: currentRemoveChild } },
      unload: spy(),
    };
    const pendingLayer = {
      el: { parentElement: { removeChild: pendingRemoveChild } },
      unload: spy(),
    };
    const renderer = new Renderer({} as HTMLElement);

    (renderer as any).currentLayer = currentLayer;
    (renderer as any).pendingLayer = pendingLayer;

    renderer.clear();

    expect(currentLayer.unload.calledOnce).to.equal(true);
    expect(pendingLayer.unload.calledOnce).to.equal(true);
    expect(currentRemoveChild.calledOnceWithExactly(currentLayer.el)).to.equal(
      true
    );
    expect(pendingRemoveChild.calledOnceWithExactly(pendingLayer.el)).to.equal(
      true
    );
    expect((renderer as any).pendingLayer).to.equal(undefined);
  });

  it('unloads the previous pending layer before replacing it', () => {
    const firstRemoveChild = spy();
    const secondRemoveChild = spy();
    const appendChild = spy();
    const firstPendingLayer = {
      el: { style: {}, parentElement: { removeChild: firstRemoveChild } },
      unload: spy(),
      show: () => NEVER,
    };
    const secondPendingLayer = {
      el: { style: {}, parentElement: { removeChild: secondRemoveChild } },
      unload: spy(),
      show: () => NEVER,
    };
    const renderer = new Renderer({ appendChild } as any);

    renderer.show(firstPendingLayer as any, 0);
    renderer.show(secondPendingLayer as any, 0);

    expect(firstPendingLayer.unload.calledOnce).to.equal(true);
    expect(
      firstRemoveChild.calledOnceWithExactly(firstPendingLayer.el)
    ).to.equal(true);
    expect(secondPendingLayer.unload.called).to.equal(false);
    expect(secondRemoveChild.called).to.equal(false);
    expect(appendChild.calledTwice).to.equal(true);
    expect((renderer as any).pendingLayer).to.equal(secondPendingLayer);
  });

  it('clears a stale pending layer when showing the current layer again', async () => {
    const pendingRemoveChild = spy();
    const currentLayer = {
      el: { style: {}, parentElement: { removeChild: spy() } },
      unload: spy(),
    };
    const pendingLayer = {
      el: { style: {}, parentElement: { removeChild: pendingRemoveChild } },
      unload: spy(),
      show: () => NEVER,
    };
    const renderer = new Renderer({ appendChild: spy() } as any);

    (renderer as any).currentLayer = currentLayer;
    (renderer as any).pendingLayer = pendingLayer;

    await firstValueFrom(renderer.show(currentLayer as any, 0));

    expect(pendingLayer.unload.calledOnce).to.equal(true);
    expect(pendingRemoveChild.calledOnceWithExactly(pendingLayer.el)).to.equal(
      true
    );
    expect((renderer as any).pendingLayer).to.equal(undefined);
  });
});

describe('Image autozoom', () => {
  it('uses contain for serialized false and cover for serialized true', () => {
    expect(getImageBackgroundSize({ autozoom: 'false' })).to.equal('contain');
    expect(getImageBackgroundSize({ autozoom: 'true' })).to.equal('cover');
  });
});

describe('timer', () => {
  afterEach(() => restore());
  it('should keep a stable interval after delayed callbacks', () => {
    let now = 0;
    const delays: number[] = [];
    let scheduled: (() => void) | undefined;

    stub(Date, 'now').callsFake(() => now);
    stub(globalThis, 'setTimeout').callsFake(((
      fn: () => void,
      delay?: number
    ) => {
      delays.push((delay ?? 0) as number);
      scheduled = fn;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    }) as any);
    stub(globalThis, 'clearTimeout').callsFake((() => {}) as any);

    const values: number[] = [];
    const sub = timer(0, 0, 100, 1000).subscribe((value) => {
      values.push(value);
    });

    // First scheduling is always the configured interval.
    expect(delays[0]).to.equal(100);
    expect(values[0]).to.equal(0);

    // Simulate callback being delayed for a long background period.
    now = 10_000;
    scheduled?.();

    // Timer should not try to "catch up" by scheduling immediate callbacks.
    expect(delays[1]).to.equal(100);
    expect(values[1]).to.equal(0);

    sub.unsubscribe();
    restore();
  });
});
