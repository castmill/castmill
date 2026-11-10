/* oxlint-disable unicorn/no-thenable */
import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget, tickClock } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('time-dependent template updates', () => {
  const globals = globalThis as any;

  const withWidget = async (
    template: any,
    data: any,
    run: (
      root: HTMLElement,
      widget: TemplateWidget,
      media: string[],
      advanceClock: (hour?: number) => void
    ) => Promise<void>,
    beforeReady?: (
      root: HTMLElement,
      advanceClock: (hour?: number) => void,
      showing: Promise<unknown>,
      widget: TemplateWidget
    ) => void | Promise<void>,
    getMedia?: (url: string) => Promise<string | void>
  ) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
    const originalVideoLoad = dom.window.HTMLMediaElement.prototype.load;
    const keys = [
      'window',
      'document',
      'Node',
      'HTMLElement',
      'Element',
      'MutationObserver',
      'getComputedStyle',
    ];
    const saved: Record<string, unknown> = {};
    keys.forEach((key) => {
      saved[key] = globals[key];
    });
    globals.window = dom.window;
    globals.document = dom.window.document;
    globals.Node = dom.window.Node;
    globals.HTMLElement = dom.window.HTMLElement;
    globals.Element = dom.window.Element;
    globals.MutationObserver = dom.window.MutationObserver;
    globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

    dom.window.HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        right: 400,
        bottom: 200,
        left: 0,
        width: 400,
        height: 200,
        toJSON: () => ({}),
      }) as any;

    const savedFrame = globals.requestAnimationFrame;
    const savedCancelFrame = globals.cancelAnimationFrame;
    globals.requestAnimationFrame = (callback: () => void) => {
      const id = setTimeout(callback, 0);
      (id as any).unref?.();
      return id;
    };
    globals.cancelAnimationFrame = (id: any) => clearTimeout(id);

    const realNow = Date.now;
    let current = new Date(2026, 0, 1, 10, 0).getTime();
    Date.now = () => current;
    const advanceClock = (hour = 11) => {
      current = new Date(2026, 0, 1, hour, 0).getTime();
      tickClock();
    };
    tickClock();

    const media: string[] = [];
    const widget = new TemplateWidget(
      {
        getMedia: async (url: string) => {
          media.push(url);
          return getMedia ? getMedia(url) : `/cached/${url}`;
        },
      } as any,
      {
        widget: { name: 'clock-test', template } as any,
        config: { options: {}, data } as any,
        globals: { target: 'poster' },
      }
    );
    const root = dom.window.document.getElementById('root')!;

    try {
      const showing = firstValueFrom(widget.show(root, 0));
      await beforeReady?.(root, advanceClock, showing, widget);
      await showing;
      await run(root, widget, media, advanceClock);
    } finally {
      widget.stop();
      await widget.unload();
      dom.window.HTMLMediaElement.prototype.load = originalVideoLoad;
      Date.now = realNow;
      if (savedFrame) {
        globals.requestAnimationFrame = savedFrame;
        globals.cancelAnimationFrame = savedCancelFrame;
      }
      keys.forEach((key) => {
        globals[key] = saved[key];
      });
    }
  };

  it('updates image carousel media and animations when filtered images change', async () => {
    await withWidget(
      {
        type: 'image-carousel',
        name: 'carousel',
        opts: {
          images: {
            list: {
              key: 'data.images',
              where: [{ key: '$.until', gte: '@now' }],
              item: { key: '$.src' },
            },
          },
          imageDuration: 2,
        },
      },
      {
        images: [
          { src: 'expired.jpg', until: '2026-01-01T10:30:00' },
          { src: 'current.jpg', until: '2026-01-01T12:00:00' },
        ],
      },
      async (root, widget, media) => {
        const carousel = root.querySelector(
          '[data-component="image-carousel"]'
        )!;
        expect(carousel.children.length).to.equal(2);
        expect(media).to.include('expired.jpg');
        // Images load when they come in (hidden ones are cleared to save
        // memory on old players), so only the first one is set when shown.
        expect(carousel.children[0].getAttribute('style')).to.contain(
          '/cached/expired.jpg'
        );
        const tweenCount = () =>
          ((widget as any).timeline.items as any[])
            .find((item) => typeof item.child.getChildren === 'function')
            .child.getChildren().length;
        const initialTweenCount = tweenCount();
        expect(initialTweenCount).to.be.greaterThan(1);

        Date.now = () => new Date(2026, 0, 1, 11, 0).getTime();
        tickClock();
        await flush();

        expect(carousel.children.length).to.equal(1);
        expect(carousel.children[0].getAttribute('style')).to.contain(
          '/cached/current.jpg'
        );
        expect(media).to.include('current.jpg');
        expect(tweenCount()).to.be.lessThan(initialTweenCount);
      }
    );
  });

  it('keeps an unchanged time-filtered carousel mounted across clock ticks', async () => {
    await withWidget(
      {
        type: 'image-carousel',
        name: 'stable-carousel',
        opts: {
          images: {
            list: {
              key: 'data.images',
              where: [{ key: '$.until', gte: '@now' }],
              item: { key: '$.src' },
            },
          },
          imageDuration: 2,
        },
      },
      {
        images: [
          { src: 'first.jpg', until: '2026-01-01T12:00:00' },
          { src: 'second.jpg', until: '2026-01-01T12:00:00' },
        ],
      },
      async (_root, widget, media, advanceClock) => {
        const timelineItem = ((widget as any).timeline.items as any[]).find(
          (item) => typeof item.child.getChildren === 'function'
        );
        const initialTweenCount = timelineItem.child.getChildren().length;
        const initialMediaCount = media.length;

        advanceClock();
        await flush();

        const updatedTimelineItem = (
          (widget as any).timeline.items as any[]
        ).find((item) => typeof item.child.getChildren === 'function');
        expect(updatedTimelineItem).to.equal(timelineItem);
        expect(updatedTimelineItem.child.getChildren()).to.have.length(
          initialTweenCount
        );
        expect(media).to.have.length(initialMediaCount);
      }
    );
  });

  it('rebases a clock-updated carousel to the active parent playhead', async () => {
    await withWidget(
      {
        type: 'image-carousel',
        name: 'playing-carousel',
        opts: {
          images: {
            list: {
              key: 'data.images',
              where: [{ key: '$.until', gte: '@now' }],
              item: { key: '$.src' },
            },
          },
          imageDuration: 2,
        },
      },
      {
        images: [
          { src: 'expired.jpg', until: '2026-01-01T10:30:00' },
          { src: 'current.jpg', until: '2026-01-01T12:00:00' },
        ],
      },
      async (_root, widget, _media, advanceClock) => {
        const timeline = (widget as any).timeline;
        timeline.setDuration(600000);
        timeline.play(60000);
        advanceClock();
        await new Promise((resolve) => setTimeout(resolve, 120));

        const carouselItem = timeline.playing.values().next().value;
        expect(carouselItem.start).to.be.at.least(60000);
        expect(timeline.playing.has(carouselItem)).to.equal(true);
      }
    );
  });

  it('updates an image URL when its time-dependent binding changes', async () => {
    await withWidget(
      {
        type: 'image',
        name: 'clock-image',
        opts: {
          url: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'later.jpg',
              else: 'sooner.jpg',
            },
          },
        },
      },
      {},
      async (root, _widget, media, advanceClock) => {
        const image = root.querySelector('[data-component="image"]')!;
        expect(image.getAttribute('style')).to.contain('/cached/sooner.jpg');
        expect(media).to.include('sooner.jpg');
        advanceClock();
        await flush();
        expect(image.getAttribute('style')).to.contain('/cached/later.jpg');
        expect(media).to.include('later.jpg');
      },
      undefined
    );
  });

  it('does not apply an image cache result after its URL has changed', async () => {
    const pending: {
      url: string;
      resolve: (value: string) => void;
    }[] = [];
    await withWidget(
      {
        type: 'image',
        name: 'stale-clock-image',
        opts: {
          url: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'later.jpg',
              else: 'sooner.jpg',
            },
          },
        },
      },
      {},
      async (root, _widget, _media, _advanceClock) => {
        const image = root.querySelector('[data-component="image"]')!;
        pending.find((item) => item.url === 'sooner.jpg')!.resolve('/old.jpg');
        await flush();
        expect(image.getAttribute('style')).to.contain('/cached/later.jpg');
      },
      async (_root, advanceClock) => {
        const waitForUrl = async (url: string) => {
          for (
            let i = 0;
            i < 50 && !pending.some((item) => item.url === url);
            i++
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
          expect(pending.some((item) => item.url === url)).to.equal(true);
        };
        await waitForUrl('sooner.jpg');
        advanceClock();
        await waitForUrl('later.jpg');
        pending
          .find((item) => item.url === 'later.jpg')!
          .resolve('/cached/later.jpg');
      },
      (url) =>
        new Promise((resolve) => {
          pending.push({ url, resolve });
        })
    );
  });

  it('replaces a video source when its time-dependent URL changes', async () => {
    const pending: {
      url: string;
      resolve: (value: string) => void;
    }[] = [];
    await withWidget(
      {
        type: 'video',
        name: 'clock-video',
        opts: {
          url: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 12, 0).getTime(),
              then: 'second.mp4',
              else: {
                cond: {
                  key: '@now',
                  gte: new Date(2026, 0, 1, 11, 0).getTime(),
                  then: 'first.mp4',
                  else: '',
                },
              },
            },
          },
        },
      },
      {},
      async (root, _widget, _media, advanceClock) => {
        expect(root.querySelector('video')).to.equal(null);
        advanceClock(11);
        for (let i = 0; i < 50 && pending.length < 1; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(pending[0].url).to.equal('first.mp4');
        advanceClock(12);
        for (let i = 0; i < 50 && pending.length < 2; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(pending[1].url).to.equal('second.mp4');
        pending[0].resolve('/cached/first.mp4');
        await flush();
        expect(root.querySelector('video')?.getAttribute('src')).to.equal(null);
        pending[1].resolve('/cached/second.mp4');
        await flush();
        const video = root.querySelector('video')!;
        expect(video.src).to.contain('/cached/second.mp4');
      },
      (root) => {
        const view = root.ownerDocument.defaultView!;
        view.HTMLMediaElement.prototype.load = () => {};
      },
      (url) =>
        new Promise((resolve) => {
          pending.push({ url, resolve });
        })
    );
  });

  it('starts a time-selected video at the active parent playhead', async () => {
    let mediaUrl: string | undefined;
    let resolveMedia: ((url: string) => void) | undefined;
    let playCalls = 0;
    await withWidget(
      {
        type: 'video',
        name: 'clock-playback-video',
        opts: {
          url: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'later.mp4',
              else: '',
            },
          },
        },
      },
      {},
      async (root, widget, _media, advanceClock) => {
        const timeline = (widget as any).timeline;
        timeline.setDuration(600000);
        timeline.play(60000);

        advanceClock();
        for (let i = 0; i < 50 && !mediaUrl; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(mediaUrl).to.equal('later.mp4');

        const video = root.querySelector('video')!;
        video.load = () => {};
        video.play = () => {
          playCalls++;
          return Promise.resolve();
        };
        video.pause = () => {};
        resolveMedia!('/cached/later.mp4');
        for (let i = 0; i < 50 && !video.src; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(video.src).to.contain('/cached/later.mp4');
        Object.defineProperty(video, 'duration', {
          configurable: true,
          value: 20,
        });
        const Event = root.ownerDocument.defaultView!.Event;
        video.dispatchEvent(new Event('loadedmetadata'));
        video.dispatchEvent(new Event('canplaythrough'));

        for (let i = 0; i < 50 && playCalls === 0; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(playCalls).to.be.greaterThan(0);
        expect(video.currentTime).to.be.lessThan(20);
      },
      undefined,
      (url) => {
        mediaUrl = url;
        return new Promise((resolve) => {
          resolveMedia = resolve;
        });
      }
    );
  });

  it('keeps a paused time-selected video start at zero after a seek', async () => {
    let resolveMedia: ((url: string) => void) | undefined;
    await withWidget(
      {
        type: 'video',
        name: 'paused-clock-video',
        opts: {
          url: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'later.mp4',
              else: '',
            },
          },
        },
      },
      {},
      async (root, widget, _media, advanceClock) => {
        const timeline = (widget as any).timeline;
        timeline.setDuration(600000);
        timeline.seek(2000);

        advanceClock();
        for (let i = 0; i < 50 && !resolveMedia; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(resolveMedia).to.not.equal(undefined);

        const video = root.querySelector('video')!;
        video.load = () => {};
        resolveMedia!('/cached/later.mp4');
        for (let i = 0; i < 50 && !video.src; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        let currentTime = 0;
        Object.defineProperty(video, 'currentTime', {
          configurable: true,
          get: () => currentTime,
          set: (value: number) => {
            currentTime = value;
          },
        });
        Object.defineProperty(video, 'readyState', {
          configurable: true,
          value: 1,
        });
        Object.defineProperty(video, 'duration', {
          configurable: true,
          value: 12,
        });
        const Event = root.ownerDocument.defaultView!.Event;
        video.dispatchEvent(new Event('loadedmetadata'));
        video.dispatchEvent(new Event('canplaythrough'));

        const videoItem = timeline.items.find(
          (item: any) => item.child && item.duration === 12000
        );
        expect(videoItem.start).to.equal(0);
        timeline.seek(2000);
        expect(video.currentTime).to.equal(2);
      },
      undefined,
      () =>
        new Promise((resolve) => {
          resolveMedia = resolve;
        })
    );
  });

  it('regenerates QR content when its time-dependent binding changes', async () => {
    await withWidget(
      {
        type: 'qr-code',
        name: 'clock-qr',
        opts: {
          content: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'https://example.com/a-much-longer-qr-code-content',
              else: 'x',
            },
          },
        },
      },
      {},
      async (root, _widget, _media, advanceClock) => {
        const initialViewBox = root
          .querySelector('svg')
          ?.getAttribute('viewBox');
        advanceClock();
        await flush();
        expect(root.querySelector('svg')?.getAttribute('viewBox')).not.to.equal(
          initialViewBox
        );
      }
    );
  });

  it('updates time-dependent styles and disposes their clock subscriptions on unload', async () => {
    await withWidget(
      {
        type: 'text',
        name: 'clock-style',
        opts: { text: 'Clock style' },
        style: {
          opacity: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 1,
              else: 0,
            },
          },
        },
      },
      {},
      async (root, widget) => {
        const text = root.querySelector('[data-component="text"]')!;
        expect((text as HTMLElement).style.opacity).to.equal('0');

        Date.now = () => new Date(2026, 0, 1, 11, 0).getTime();
        tickClock();
        await flush();
        expect((text as HTMLElement).style.opacity).to.equal('1');

        await widget.unload();
        expect(root.children.length).to.equal(0);

        Date.now = () => new Date(2026, 0, 1, 10, 0).getTime();
        tickClock();
        await flush();
        expect((text as HTMLElement).style.opacity).to.equal('1');

        await firstValueFrom(widget.show(root, 0));
        expect(
          (root.querySelector('[data-component="text"]') as HTMLElement).style
            .opacity
        ).to.equal('0');
      }
    );
  });

  it('rebuilds animated text when clock-resolved content changes', async () => {
    await withWidget(
      {
        type: 'text',
        name: 'clock-animated-text',
        opts: {
          text: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'Later clock',
              else: 'Early clock',
            },
          },
        },
        animations: [
          {
            keyframes: [
              { from: { opacity: 0 } },
              { to: { opacity: 1, duration: 1 } },
            ],
          },
        ],
      },
      {},
      async (root, widget, _media, advanceClock) => {
        const text = root.querySelector('[data-component="text"] span')!;
        const timeline = (widget as any).timeline;
        const animationTargets = () =>
          (timeline.items as any[])
            .filter((item) => typeof item.child.getChildren === 'function')
            .flatMap((item) =>
              item.child.getChildren().flatMap((tween: any) => tween.targets())
            );
        const initialTargets = animationTargets();
        expect(text.textContent?.replace(/\u00a0/g, ' ')).to.equal(
          'Early clock'
        );
        expect(initialTargets).to.include(text.children[0]);

        timeline.setDuration(120000);
        timeline.play(60000);
        advanceClock();
        await flush();

        const updatedTargets = animationTargets();
        expect(text.textContent?.replace(/\u00a0/g, ' ')).to.equal(
          'Later clock'
        );
        expect(text.children.length).to.be.greaterThan(0);
        expect(updatedTargets).to.include(text.children[0]);
        expect(updatedTargets).not.to.include(initialTargets[0]);
        const updatedAnimation = [...timeline.items, ...timeline.playing].find(
          (item: any) =>
            typeof item.child.getChildren === 'function' &&
            item.child
              .getChildren()
              .some((tween: any) => tween.targets().includes(text.children[0]))
        );
        expect(updatedAnimation).not.to.equal(undefined);
        expect(updatedAnimation?.start).to.equal(60000);
      }
    );
  });

  it('keeps end-relative animated text starts anchored when content changes', async () => {
    await withWidget(
      {
        type: 'text',
        name: 'end-relative-clock-text',
        opts: {
          text: {
            cond: {
              key: '@now',
              gte: new Date(2026, 0, 1, 11, 0).getTime(),
              then: 'Later clock',
              else: 'Early clock',
            },
          },
        },
        animations: [
          {
            start: -1000,
            keyframes: [{ to: { opacity: 0, duration: 1 } }],
          },
        ],
      },
      {},
      async (_root, widget, _media, advanceClock) => {
        const timeline = (widget as any).timeline;
        timeline.setDuration(120000);
        timeline.play(60000);
        advanceClock();
        await flush();

        const animation = [...timeline.items, ...timeline.playing].find(
          (item: any) => typeof item.child.getChildren === 'function'
        );
        expect(animation?.start).to.equal(119000);
      }
    );
  });

  it('keeps animated text mounted when clock-resolved content is unchanged', async () => {
    await withWidget(
      {
        type: 'text',
        name: 'stable-clock-text',
        opts: { text: { fmt: "{@now | date:'D/M'}" } },
        animations: [
          {
            keyframes: [
              { from: { opacity: 0 } },
              { to: { opacity: 1, duration: 1 } },
            ],
          },
        ],
      },
      {},
      async (root, widget, _media, advanceClock) => {
        const text = root.querySelector('[data-component="text"] span')!;
        const animatedElement = text.firstElementChild;
        const timeline = (widget as any).timeline;
        const animation = (timeline.items as any[]).find(
          (item) => typeof item.child.getChildren === 'function'
        );
        const tweenCount = animation.child.getChildren().length;

        advanceClock();
        await flush();

        const updatedAnimation = (timeline.items as any[]).find(
          (item) => typeof item.child.getChildren === 'function'
        );
        expect(text.firstElementChild).to.equal(animatedElement);
        expect(updatedAnimation).to.equal(animation);
        expect(updatedAnimation.child.getChildren()).to.have.length(tweenCount);
      }
    );
  });

  it('does not count repeated video readiness while a group sibling is loading', async () => {
    const pending: { url: string; resolve: (value: string) => void }[] = [];

    await withWidget(
      {
        type: 'group',
        name: 'readiness-group',
        components: [
          {
            type: 'video',
            name: 'clock-video',
            opts: {
              url: {
                cond: {
                  key: '@now',
                  gte: new Date(2026, 0, 1, 11, 0).getTime(),
                  then: 'later.mp4',
                  else: '',
                },
              },
            },
          },
          {
            type: 'image',
            name: 'slow-image',
            opts: { url: 'slow.jpg' },
          },
        ],
      },
      {},
      async (root) => {
        expect(root.querySelector('video')?.src).to.contain(
          '/cached/later.mp4'
        );
      },
      async (root, advanceClock, showing) => {
        const view = root.ownerDocument.defaultView!;
        view.HTMLMediaElement.prototype.load = () => {};
        let isReady = false;
        void showing.then(() => {
          isReady = true;
        });
        const waitForUrl = async (url: string) => {
          for (
            let i = 0;
            i < 50 && !pending.some((item) => item.url === url);
            i++
          ) {
            await new Promise((resolve) => setTimeout(resolve, 2));
          }
          expect(pending.some((item) => item.url === url)).to.equal(true);
        };

        await waitForUrl('slow.jpg');
        expect(isReady).to.equal(false);
        advanceClock();
        await waitForUrl('later.mp4');
        pending
          .find((item) => item.url === 'later.mp4')!
          .resolve('/cached/later.mp4');

        const video = root.querySelector('video')!;
        for (let i = 0; i < 50 && !video.src; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        Object.defineProperty(video, 'duration', {
          configurable: true,
          value: 10,
        });
        const Event = view.Event;
        video.dispatchEvent(new Event('loadedmetadata'));
        video.dispatchEvent(new Event('canplaythrough'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(isReady).to.equal(false);

        pending
          .find((item) => item.url === 'slow.jpg')!
          .resolve('/cached/slow.jpg');
      },
      (url) =>
        new Promise((resolve) => {
          pending.push({ url, resolve });
        })
    );
  });

  it('does not count a paginated scroller rebuild while a group sibling is loading', async () => {
    const pending: { url: string; resolve: (value: string) => void }[] = [];
    let initialTimelineItemCount = 0;

    await withWidget(
      {
        type: 'group',
        name: 'paginated-readiness-group',
        components: [
          {
            type: 'paginated-list',
            name: 'paginated-scroller',
            opts: {
              items: { key: 'data.groups' },
              pageDuration: 30,
              pageSize: 1,
            },
            component: {
              type: 'scroller',
              name: 'clock-scroller',
              opts: {
                items: {
                  list: {
                    key: '$.items',
                    where: [{ key: '$.until', gte: '@now' }],
                  },
                },
              },
              component: {
                type: 'text',
                opts: { text: { key: '$.label' } },
              },
            },
          },
          {
            type: 'image',
            name: 'slow-image',
            opts: { url: 'slow.jpg' },
          },
        ],
      },
      {
        groups: [
          {
            items: [
              { label: 'expired', until: '2026-01-01T10:30:00' },
              { label: 'current', until: '2026-01-01T12:00:00' },
            ],
          },
        ],
      },
      async (_root, widget) => {
        expect((widget as any).timeline.items).to.have.length(
          initialTimelineItemCount
        );
      },
      async (_root, advanceClock, showing, widget) => {
        const isReady = { value: false };
        const timeline = (widget as any).timeline;
        void showing.then(() => {
          isReady.value = true;
        });
        for (
          let i = 0;
          i < 50 && !pending.some((item) => item.url === 'slow.jpg');
          i++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        expect(pending.some((item) => item.url === 'slow.jpg')).to.equal(true);
        for (let i = 0; i < 100 && timeline.items.length < 2; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(timeline.items).to.have.length(2);
        expect(isReady.value).to.equal(false);
        initialTimelineItemCount = timeline.items.length;

        advanceClock();
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(isReady.value).to.equal(false);
        expect(timeline.items).to.have.length(initialTimelineItemCount);
        pending
          .find((item) => item.url === 'slow.jpg')!
          .resolve('/cached/slow.jpg');
      },
      (url) =>
        new Promise((resolve) => {
          pending.push({ url, resolve });
        })
    );
  });
});
