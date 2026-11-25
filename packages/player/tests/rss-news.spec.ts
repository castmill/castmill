/*
 * The system RSS News template, as the backend migration stores it
 * (fixtures/rss-news-template.json, checked against the database by
 * packages/castmill/test/castmill/widgets/rss_news_widget_test.exs), renders
 * the items the RSS fetcher delivers.
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
// @ts-ignore Node built-ins have no type declarations in this package.
import { readFileSync } from 'fs';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget } from '../dist/index.js';

const template = JSON.parse(
  readFileSync(
    new URL('./fixtures/rss-news-template.json', import.meta.url),
    'utf8'
  )
);

// As Castmill.Widgets.Integrations.Fetchers.Rss delivers them.
const story = (n: number, image = '') => ({
  id: `https://example.com/${n}`,
  title: `Headline ${n}`,
  description: `Summary ${n}`,
  link: `https://example.com/${n}`,
  image,
  imageUrl: image,
  author: '',
  categories: [],
  source: 'Example News',
  pubDate: '2026-11-24T12:00:00Z',
  pubDateFormatted: 'Nov 24, 2026',
});

const data = {
  feedTitle: 'Example News',
  feedFormat: 'rss',
  items: [story(1, 'https://example.com/1.jpg'), story(2), story(3)],
};

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
  g.requestAnimationFrame ??= (callback: () => void) => {
    const id = setTimeout(callback, 0);
    id.unref?.();
    return id;
  };
  g.cancelAnimationFrame ??= (id: any) => clearTimeout(id);

  // The paginated list waits for a size. Solid clones nodes from the window
  // of the spec that first rendered each template, so give a size to the
  // elements of whatever window the rendered nodes come from.
  const sized = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 960,
    bottom: 540,
    width: 960,
    height: 540,
    toJSON: () => ({}),
  };
  const patched = new Map<any, any>();
  const patch = (node: any) => {
    let proto = Object.getPrototypeOf(node);
    while (
      proto &&
      !Object.prototype.hasOwnProperty.call(proto, 'getBoundingClientRect')
    ) {
      proto = Object.getPrototypeOf(proto);
    }
    if (proto && !patched.has(proto)) {
      patched.set(proto, proto.getBoundingClientRect);
      proto.getBoundingClientRect = () => sized;
    }
  };
  const root = dom.window.document.getElementById('root');
  patch(root);
  const observer = new dom.window.MutationObserver((records: any[]) =>
    records.forEach((record) =>
      record.addedNodes.forEach(
        (node: any) => node.nodeType === 1 && patch(node)
      )
    )
  );
  observer.observe(root, { childList: true, subtree: true });
  try {
    await fn(root);
  } finally {
    observer.disconnect();
    patched.forEach(
      (original, proto) => (proto.getBoundingClientRect = original)
    );
    keys.forEach((key) => (g[key] = saved[key]));
    g.getComputedStyle = savedComputed;
  }
};

const show = async (root: HTMLElement, options: Record<string, any>) => {
  const widget = new TemplateWidget(
    { getMedia: async (url: string) => url } as any,
    {
      widget: { name: 'RSS News', template } as any,
      config: { options, data } as any,
      globals: { target: 'default' } as any,
    }
  );
  await firstValueFrom(widget.show(root, 0));
};

const texts = (root: HTMLElement, name: string) =>
  Array.from(root.querySelectorAll(`[data-name="${name}"]`)).map((el) =>
    el.textContent?.trim()
  );

describe('RSS News template', () => {
  it('renders the fetched stories', async () => {
    await withDom(async (root) => {
      // A playlist item saved with only the feed URL: every option defaults.
      await show(root, { feed_url: 'https://example.com/feed.xml' });

      expect(texts(root, 'news-title')).to.deep.equal([
        'Headline 1',
        'Headline 2',
        'Headline 3',
      ]);
      expect(texts(root, 'news-description')).to.deep.equal([
        'Summary 1',
        'Summary 2',
        'Summary 3',
      ]);
      expect(texts(root, 'news-source')).to.have.length(3);
      // Only the story with an image gets an image box.
      expect(root.querySelectorAll('[data-name="news-image"]')).to.have.length(
        1
      );
      // The ticker is off by default.
      expect(texts(root, 'ticker-item')).to.deep.equal([]);
    });
  });

  it('follows the display options', async () => {
    await withDom(async (root) => {
      await show(root, {
        feed_url: 'https://example.com/feed.xml',
        page_size: 2,
        show_image: false,
        show_source: false,
        show_ticker: true,
        ticker_label: 'NEWS',
        ticker_separator: ' | ',
      });

      expect(texts(root, 'news-title')).to.include('Headline 1');
      expect(root.querySelectorAll('[data-name="news-image"]')).to.have.length(
        0
      );
      expect(texts(root, 'news-source')).to.deep.equal([]);
      expect(texts(root, 'ticker-label')).to.deep.equal(['NEWS']);
      expect(texts(root, 'ticker-item')).to.include('Headline 1 |');
    });
  });
});
