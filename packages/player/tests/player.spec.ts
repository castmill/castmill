import { expect } from 'chai';
import { describe, it } from 'mocha';
import { NEVER, Subscription } from 'rxjs';
import { spy } from 'sinon';

import { Player } from '../src/player';

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
