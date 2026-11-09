/* oxlint-disable no-unused-expressions */
import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore Node built-ins have no type declarations in this package.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget, tickClock } from '../dist/index.js';

let templateWindow: any;

const withClockWidget = async (
  type: 'paginated-list' | 'scroller',
  run: (
    root: HTMLElement,
    widget: TemplateWidget,
    updated: boolean
  ) => Promise<void>,
  keepItems = false,
  templateOverride?: any,
  dataOverride?: any,
  beforeTick?: (root: HTMLElement) => void
) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  templateWindow ||= dom.window;
  const globals = globalThis as any;
  const globalKeys = [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'Element',
    'MutationObserver',
    'getComputedStyle',
  ];
  const saved: Record<string, unknown> = {};
  globalKeys.forEach((key) => {
    saved[key] = globals[key];
  });

  const rect = {
    x: 0,
    y: 0,
    top: 0,
    right: 400,
    bottom: 200,
    left: 0,
    width: 400,
    height: 200,
    toJSON: () => ({}),
  };
  // Solid clones templates from the first document it renders into, so later
  // specs may create elements from this window: restore the stub afterwards.
  const realRect = dom.window.HTMLElement.prototype.getBoundingClientRect;
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => rect as any;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.Node = dom.window.Node;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.Element = dom.window.Element;
  globals.MutationObserver = dom.window.MutationObserver;
  globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  // Rendered templates are not disposed, so their pending frame callbacks may
  // run after the test: keep this shim unless another one was defined before.
  // Pending frames must not keep the test process alive either.
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

  const iso = (date: Date) => {
    const pad = (value: number) => (value < 10 ? '0' : '') + value;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  };
  const template = templateOverride || {
    type,
    name: 'viewings',
    opts: {
      items: {
        list: {
          key: 'data.viewings',
          where: [{ key: '$.end', gte: '@now' }],
        },
      },
      pageDuration: 30,
      pageSize: 5,
    },
    component: {
      type: 'text',
      name: 'viewing',
      opts: { text: { key: '$.name' }, autofit: {} },
    },
  };
  const data = dataOverride || {
    viewings: [
      {
        name: 'soon',
        end: iso(new Date(2026, 0, 1, keepItems ? 12 : 10, 30)),
      },
      { name: 'later', end: iso(new Date(2026, 0, 1, 12, 0)) },
    ],
  };
  const widget = new TemplateWidget(
    { getMedia: async (url: string) => url } as any,
    {
      widget: {
        name: `clock-${type}`,
        template,
      } as any,
      config: {
        options: {},
        data,
      } as any,
      globals: { target: 'poster' },
    }
  );
  const root = dom.window.document.getElementById('root')!;

  try {
    await firstValueFrom(widget.show(root, 0));
    await run(root, widget, false);
    beforeTick?.(root);
    current = new Date(2026, 0, 1, 11, 0).getTime();
    tickClock();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await run(root, widget, true);
  } finally {
    widget.stop();
    await widget.unload();
    Date.now = realNow;
    if (dom.window !== templateWindow) {
      dom.window.HTMLElement.prototype.getBoundingClientRect = realRect;
    }
    if (savedFrame) {
      globals.requestAnimationFrame = savedFrame;
      globals.cancelAnimationFrame = savedCancelFrame;
    }
    globalKeys.forEach((key) => {
      globals[key] = saved[key];
    });
    if (dom.window !== templateWindow) {
      dom.window.close();
    }
  }
};

describe('@now list consumers', () => {
  it('does not reinitialize a scroller when nested paginated pages update', async function () {
    this.timeout(10000);
    const template = {
      type: 'scroller',
      name: 'scroller',
      opts: { items: { key: 'data.groups' } },
      component: {
        type: 'paginated-list',
        name: 'events',
        opts: {
          items: {
            list: {
              key: '$.events',
              where: [{ key: '$.end', gte: '@now' }],
            },
          },
          pageDuration: 30,
          pageSize: 1,
        },
        component: {
          type: 'text',
          name: 'event',
          opts: { text: { key: '$.name' } },
        },
      },
    };
    const data = {
      groups: [
        {
          events: [
            { name: 'expired', end: '2026-01-01T10:30:00' },
            { name: 'current', end: '2026-01-01T12:00:00' },
          ],
        },
      ],
    };
    let initialDuration: number;

    await withClockWidget(
      'scroller',
      async (_root, widget, updated) => {
        const scrollerItems = () =>
          ((widget as any).timeline.items as any[]).filter(
            (item) =>
              item.repeat &&
              Object.getPrototypeOf(item.child) === Object.prototype
          );
        if (updated) {
          expect(scrollerItems()).to.have.length(1);
          expect(scrollerItems()[0].duration).not.to.equal(initialDuration);
        } else {
          expect(scrollerItems()).to.have.length(1);
          initialDuration = scrollerItems()[0].duration;
        }
      },
      false,
      template,
      data,
      (root) => {
        const view = root.ownerDocument.defaultView!;
        view.HTMLElement.prototype.getBoundingClientRect = () =>
          ({
            x: 0,
            y: 0,
            top: 0,
            right: 600,
            bottom: 200,
            left: 0,
            width: 600,
            height: 200,
            toJSON: () => ({}),
          }) as any;
      }
    );
  });

  it('rebuilds paginated pages when resolved items change', async () => {
    await withClockWidget('paginated-list', async (root, _widget, updated) => {
      if (updated) {
        expect(root.textContent).not.to.contain('soon');
      } else {
        expect(root.textContent).to.contain('soon');
      }
      expect(root.textContent).to.contain('later');
    });
  });

  it('rebuilds scroller content when resolved items change', async () => {
    await withClockWidget('scroller', async (root, _widget, updated) => {
      if (updated) {
        expect(root.textContent).not.to.contain('soon');
      } else {
        expect(root.textContent).to.contain('soon');
      }
      expect(root.textContent).to.contain('later');
    });
  });

  it('keeps scroller items mounted when the resolved list is unchanged', async () => {
    let firstItem: Element | null = null;
    await withClockWidget(
      'scroller',
      async (root, _widget, updated) => {
        if (updated) {
          expect(
            root.querySelector('[data-component="scroller"] > div > div')
          ).to.equal(firstItem);
        } else {
          firstItem = root.querySelector(
            '[data-component="scroller"] > div > div'
          );
          expect(firstItem).not.to.equal(null);
        }
      },
      true
    );
  });
});
