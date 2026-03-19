import { expect } from 'chai';
import { describe, it } from 'mocha';
import { NEVER, Subscription } from 'rxjs';
import { spy, stub, restore } from 'sinon';

import { Player, timer } from '../src/player';

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

describe('timer', () => {
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
