import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import {
  TemplateWidget,
  TextComponent,
  getTextOverride,
  isPlayerShortcutTarget,
  isTextInputTarget,
  resolveEditable,
} from '../dist/index.js';

const config = (options: any = {}, data: any = {}) => ({ options, data });
const globals = { locale: 'sv' } as any;

const priceText = (editable: any = { key: 'price', label: 'Pris' }) => ({
  type: 'text',
  name: 'price',
  opts: {
    text: {
      first: [{ fmt: '{data.price | number} kr' }, { fmt: 'Pris saknas' }],
    },
    autofit: {},
  },
  style: { 'text-transform': 'uppercase' },
  editable,
});

const withDom = async (fn: (root: HTMLElement) => Promise<void>) => {
  const saved: Record<string, unknown> = {};
  const keys = [
    'window',
    'document',
    'Node',
    'HTMLElement',
    'Element',
    'MutationObserver',
  ];
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const g = globalThis as any;
  keys.forEach((key) => {
    saved[key] = g[key];
    g[key] = key === 'window' ? dom.window : dom.window[key];
  });
  const savedComputed = g.getComputedStyle;
  const savedRaf = g.requestAnimationFrame;
  const savedCaf = g.cancelAnimationFrame;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  g.requestAnimationFrame = (callback: () => void) => setTimeout(callback, 0);
  g.cancelAnimationFrame = (id: any) => clearTimeout(id);
  try {
    await fn(dom.window.document.getElementById('root'));
  } finally {
    keys.forEach((key) => {
      g[key] = saved[key];
    });
    g.getComputedStyle = savedComputed;
    g.requestAnimationFrame = savedRaf;
    g.cancelAnimationFrame = savedCaf;
  }
};

const show = async (
  root: HTMLElement,
  template: any,
  options: any = {},
  data: any = {},
  optionsSchema?: any
) => {
  const widget = new TemplateWidget(
    { getMedia: async (url: string) => url } as any,
    {
      widget: {
        name: 'listing',
        template,
        options_schema: optionsSchema,
      } as any,
      config: { options, data } as any,
      globals: { target: 'poster', locale: 'sv' },
    }
  );
  await firstValueFrom(widget.show(root, 0));
  return widget;
};

const NBSP = '\u00a0';

describe('Editable texts', () => {
  describe('resolveEditable', () => {
    it('resolves static and bound keys and labels', () => {
      expect(
        resolveEditable(
          { key: 'street', label: 'Gata', multiline: true, max_length: 80 },
          config(),
          {},
          globals
        )
      ).to.deep.equal({
        key: 'street',
        label: 'Gata',
        multiline: true,
        maxLength: 80,
      });

      expect(
        resolveEditable(
          { key: { fmt: 'fact.{$.id}' }, label: { key: '$.label' } },
          config(),
          { id: 'rooms', label: 'Rum' },
          globals
        )
      ).to.deep.equal({
        key: 'fact.rooms',
        label: 'Rum',
        multiline: false,
        maxLength: 500,
      });

      expect(
        resolveEditable({ key: { key: '$.n' } }, config(), { n: 3 }, globals)!
          .key
      ).to.equal('3');
    });

    it('ignores missing or empty keys', () => {
      expect(resolveEditable(undefined, config(), {}, globals)).to.equal(
        undefined
      );
      expect(resolveEditable('x' as any, config(), {}, globals)).to.equal(
        undefined
      );
      expect(
        resolveEditable({ key: { fmt: '{$.missing}' } }, config(), {}, globals)
      ).to.equal(undefined);
      expect(
        resolveEditable({ key: { key: '$.o' } }, config(), { o: {} }, globals)
      ).to.equal(undefined);
      expect(
        resolveEditable({ key: 'a', label: 7 }, config(), {}, globals)!.label
      ).to.equal('7');
      expect(
        resolveEditable({ key: 'a', label: '' }, config(), {}, globals)!.label
      ).to.equal(undefined);
    });
  });

  describe('getTextOverride', () => {
    it('reads valid overrides only', () => {
      const overrides = {
        a: { text: 'A' },
        b: { hidden: true },
        c: { text: 1 },
        d: null,
        e: { hidden: 'yes' },
      };
      const cfg = config({ overrides });
      expect(getTextOverride(cfg, 'a')).to.deep.equal({ text: 'A' });
      expect(getTextOverride(cfg, 'b')).to.deep.equal({ hidden: true });
      expect(getTextOverride(cfg, 'c')).to.equal(undefined);
      expect(getTextOverride(cfg, 'd')).to.equal(undefined);
      expect(getTextOverride(cfg, 'e')).to.equal(undefined);
      expect(getTextOverride(cfg, 'missing')).to.equal(undefined);
      expect(getTextOverride(cfg, 'toString')).to.equal(undefined);
      expect(getTextOverride(config({ overrides: 'x' }), 'a')).to.equal(
        undefined
      );
      expect(getTextOverride(config(), 'a')).to.equal(undefined);
      expect(getTextOverride(undefined as any, 'a')).to.equal(undefined);
    });
  });

  describe('TextComponent.resolveOptions', () => {
    const text = TextComponent.fromJSON(priceText());
    const resolve = (options: any, data: any = { price: 4950000 }) =>
      TextComponent.resolveOptions(
        text.opts,
        config(options, data),
        {},
        globals,
        text.editable
      );

    it('keeps the formatted binding without an override', () => {
      const opts = resolve({});
      expect(opts.text).to.equal(`4${NBSP}950${NBSP}000 kr`);
      expect(opts.editable).to.deep.equal({
        key: 'price',
        label: 'Pris',
        multiline: false,
        maxLength: 500,
      });
    });

    it('shows overrides verbatim, bypassing fmt, literals and first', () => {
      const opts = resolve({ overrides: { price: { text: '1929' } } });
      expect(opts.text).to.equal('1929');
      expect(opts.editable!.overridden).to.equal('text');

      expect(
        resolve({ overrides: { price: { text: 'PÅ BEGÄRAN' } } }, {}).text
      ).to.equal('PÅ BEGÄRAN');
    });

    it('empties hidden texts', () => {
      const opts = resolve({ overrides: { price: { hidden: true } } });
      expect(opts.text).to.equal('');
      expect(opts.editable!.overridden).to.equal('hidden');
    });

    it('ignores overrides of other keys and non-editable texts', () => {
      expect(resolve({ overrides: { other: { text: 'x' } } }).text).to.equal(
        `4${NBSP}950${NBSP}000 kr`
      );

      const plain = TextComponent.fromJSON(priceText(null));
      const opts = TextComponent.resolveOptions(
        plain.opts,
        config({ overrides: { price: { text: 'x' } } }, { price: 1 }),
        {},
        globals,
        plain.editable
      );
      expect(opts.text).to.equal('1 kr');
      expect(opts.editable).to.equal(undefined);
    });
  });

  describe('inside lists', () => {
    const label = TextComponent.fromJSON({
      type: 'text',
      name: 'label',
      opts: { text: { key: '$.label' } },
    });
    const value = TextComponent.fromJSON({
      type: 'text',
      name: 'value',
      opts: { text: { fmt: '{$.value} m²' } },
      editable: { key: { fmt: 'fact.{$.id}' }, label: { key: '$.label' } },
    });
    const cfg = config({ overrides: { 'fact.plot': { text: 'Ca 800' } } });
    const item = (context: any) => ({
      label: TextComponent.resolveOptions(label.opts, cfg, context, globals)
        .text,
      value: TextComponent.resolveOptions(
        value.opts,
        cfg,
        context,
        globals,
        value.editable
      ),
    });

    it('gives each item its own key and replaces only the edited text', () => {
      const living = item({ id: 'living', label: 'Boarea', value: 120 });
      expect(living.label).to.equal('Boarea');
      expect(living.value.text).to.equal('120 m²');
      expect(living.value.editable!.key).to.equal('fact.living');
      expect(living.value.editable!.label).to.equal('Boarea');

      const plot = item({ id: 'plot', label: 'Tomt', value: 800 });
      expect(plot.label).to.equal('Tomt');
      expect(plot.value.text).to.equal('Ca 800');
      expect(plot.value.editable!.overridden).to.equal('text');
    });
  });

  describe('player UI keyboard shortcuts', () => {
    it('ignores keys typed into text fields', () => {
      const element = (tagName: string, extra: any = {}) =>
        ({ tagName, ...extra }) as any;

      expect(isTextInputTarget(element('INPUT'))).to.equal(true);
      expect(isTextInputTarget(element('TEXTAREA'))).to.equal(true);
      expect(isTextInputTarget(element('select'))).to.equal(true);
      expect(
        isTextInputTarget(element('DIV', { isContentEditable: true }))
      ).to.equal(true);
      expect(isTextInputTarget(element('DIV'))).to.equal(false);
      expect(isTextInputTarget({} as any)).to.equal(false);
      expect(isTextInputTarget(null)).to.equal(false);
    });

    it('does not treat button activation as a player shortcut', async () => {
      await withDom(async () => {
        const button = document.createElement('button');
        const child = document.createElement('span');
        button.appendChild(child);

        expect(isPlayerShortcutTarget(button)).to.equal(true);
        expect(isPlayerShortcutTarget(child)).to.equal(true);
        expect(isPlayerShortcutTarget(document.createElement('div'))).to.equal(
          false
        );
      });
    });
  });

  describe('rendering', () => {
    const template = {
      type: 'group',
      name: 'root',
      components: [
        priceText(),
        {
          type: 'text',
          name: 'address',
          opts: { text: { key: 'data.address' }, autofit: { minSize: 0.5 } },
          editable: { key: 'address', label: 'Adress', multiline: true },
        },
      ],
    };
    const data = {
      price: 4950000,
      address: 'Storgatan 1',
    };
    const el = (root: HTMLElement, key: string) =>
      root.querySelector(`[data-editable-key="${key}"]`) as HTMLElement;

    it('renders overrides, hidden texts and editor hooks', async () => {
      await withDom(async (root) => {
        const widget = await show(
          root,
          template,
          {
            overrides: {
              price: { text: 'På begäran' },
              address: { hidden: true },
              unused: { text: 'ignored' },
            },
          },
          data
        );

        const price = el(root, 'price');
        expect(price.textContent).to.equal('På begäran');
        expect(price.getAttribute('data-editable-label')).to.equal('Pris');
        expect(price.getAttribute('data-editable-max-length')).to.equal('500');
        expect(price.getAttribute('data-editable-overridden')).to.equal('text');
        expect(price.getAttribute('data-editable-multiline')).to.equal(null);
        // Styles still apply to overrides.
        expect(price.style.textTransform).to.equal('uppercase');
        expect(price.querySelector('span')!.style.lineHeight).to.equal('1em');

        const address = el(root, 'address');
        expect(address.textContent).to.equal('');
        expect(address.getAttribute('data-editable-overridden')).to.equal(
          'hidden'
        );
        expect(address.getAttribute('data-editable-multiline')).to.equal(
          'true'
        );

        widget.stop();
      });
    });

    it('keeps line breaks of multiline overrides', async () => {
      await withDom(async (root) => {
        const widget = await show(
          root,
          template,
          { overrides: { address: { text: 'Storgatan 1\nStockholm' } } },
          data
        );
        const span = el(root, 'address').querySelector('span')!;
        expect(span.textContent).to.equal('Storgatan 1\nStockholm');
        expect(span.style.whiteSpace).to.equal('pre-line');
        expect(span.style.lineHeight).to.equal('1em');
        widget.stop();
      });
    });

    it('renders templates without editable texts as before', async () => {
      await withDom(async (root) => {
        const widget = await show(
          root,
          {
            type: 'text',
            name: 'title',
            opts: { text: { key: 'data.title' }, autofit: {} },
          },
          { overrides: { title: { text: 'nope' } } },
          { title: 'Hello' }
        );
        expect(root.textContent).to.equal('Hello');
        expect(root.querySelector('[data-editable-key]')).to.equal(null);
        widget.stop();
      });
    });

    it('does not apply text overrides when the widget declares that option', async () => {
      await withDom(async (root) => {
        const widget = await show(
          root,
          {
            type: 'text',
            name: 'street',
            opts: { text: { key: 'data.street' }, autofit: {} },
            editable: { key: 'street' },
          },
          { overrides: { street: { text: 'Regular option' } } },
          { street: 'Bound street' },
          { overrides: 'string' }
        );

        expect(root.textContent).to.equal('Bound street');
        expect(root.querySelector('[data-editable-overridden]')).to.equal(null);
        widget.stop();
      });
    });
  });
});
