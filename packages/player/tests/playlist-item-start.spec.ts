import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { Observable, Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SinonFakeTimers, useFakeTimers } from 'sinon';

import { Layer, Playlist, Renderer } from '../dist/index.js';

const TICK_MS = 100;

const fakeLayer = (name: string, duration: number) => ({
  name,
  duration: () => duration,
  blocked$: () => new Subject<undefined>(),
  reportError: () => undefined,
  debugInfo: {},
});

describe('Playlist item start notifications', () => {
  let clock: SinonFakeTimers;
  let timer$: Subject<number>;
  let value: number;
  let subscription: Subscription | undefined;
  const renderer = {
    play: (_layer: unknown, layerTimer$: Observable<number>) =>
      layerTimer$.pipe(tap(() => undefined)),
    blank: () => undefined,
  } as unknown as Renderer;

  beforeEach(() => {
    clock = useFakeTimers({ now: 0 });
    timer$ = new Subject<number>();
    value = 0;
  });

  afterEach(() => {
    subscription?.unsubscribe();
    clock.restore();
  });

  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
      clock.tick(TICK_MS);
      value += TICK_MS;
      timer$.next(value);
    }
  };

  const create = (onItemStart: (info: unknown) => void) => {
    const playlist = Playlist.fromJSON(
      { id: 7, name: 'channel', status: 'live', items: [] },
      {} as any,
      { target: 'poster', onItemStart }
    );
    [fakeLayer('a', 2000), fakeLayer('b', 2000), fakeLayer('c', 2000)].forEach(
      (layer) => playlist.add(layer as unknown as Layer)
    );
    return playlist;
  };

  it('reports each item as it starts, with the playlist id', () => {
    const starts: unknown[] = [];
    const playlist = create((info) => starts.push(info));
    subscription = playlist.play(renderer, timer$, { loop: true }).subscribe();
    timer$.next(value);

    expect(starts).to.deep.equal([{ playlistId: 7, index: 0, count: 3 }]);
    run(2000);
    expect(starts[1]).to.deep.equal({ playlistId: 7, index: 1, count: 3 });
    run(4000);
    expect(starts.map((start: any) => start.index)).to.deep.equal([0, 1, 2, 0]);
  });

  it('keeps playing when the callback throws', () => {
    let calls = 0;
    const playlist = create(() => {
      calls++;
      throw new Error('host failure');
    });
    subscription = playlist.play(renderer, timer$, { loop: true }).subscribe();
    timer$.next(value);
    run(4000);
    expect(calls).to.equal(3);
  });
});
