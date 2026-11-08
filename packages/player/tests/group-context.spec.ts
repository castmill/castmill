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

describe('Group context, when and limit', () => {
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

  it('renders components only when their value is present', async () => {
    await withDom(async (root) => {
      const template = {
        type: 'group',
        name: 'root',
        components: [
          { ...text('fee', 'data.fee'), when: { key: 'data.fee' } },
          { ...text('rooms', 'data.rooms'), when: { key: 'data.rooms' } },
          { ...text('blank', 'data.blank'), when: { key: 'data.blank' } },
          { ...text('none', 'data.none'), when: { key: 'data.none' } },
          { ...text('list', 'data.list'), when: { key: 'data.list' } },
          { ...text('flag', 'data.flag'), when: { key: 'data.flag' } },
          { ...text('object', 'data.object.a'), when: { key: 'data.object' } },
          { ...text('nan', 'data.nan'), when: { key: 'data.nan' } },
        ],
      };

      await show(root, template, {
        fee: 3337,
        rooms: 0,
        blank: '  ',
        list: [],
        flag: false,
        object: { a: 'x' },
        nan: NaN,
      });

      expect(textOf(root, 'fee')).to.equal('3337');
      expect(textOf(root, 'object')).to.equal('x');
      for (const name of ['rooms', 'blank', 'none', 'list', 'flag', 'nan']) {
        expect(textOf(root, name), name).to.equal(undefined);
      }
    });
  });

  it('limits a group to its first visible children', async () => {
    await withDom(async (root) => {
      const fact = (name: string) => ({
        type: 'group',
        name,
        when: { key: `$.${name}` },
        components: [text(`${name}-value`, `$.${name}`)],
      });

      const template = {
        type: 'group',
        name: 'facts',
        context: { key: 'data.listing' },
        opts: { limit: { key: 'options.max_facts' } },
        components: ['price', 'fee', 'rooms', 'area', 'year'].map(fact),
      };

      const widget = new TemplateWidget(
        { getMedia: async (url: string) => url } as any,
        {
          widget: { name: 'listing', template } as any,
          config: {
            options: { max_facts: 2 },
            data: { listing: { price: 100, rooms: 3, area: 63, year: 1929 } },
          } as any,
          globals: { target: 'poster' } as any,
        }
      );
      await firstValueFrom(widget.show(root, 0));

      expect(textOf(root, 'price-value')).to.equal('100');
      expect(textOf(root, 'rooms-value')).to.equal('3');
      expect(textOf(root, 'fee-value')).to.equal(undefined);
      expect(textOf(root, 'area-value')).to.equal(undefined);
      expect(textOf(root, 'year-value')).to.equal(undefined);
    });
  });

  it('renders nothing for a limit of zero and everything without a valid limit', async () => {
    await withDom(async (root) => {
      const template = (limit: any) => ({
        type: 'group',
        name: 'root',
        opts: { limit },
        components: [text('a', 'data.a'), text('b', 'data.b')],
      });

      await show(root, template(0), { a: 'A', b: 'B' });
      expect(textOf(root, 'a')).to.equal(undefined);

      root.innerHTML = '';
      await show(root, template('many'), { a: 'A', b: 'B' });
      expect(textOf(root, 'a')).to.equal('A');
      expect(textOf(root, 'b')).to.equal('B');
    });
  });
});
