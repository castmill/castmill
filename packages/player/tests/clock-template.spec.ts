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
      media: string[]
    ) => Promise<void>,
    beforeReady?: (root: HTMLElement) => void
  ) => {
    const dom = new JSDOM('<!doctype html><div id="root"></div>');
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
    tickClock();

    const media: string[] = [];
    const widget = new TemplateWidget(
      {
        getMedia: async (url: string) => {
          media.push(url);
          return `/cached/${url}`;
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
      beforeReady?.(root);
      await showing;
      await run(root, widget, media);
    } finally {
      widget.stop();
      await widget.unload();
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
        expect(carousel.children[1].getAttribute('style')).to.contain(
          '/cached/current.jpg'
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
});
