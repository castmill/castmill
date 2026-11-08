/* oxlint-disable no-unused-expressions */
import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore Node built-ins have no type declarations in this package.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget, tickClock } from '../dist/index.js';

const withClockWidget = async (
  type: 'paginated-list' | 'scroller',
  run: (
    root: HTMLElement,
    widget: TemplateWidget,
    updated: boolean
  ) => Promise<void>
) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const globals = globalThis as any;
  const globalKeys = [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'Element',
    'MutationObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
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
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => rect as any;
  globals.window = dom.window;
  globals.document = dom.window.document;
  globals.Node = dom.window.Node;
  globals.HTMLElement = dom.window.HTMLElement;
  globals.Element = dom.window.Element;
  globals.MutationObserver = dom.window.MutationObserver;
  globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globals.requestAnimationFrame = (callback: () => void) =>
    setTimeout(callback, 0);
  globals.cancelAnimationFrame = (id: any) => clearTimeout(id);

  const realNow = Date.now;
  let current = new Date(2026, 0, 1, 10, 0).getTime();
  Date.now = () => current;
  tickClock();

  const iso = (date: Date) => {
    const pad = (value: number) => (value < 10 ? '0' : '') + value;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  };
  const widget = new TemplateWidget(
    { getMedia: async (url: string) => url } as any,
    {
      widget: {
        name: `clock-${type}`,
        template: {
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
        },
      } as any,
      config: {
        options: {},
        data: {
          viewings: [
            { name: 'soon', end: iso(new Date(2026, 0, 1, 10, 30)) },
            { name: 'later', end: iso(new Date(2026, 0, 1, 12, 0)) },
          ],
        },
      } as any,
      globals: { target: 'poster' },
    }
  );
  const root = dom.window.document.getElementById('root')!;

  try {
    await firstValueFrom(widget.show(root, 0));
    await run(root, widget, false);
    current = new Date(2026, 0, 1, 11, 0).getTime();
    tickClock();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await run(root, widget, true);
  } finally {
    widget.stop();
    Date.now = realNow;
    globalKeys.forEach((key) => {
      globals[key] = saved[key];
    });
    dom.window.close();
  }
};

describe('@now list consumers', () => {
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
});
