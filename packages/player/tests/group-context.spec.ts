import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget, baseFontSize } from '../dist/index.js';

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
  // Pending frames must not keep the test process alive (templates are not
  // disposed, so their frame callbacks may never stop).
  g.requestAnimationFrame ??= (callback: () => void) => {
    const id = setTimeout(callback, 0);
    id.unref?.();
    return id;
  };
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

  it('computes the base font size from the widget size', () => {
    expect(baseFontSize(1920, 1080)).to.equal(10);
    expect(baseFontSize(960, 540)).to.equal(5);
    // The smaller ratio wins, so the design fits ("contain").
    expect(baseFontSize(1080, 1920)).to.equal(5.625);
    expect(baseFontSize(3840, 540)).to.equal(5);
    expect(baseFontSize(960, 0)).to.equal(null);
    expect(baseFontSize(0, 540)).to.equal(null);
  });

  it('sets the base font size on the template root', async () => {
    await withDom(async (root) => {
      await show(
        root,
        { type: 'group', name: 'root', fontScale: true, components: [] },
        {}
      );
      const el = root.querySelector(
        '[data-component="template"]'
      ) as HTMLElement;

      // Not laid out yet (jsdom sizes are 0): no base until it has a size.
      expect(el.style.fontSize).to.equal('');

      const size = { width: 960, height: 540 };
      Object.defineProperty(el, 'clientWidth', { get: () => size.width });
      Object.defineProperty(el, 'clientHeight', { get: () => size.height });
      const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

      // jsdom has no ResizeObserver, like Chrome 38: the player letterboxing
      // the widget (an inline size) is followed through its style.
      el.style.width = '960px';
      await settle();
      expect(el.style.fontSize).to.equal('5px');

      // Window resizes are followed too.
      size.width = 1080;
      size.height = 1920;
      (globalThis as any).window.dispatchEvent(
        new (globalThis as any).window.Event('resize')
      );
      expect(el.style.fontSize).to.equal('5.625px');

      // Its own write does not trigger it again.
      await settle();
      expect(el.style.fontSize).to.equal('5.625px');
    });
  });

  it('does not change the font baseline unless the template opts in', async () => {
    await withDom(async (root) => {
      await show(root, { type: 'group', name: 'root', components: [] }, {});
      const el = root.querySelector(
        '[data-component="template"]'
      ) as HTMLElement;
      const size = { width: 1920, height: 1080 };
      Object.defineProperty(el, 'clientWidth', { get: () => size.width });
      Object.defineProperty(el, 'clientHeight', { get: () => size.height });

      expect(el.style.fontSize).to.equal('');
    });
  });

  it('fits only texts that declare autofit', async () => {
    await withDom(async (root) => {
      await show(
        root,
        {
          type: 'group',
          name: 'root',
          components: [
            { type: 'text', name: 'plain', opts: { text: 'Plain' } },
            {
              type: 'text',
              name: 'fitted',
              opts: { text: 'Fitted', autofit: {} },
            },
          ],
        },
        {}
      );

      const span = (name: string) =>
        root.querySelector(`[data-name="${name}"] span`) as HTMLElement;

      // Unmeasured texts keep their em size; fitted ones get a computed size
      // (1em while their container has no size yet).
      expect(span('plain').style.fontSize).to.equal('');
      expect(span('fitted').style.fontSize).to.equal('1em');
    });
  });
});
