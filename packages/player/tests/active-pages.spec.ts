import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom, NEVER } from 'rxjs';
import { useFakeTimers } from 'sinon';
import { TemplateWidget, tickClock } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('active-only paginated lists', () => {
  const globals = globalThis as any;
  const saved: Record<string, unknown> = {};
  const keys = [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'Element',
    'MutationObserver',
    'ResizeObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
  ];
  let dom: any;
  let widget: TemplateWidget | undefined;
  let clock: ReturnType<typeof useFakeTimers> | undefined;
  let loaded = 0;
  let peak = 0;
  let originalNow: (() => number) | undefined;
  const plays: number[] = [];

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>', {
      pretendToBeVisual: true,
    });
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = key === 'window' ? dom.window : dom.window[key];
    });
    globals.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
      dom.window
    );
    globals.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
      dom.window
    );
    loaded = peak = 0;
    plays.length = 0;
  });

  afterEach(async () => {
    widget?.stop();
    await widget?.unload();
    widget = undefined;
    if (originalNow) {
      Date.now = originalNow;
      originalNow = undefined;
    }
    clock?.restore();
    clock = undefined;
    dom.window.close();
    keys.forEach((key) => {
      globals[key] = saved[key];
    });
  });

  async function show(
    entries: unknown[],
    options: Record<string, unknown> = {},
    getMedia: (url: string) => Promise<string> = async (url) => url,
    textAnimations?: any[],
    withPlaybackController = true,
    configureVideo?: (video: HTMLVideoElement) => void
  ) {
    widget = new TemplateWidget({ getMedia } as any, {
      widget: {
        name: 'posts',
        template: {
          type: 'paginated-list',
          name: 'posts',
          opts: {
            activeOnly: true,
            pageSize: 1,
            pageDuration: 5,
            items: { key: 'data.entries', default: [] },
            ...options,
          },
          style: { width: '100%', height: '100%' },
          component: {
            type: 'group',
            name: 'post',
            components: [
              {
                type: 'text',
                name: 'message',
                opts: { text: { key: '$.message' } },
                animations: textAnimations,
              },
              {
                type: 'video',
                name: 'clip',
                when: { key: '$.video' },
                opts: {
                  url: { key: '$.video' },
                  size: 'contain',
                  muted: true,
                  loop: true,
                },
              },
            ],
          },
        },
      } as any,
      config: { options: {}, data: { entries } } as any,
      globals: {
        target: 'poster',
        createVideoPlaybackController: (video: HTMLVideoElement) => {
          Object.defineProperty(video, 'readyState', { get: () => 4 });
          Object.defineProperty(video, 'duration', { get: () => 2 });
          if (!withPlaybackController) {
            configureVideo?.(video);
            return undefined as any;
          }
          peak = Math.max(peak, ++loaded);
          return {
            play: (offset: number) => plays.push(offset),
            pause: () => {},
            seek: () => {},
            dispose: () => {
              loaded--;
            },
          };
        },
      },
    });
    await firstValueFrom(
      widget.show(dom.window.document.getElementById('root'), 0)
    );
    await flush();
    return widget;
  }

  const text = () =>
    dom.window.document.querySelector('[data-name="message"]')?.textContent;
  const posts = Array.from({ length: 10 }, (_, i) => ({
    message: `Post ${i}`,
    video: `https://example.test/${i}.mp4`,
  }));

  it('mounts one video out of ten and reports a finite full-cycle duration', async () => {
    const current = await show(posts);
    expect(text()).to.equal('Post 0');
    expect(dom.window.document.querySelectorAll('video')).to.have.length(1);
    expect(loaded).to.equal(1);
    expect(dom.window.document.querySelector('video').muted).to.equal(true);
    expect(dom.window.document.querySelector('video').loop).to.equal(true);
    expect(current.duration()).to.equal(50000);
  });

  it('seeks to the correct page and local video offset, and disposes the previous decoder', async () => {
    const current = await show(posts);
    current.seek(17000);
    await flush();
    expect(text()).to.equal('Post 3');
    current.play(NEVER);
    await flush();
    expect(plays[plays.length - 1]).to.be.within(0, 100);
    expect(peak).to.equal(1);
    current.stop();
    current.seek(11000);
    await flush();
    current.play(NEVER);
    await flush();
    expect(text()).to.equal('Post 2');
    expect(plays[plays.length - 1]).to.be.within(1000, 1100);
    expect(peak).to.equal(1);
  });

  it('keeps pages mounted when a clock-dependent list resolves to the same items', async () => {
    let now = new Date(2026, 0, 1, 10, 0).getTime();
    originalNow = Date.now;
    Date.now = () => now;
    tickClock();
    const current = await show(
      posts.map((post) => ({ ...post, end: '2099-12-31T23:59:00' })),
      {
        items: {
          list: {
            key: 'data.entries',
            where: [{ key: '$.end', gte: '@now' }],
          },
        },
      }
    );
    const video = dom.window.document.querySelector('video');
    now += 60_000;
    tickClock();
    await flush();
    expect(dom.window.document.querySelector('video')).to.equal(video);
    expect(loaded).to.equal(1);
    expect(peak).to.equal(1);
    expect(text()).to.equal('Post 0');
    current.stop();
  });

  it('preserves local elapsed time for pages with repeating children', async () => {
    const current = await show(
      posts.slice(0, 1),
      { pageDuration: 10 },
      undefined,
      [
        {
          init: { repeat: -1 },
          keyframes: [{ to: { x: 1, duration: 3 } }],
        },
      ]
    );
    current.seek(5000);
    current.play(NEVER);
    await flush();
    expect(plays[plays.length - 1]).to.be.within(1000, 1100);
  });

  it('releases the outgoing video source when no playback controller exists', async () => {
    const calls: string[] = [];
    const current = await show(
      posts.slice(0, 2),
      {},
      undefined,
      undefined,
      false,
      (video) => {
        video.pause = () => calls.push('pause');
        video.load = () => {
          calls.push('load');
          expect(video.getAttribute('src')).to.equal(null);
        };
      }
    );
    const outgoing = dom.window.document.querySelector('video');
    expect(outgoing.getAttribute('src')).to.contain('/0.mp4');
    current.seek(5000);
    await flush();
    expect(dom.window.document.querySelector('video')).not.to.equal(outgoing);
    expect(outgoing.getAttribute('src')).to.equal(null);
    expect(calls).to.include('load');
    expect(calls.indexOf('pause')).to.be.lessThan(calls.indexOf('load'));
  });

  it('advances, loops, pauses and resumes without mounting hidden posts', async () => {
    const current = await show(posts.slice(0, 2));
    clock = useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    current.play(NEVER);
    const playCount = plays.length;
    await clock.tickAsync(2300);
    expect(plays.length).to.equal(playCount);
    expect(text()).to.equal('Post 0');
    await clock.tickAsync(2800);
    expect(text()).to.equal('Post 1');
    expect(peak).to.equal(1);
    current.stop();
    await clock.tickAsync(6000);
    expect(text()).to.equal('Post 1');
    current.seek(9900);
    current.play(NEVER);
    await clock.tickAsync(200);
    expect(text()).to.equal('Post 0');
    expect(peak).to.equal(1);
    current.stop();
    await current.unload();
    expect(loaded).to.equal(0);
    expect(clock.countTimers()).to.equal(0);
  });

  it('handles empty, text-only and single-post lists', async () => {
    const empty = await show([]);
    expect(dom.window.document.querySelector('video')).to.equal(null);
    await empty.unload();
    const current = await show([{ message: 'Text only' }], { pageDuration: 0 });
    expect(text()).to.equal('Text only');
    expect(current.duration()).to.equal(10000);
    current.seek(20000);
    expect(text()).to.equal('Text only');
    expect(loaded).to.equal(0);
  });

  it('can seek past a still-loading post without acquiring its decoder later', async () => {
    let resolveFirst: ((url: string) => void) | undefined;
    const getMedia = async (url: string) =>
      url.endsWith('/0.mp4')
        ? new Promise<string>((resolve) => {
            resolveFirst = resolve;
          })
        : url;
    const original = posts[0].video;
    const current = await show([{ message: 'Intro' }, ...posts], {}, getMedia);
    current.seek(5000);
    await flush();
    expect(loaded).to.equal(0);
    current.seek(12000);
    await flush();
    expect(text()).to.equal('Post 1');
    expect(loaded).to.equal(1);
    resolveFirst!(original);
    await flush();
    expect(loaded).to.equal(1);
    expect(peak).to.equal(1);
  });
});
