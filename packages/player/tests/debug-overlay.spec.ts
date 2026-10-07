import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { Subject, of } from 'rxjs';
import { spy } from 'sinon';

import {
  DebugOverlay,
  describeDebugPlaylist,
  describeDebugSection,
  enableDebugOverlayFromEnv,
  isDebugOverlayEnabled,
  onDebugOverlayChange,
  Playlist,
  setDebugOverlay,
  toggleDebugOverlay,
} from '../dist/index.js';

const state = {
  index: 1,
  count: 3,
  elapsed: 4200,
  current: {
    name: 'Clip 2',
    widget: 'Video',
    type: 'video',
    media: 'clip-2.mp4',
    duration: 10000,
    itemDuration: 13967,
  },
  next: {
    name: 'Clip 3',
    widget: 'Image',
    type: 'image',
    duration: 5000,
    itemDuration: 5000,
  },
};

describe('Debug overlay', () => {
  let dom: any;
  const globals = globalThis as any;
  const originalDocument = globals.document;
  const originalWindow = globals.window;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    globals.window = dom.window;
    globals.document = dom.window.document;
    setDebugOverlay(false);
  });

  afterEach(() => {
    setDebugOverlay(false);
    globals.document = originalDocument;
    globals.window = originalWindow;
  });

  it('describes the current item, progress, countdown, and next item', () => {
    expect(describeDebugSection('Item', state)).to.deep.equal({
      title: 'Item 2/3 Video · video "Clip 2" 10.0s (item 14.0s)',
      media: 'media: clip-2.mp4',
      progress: 0.42,
      countdown: '5.8s',
      next: 'Next: Image · image "Clip 3" 5.0s',
      nextMedia: undefined,
    });
    expect(
      describeDebugSection('Item', {
        ...state,
        next: { ...state.next, media: 'clip-3.jpg' },
      })
    ).to.deep.include({
      next: 'Next: Image · image "Clip 3" 5.0s',
      nextMedia: 'media: clip-3.jpg',
    });
  });

  it('omits repeated kinds and unknown next items, and clamps progress', () => {
    expect(
      describeDebugSection('Playlist', {
        index: 0,
        count: 1,
        elapsed: 10500,
        current: {
          name: 'Layout',
          widget: 'layout',
          type: 'layout',
          duration: 10000,
        },
      })
    ).to.deep.equal({
      title: 'Playlist 1/1 layout "Layout" 10.0s',
      media: undefined,
      progress: 1,
      countdown: '0.0s',
      next: undefined,
      nextMedia: undefined,
    });
  });

  it('toggles the shared flag and notifies listeners', () => {
    const listener = spy();
    const stop = onDebugOverlayChange(listener);
    expect(toggleDebugOverlay()).to.equal(true);
    expect(isDebugOverlayEnabled()).to.equal(true);
    expect(dom.window.__castmillDebugOverlay.enabled).to.equal(true);
    setDebugOverlay(false);
    stop();
    setDebugOverlay(true);
    expect(listener.args).to.deep.equal([[true], [false]]);
  });

  it('enables the overlay from a build-time flag', () => {
    [undefined, '', 'false', '0', 'yes', true].forEach((value) => {
      enableDebugOverlayFromEnv(value);
      expect(isDebugOverlayEnabled()).to.equal(false);
    });
    enableDebugOverlayFromEnv('true');
    expect(isDebugOverlayEnabled()).to.equal(true);
    setDebugOverlay(false);
    enableDebugOverlayFromEnv(' 1 ');
    expect(isDebugOverlayEnabled()).to.equal(true);
  });

  it('keeps an enabled overlay when the build-time flag is unset', () => {
    setDebugOverlay(true);
    enableDebugOverlayFromEnv(undefined);
    expect(isDebugOverlayEnabled()).to.equal(true);
  });

  it('renders progress bars in the upper right corner only while enabled', () => {
    const root = dom.window.document.getElementById('root')!;
    const overlay = new DebugOverlay(root);

    overlay.update(state);
    expect(root.children.length).to.equal(0);

    setDebugOverlay(true);
    overlay.update(state);
    const el = root.lastElementChild as HTMLElement;
    expect(el.hasAttribute('data-castmill-debug-overlay')).to.equal(true);
    expect(el.style.position).to.equal('absolute');
    expect(el.style.top).to.equal('0.5em');
    expect(el.style.right).to.equal('0.5em');
    expect(el.style.pointerEvents).to.equal('none');
    expect(el.style.width).to.equal('21em');
    expect(el.style.fontSize).to.equal('12px');
    expect(el.children.length).to.equal(1);
    expect(el.textContent).to.contain('Item 2/3 Video · video "Clip 2"');
    expect(el.textContent).to.contain('media: clip-2.mp4');
    expect(el.textContent).to.contain('5.8s');
    expect(el.textContent).to.contain('Next: Image · image "Clip 3"');
    const fill = el.querySelector('div[style*="height: 100%"]') as HTMLElement;
    expect(fill.style.width).to.equal('42%');

    setDebugOverlay(false);
    expect(el.style.display).to.equal('none');
    setDebugOverlay(true);
    overlay.update({ ...state, elapsed: 5000 });
    expect(el.style.display).to.equal('block');
    expect(fill.style.width).to.equal('50%');
    expect(el.textContent).to.contain('5.0s');

    overlay.remove();
    expect(root.children.length).to.equal(0);
  });

  it('describes the playlist with its progress and countdown', () => {
    expect(
      describeDebugPlaylist({ name: 'Zone', elapsed: 9000, duration: 36000 }, 3)
    ).to.deep.equal({
      title: 'Playlist "Zone" 3 items 36.0s',
      progress: 0.25,
      countdown: '27.0s',
    });
    expect(
      describeDebugPlaylist({ name: 'undefined', elapsed: 0, duration: 0 }, 1)
        .title
    ).to.equal('Playlist 1 item 0.0s');
  });

  it('omits unknown item names', () => {
    expect(
      describeDebugSection('Item', {
        ...state,
        current: { ...state.current, name: 'undefined' },
        next: undefined,
      }).title
    ).to.equal('Item 2/3 Video · video 10.0s (item 14.0s)');
  });

  it('shows only the area playlist and its item in a layout area', () => {
    const document = dom.window.document;
    const root = document.getElementById('root')!;
    const area = document.createElement('div');
    root.appendChild(area);
    const outer = new DebugOverlay(root);
    const inner = new DebugOverlay(area);
    setDebugOverlay(true);

    const layoutState = {
      index: 0,
      count: 2,
      elapsed: 9000,
      current: {
        name: 'Channel',
        widget: 'playlist',
        type: 'layout',
        duration: 36000,
      },
      playlist: { name: 'content-queue', elapsed: 9000, duration: 72000 },
    };
    outer.update(layoutState);
    const outerEl = root.lastElementChild as HTMLElement;
    expect(outerEl.style.display).to.equal('block');

    inner.update({
      ...state,
      playlist: { name: 'Zone', elapsed: 14200, duration: 27000 },
    });
    const innerEl = area.lastElementChild as HTMLElement;
    expect(outerEl.style.display).to.equal('none');
    expect(innerEl.children.length).to.equal(2);
    const [playlistSection, itemSection] = [
      innerEl.children[0] as HTMLElement,
      innerEl.children[1] as HTMLElement,
    ];
    expect(playlistSection.textContent).to.equal(
      'Playlist "Zone" 3 items 27.0s12.8s'
    );
    expect(itemSection.textContent).to.contain('Item 2/3');
    expect(innerEl.textContent).not.to.contain('Channel');
    expect(innerEl.textContent).not.to.contain('content-queue');

    // The outer overlay stays hidden while an area shows its own.
    outer.update({ ...layoutState, elapsed: 10000 });
    expect(outerEl.style.display).to.equal('none');

    // Once the layout is gone the outer overlay shows itself again.
    root.removeChild(area);
    outer.update(layoutState);
    expect(outerEl.style.display).to.equal('block');
    expect(outerEl.children.length).to.equal(2);
    expect(outerEl.textContent).to.contain('Playlist "content-queue"');
  });

  it('reports the playing item and the next one for every playlist tick', () => {
    const layer = (name: string, duration: number, type: string) => ({
      name,
      duration: () => duration,
      debugInfo: { widget: type, type },
      blocked$: () => of(undefined),
    });
    const playlist = new Playlist('test', {} as any);
    playlist.add(layer('A', 1000, 'image') as any);
    playlist.add(layer('B', 2000, 'layout') as any);

    const update = spy();
    const hide = spy();
    const renderer = {
      debugOverlay: { update, hide },
      play: (_layer: unknown, timer$: Subject<number>) => timer$,
    };
    const timer$ = new Subject<number>();
    setDebugOverlay(true);
    const subscription = playlist
      .play(renderer as any, timer$, { loop: true })
      .subscribe();

    timer$.next(400);
    // The tick that ends a slot completes it; the next slot starts after it.
    timer$.next(1500);
    timer$.next(1600);
    timer$.next(2999);
    subscription.unsubscribe();

    expect(
      update.args.map(([info]) => [
        info.index,
        info.elapsed,
        info.current.name,
        info.next?.name,
        info.playlist,
      ])
    ).to.deep.equal([
      [0, 400, 'A', 'B', { name: 'test', elapsed: 400, duration: 3000 }],
      [1, 600, 'B', 'A', { name: 'test', elapsed: 1600, duration: 3000 }],
      [1, 1999, 'B', 'A', { name: 'test', elapsed: 2999, duration: 3000 }],
    ]);
    expect(update.firstCall.args[0].current).to.deep.include({
      duration: 1000,
      itemDuration: 1000,
      type: 'image',
    });
    expect(hide.called).to.equal(false);
  });

  it('hides the overlay instead of updating it while disabled', () => {
    const playlist = new Playlist('test', {} as any);
    playlist.add({
      name: 'A',
      duration: () => 1000,
      debugInfo: {},
      blocked$: () => of(undefined),
    } as any);
    const update = spy();
    const hide = spy();
    const timer$ = new Subject<number>();
    const subscription = playlist
      .play(
        {
          debugOverlay: { update, hide },
          play: (_: unknown, t: any) => t,
        } as any,
        timer$
      )
      .subscribe();
    timer$.next(100);
    subscription.unsubscribe();
    expect(update.called).to.equal(false);
    expect(hide.calledOnce).to.equal(true);
  });
});
