import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget } from '../dist/index.js';

const withDom = async (fn: (root: HTMLElement) => Promise<void>) => {
  const keys = [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'Element',
    'MutationObserver',
  ];
  const g = globalThis as any;
  const saved: Record<string, unknown> = {};
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  keys.forEach((key) => {
    saved[key] = g[key];
    g[key] = key === 'window' ? dom.window : dom.window[key];
  });
  const savedComputed = g.getComputedStyle;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  // gsap's ticker keeps calling these after the test, so they stay installed.
  g.requestAnimationFrame ??= (callback: () => void) => setTimeout(callback, 0);
  g.cancelAnimationFrame ??= (id: any) => clearTimeout(id);
  try {
    await fn(dom.window.document.getElementById('root'));
  } finally {
    keys.forEach((key) => (g[key] = saved[key]));
    g.getComputedStyle = savedComputed;
  }
};

const text = (name: string, key: string) => ({
  type: 'text',
  name,
  opts: { text: { key } },
});

const show = async (root: HTMLElement, template: any, data: any) => {
  const widget = new TemplateWidget(
    { getMedia: async (url: string) => url } as any,
    {
      widget: { name: 'listing', template } as any,
      config: { options: {}, data } as any,
      globals: { target: 'poster' } as any,
    }
  );
  await firstValueFrom(widget.show(root, 0));
  return widget;
};

const textOf = (root: HTMLElement, name: string) =>
  (
    root.querySelector(`[data-name="${name}"]`) as HTMLElement | null
  )?.textContent?.trim();

describe('Group context', () => {
  it('binds children to the group context', async () => {
    await withDom(async (root) => {
      const template = {
        type: 'group',
        name: 'root',
        components: [
          {
            type: 'group',
            name: 'listing',
            context: { key: 'data.listing' },
            components: [
              text('street', '$.street'),
              // Nested groups without context keep their parent's context.
              {
                type: 'group',
                name: 'inner',
                components: [text('city', '$.city')],
              },
              text('outside', 'data.title'),
            ],
          },
          text('plain', '$.street'),
        ],
      };

      await show(root, template, {
        title: 'Till salu',
        listing: { street: 'Storgatan 1', city: 'Lund' },
      });

      expect(textOf(root, 'street')).to.equal('Storgatan 1');
      expect(textOf(root, 'city')).to.equal('Lund');
      expect(textOf(root, 'outside')).to.equal('Till salu');
      expect(textOf(root, 'plain')).to.equal('');
    });
  });

  it('keeps the outer context for the group filter', async () => {
    await withDom(async (root) => {
      const template = {
        type: 'group',
        name: 'root',
        components: [
          {
            type: 'group',
            name: 'hidden',
            context: { key: 'data.listing' },
            filter: { 'data.show': true },
            components: [text('street', '$.street')],
          },
        ],
      };

      await show(root, template, {
        show: false,
        listing: { street: 'Storgatan 1' },
      });
      expect(textOf(root, 'street')).to.equal(undefined);
    });
  });
});
