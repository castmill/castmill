import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  firstValueFrom,
} from 'rxjs';
import { filter, switchMap, take, tap } from 'rxjs/operators';
import { SinonFakeTimers, spy, useFakeTimers } from 'sinon';

import {
  BLOCKED_ITEM_SKIP_MS,
  Layer,
  Playlist,
  Renderer,
  TemplateWidget,
} from '../dist/index.js';

const TICK_MS = 100;
const BLOCK = {
  category: 'playback' as const,
  code: 'video-decoder-limit',
  error: new Error('blocked'),
};

interface FakeLayer {
  name: string;
  blocked: BehaviorSubject<typeof BLOCK | undefined>;
  reportError: ReturnType<typeof spy>;
  duration: () => number;
  blocked$: () => Observable<typeof BLOCK | undefined>;
  debugInfo: {};
}

const fakeLayer = (name: string, duration: number): FakeLayer => {
  const blocked = new BehaviorSubject<typeof BLOCK | undefined>(undefined);
  return {
    name,
    blocked,
    reportError: spy(),
    duration: () => duration,
    blocked$: () => blocked,
    debugInfo: {},
  };
};

interface Played {
  name: string;
  at: number;
  elapsed: number[];
}

describe('Playlist skipping of blocked items', () => {
  let clock: SinonFakeTimers;
  let timer$: Subject<number>;
  let value: number;
  let played: Played[];
  let blank: ReturnType<typeof spy>;
  let renderer: Renderer;
  let subscription: Subscription | undefined;

  beforeEach(() => {
    clock = useFakeTimers({ now: 0 });
    timer$ = new Subject<number>();
    value = 0;
    played = [];
    blank = spy();
    // Like the real renderer, a blocked layer is not shown before it can
    // play; it then plays for as long as its timer runs.
    renderer = {
      play: (layer: FakeLayer, layerTimer$: Observable<number>) =>
        layer.blocked.pipe(
          filter((block) => !block),
          take(1),
          switchMap(() => {
            const entry: Played = {
              name: layer.name,
              at: Date.now(),
              elapsed: [],
            };
            played.push(entry);
            return layerTimer$.pipe(
              tap((elapsed) => entry.elapsed.push(elapsed))
            );
          })
        ),
      blank,
    } as unknown as Renderer;
  });

  afterEach(() => {
    subscription?.unsubscribe();
    subscription = undefined;
    clock.restore();
  });

  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
      clock.tick(TICK_MS);
      value += TICK_MS;
      timer$.next(value);
    }
  };

  const start = (layers: FakeLayer[]) => {
    const playlist = new Playlist('zone', {} as any);
    layers.forEach((layer) => playlist.add(layer as unknown as Layer));
    subscription = playlist.play(renderer, timer$, { loop: true }).subscribe();
    timer$.next(value);
    return playlist;
  };

  const names = () => played.map((entry) => entry.name);

  it('skips an item blocked for the skip delay and starts the next at once', () => {
    const a = fakeLayer('a', 5000);
    const b = fakeLayer('b', 3000);
    a.blocked.next(BLOCK);
    start([a, b]);

    run(BLOCKED_ITEM_SKIP_MS - TICK_MS);
    expect(played).to.deep.equal([]);
    expect(a.reportError.called).to.equal(false);

    run(TICK_MS);
    expect(a.reportError.calledOnceWithExactly(BLOCK)).to.equal(true);
    expect(names()).to.deep.equal(['b']);
    expect(played[0].at).to.equal(BLOCKED_ITEM_SKIP_MS);

    // The next item keeps its full slot.
    run(3000);
    expect(played[0].elapsed[0]).to.be.at.most(TICK_MS);
    expect(played[0].elapsed[played[0].elapsed.length - 1]).to.be.at.least(
      3000 - TICK_MS
    );
    expect(blank.called).to.equal(false);
  });

  it('tries a skipped item again on its next turn', () => {
    const a = fakeLayer('a', 2000);
    const b = fakeLayer('b', 2000);
    a.blocked.next(BLOCK);
    start([a, b]);

    run(BLOCKED_ITEM_SKIP_MS + 2000);
    expect(names()).to.deep.equal(['b']);
    // a is blocked again: another report and skip, but no empty zone since b
    // could play in between.
    run(BLOCKED_ITEM_SKIP_MS);
    expect(a.reportError.callCount).to.equal(2);
    expect(names()).to.deep.equal(['b', 'b']);
    expect(blank.called).to.equal(false);

    a.blocked.next(undefined);
    run(2000);
    expect(names()).to.deep.equal(['b', 'b', 'a']);
  });

  it('holds the clock while an item is briefly blocked instead of skipping', () => {
    const a = fakeLayer('a', 3000);
    const b = fakeLayer('b', 3000);
    a.blocked.next(BLOCK);
    start([a, b]);

    run(BLOCKED_ITEM_SKIP_MS / 2);
    a.blocked.next(undefined);
    run(3000 - TICK_MS);

    expect(a.reportError.called).to.equal(false);
    expect(names()).to.deep.equal(['a']);
    expect(played[0].elapsed[0]).to.be.at.most(TICK_MS);
    expect(played[0].elapsed[played[0].elapsed.length - 1]).to.be.at.least(
      3000 - 2 * TICK_MS
    );
    run(2 * TICK_MS);
    expect(names()).to.deep.equal(['a', 'b']);
  });

  it('only starts the skip delay once a preloading item becomes current', () => {
    const a = fakeLayer('a', 3000);
    const b = fakeLayer('b', 3000);
    start([a, b]);
    b.blocked.next(BLOCK);

    run(3000);
    expect(b.reportError.called).to.equal(false);
    run(BLOCKED_ITEM_SKIP_MS - TICK_MS);
    expect(b.reportError.called).to.equal(false);
    run(TICK_MS);
    expect(b.reportError.calledOnce).to.equal(true);
    expect(names()).to.deep.equal(['a', 'a']);
  });

  it('waits with an empty area when every item is blocked', () => {
    const a = fakeLayer('a', 3000);
    const b = fakeLayer('b', 3000);
    a.blocked.next(BLOCK);
    b.blocked.next(BLOCK);
    start([a, b]);

    run(2 * BLOCKED_ITEM_SKIP_MS);
    expect(a.reportError.calledOnce).to.equal(true);
    expect(b.reportError.calledOnce).to.equal(true);
    expect(blank.calledOnceWithExactly(b)).to.equal(true);

    // No more skipping back and forth while waiting.
    run(10_000);
    expect(a.reportError.calledOnce).to.equal(true);
    expect(b.reportError.calledOnce).to.equal(true);
    expect(played).to.deep.equal([]);

    // The waiting item plays from its beginning, for its full slot.
    b.blocked.next(undefined);
    run(3000);
    expect(names()).to.deep.equal(['b']);
    expect(played[0].elapsed[0]).to.be.at.most(TICK_MS);
    expect(played[0].elapsed[played[0].elapsed.length - 1]).to.be.at.least(
      3000 - TICK_MS
    );
  });

  it('waits for a single blocked item without skipping it', () => {
    const a = fakeLayer('a', 3000);
    a.blocked.next(BLOCK);
    start([a]);

    run(5 * BLOCKED_ITEM_SKIP_MS);
    expect(a.reportError.calledOnce).to.equal(true);
    expect(blank.calledOnceWithExactly(a)).to.equal(true);

    a.blocked.next(undefined);
    run(TICK_MS);
    expect(names()).to.deep.equal(['a']);
    expect(played[0].elapsed[0]).to.be.at.most(TICK_MS);
  });

  it('keeps the start offset of an item blocked before the first tick', () => {
    const a = fakeLayer('a', 5000);
    const b = fakeLayer('b', 5000);
    b.blocked.next(BLOCK);
    const playlist = new Playlist('zone', {} as any);
    [a, b].forEach((layer) => playlist.add(layer as unknown as Layer));
    playlist.time = 7000;
    value = 7000;
    subscription = playlist.play(renderer, timer$, { loop: true }).subscribe();
    timer$.next(value);

    run(3 * TICK_MS);
    b.blocked.next(undefined);
    run(3 * TICK_MS);

    expect(names()).to.deep.equal(['b']);
    expect(played[0].elapsed[0]).to.be.at.least(2000);
    expect(playlist.time).to.be.at.least(7000);
  });

  it('restarts from the original schedule on a new play call', () => {
    const a = fakeLayer('a', 3000);
    const b = fakeLayer('b', 3000);
    a.blocked.next(BLOCK);
    const playlist = start([a, b]);
    run(BLOCKED_ITEM_SKIP_MS + TICK_MS);
    expect(names()).to.deep.equal(['b']);

    subscription!.unsubscribe();
    a.blocked.next(undefined);
    playlist.time = 0;
    value = 0;
    subscription = playlist.play(renderer, timer$, { loop: true }).subscribe();
    timer$.next(value);
    run(TICK_MS);

    expect(names()).to.deep.equal(['b', 'a']);
    expect(played[1].elapsed[0]).to.be.at.most(TICK_MS);
  });
});

describe('Playlist.show of a blocked item', () => {
  it('completes so that playback can skip the item', async () => {
    const layer = fakeLayer('a', 3000);
    const playlist = new Playlist('zone', {} as any);
    playlist.add(layer as unknown as Layer);
    const renderer = {
      show: () => new Subject<string>(),
    } as unknown as Renderer;

    const shown = firstValueFrom(playlist.show(renderer));
    layer.blocked.next(BLOCK);

    expect(await shown).to.equal('layer:show:blocked');
  });
});

describe('Renderer.blank', () => {
  it('removes the visible layer unless it is the kept one', () => {
    const removeChild = spy();
    const unload = spy();
    const renderer = new Renderer({} as HTMLElement);
    const layer = { el: { parentElement: { removeChild } }, unload };
    (renderer as any).currentLayer = layer;

    renderer.blank(layer as unknown as Layer);
    expect(unload.called).to.equal(false);

    renderer.blank();
    expect(unload.calledOnce).to.equal(true);
    expect(removeChild.calledOnceWithExactly(layer.el)).to.equal(true);
    expect(renderer.getCurrentLayer()).to.equal(undefined);
  });
});

describe('TemplateWidget blocked state', () => {
  const globals = globalThis as any;
  const saved: Record<string, unknown> = {};
  const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
  let dom: any;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = key === 'window' ? dom.window : dom.window[key];
    });
    globals.document = dom.window.document;
    dom.window.HTMLMediaElement.prototype.load = () => {};
  });

  afterEach(() => {
    keys.forEach((key) => {
      globals[key] = saved[key];
    });
  });

  it('marks the layer blocked while one of its videos is blocked', async () => {
    let setBlocked: ((block?: typeof BLOCK) => void) | undefined;
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'video',
          template: {
            type: 'video',
            name: 'video',
            opts: { url: 'https://example.com/clip.mp4' },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: {
          target: 'poster',
          createVideoPlaybackController: (_video: unknown, context: any) => {
            setBlocked = context.setBlocked;
            return {
              seek() {},
              play() {},
              pause() {},
              dispose() {},
              whenLoadable: () => new Promise<void>(() => {}),
            };
          },
        },
      }
    );
    const layer = new Layer('video', { widget });
    const states: unknown[] = [];
    layer.blocked$().subscribe((block) => states.push(block));

    widget.show(dom.window.document.getElementById('root'), 0).subscribe();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(setBlocked).to.be.a('function');

    setBlocked!(BLOCK);
    setBlocked!(BLOCK);
    setBlocked!();
    expect(states).to.deep.equal([undefined, BLOCK, undefined]);
  });
});
