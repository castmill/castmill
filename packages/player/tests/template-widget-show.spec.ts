import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import { TemplateWidget } from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TemplateWidget.show', () => {
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

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><div id="root"></div>');
    keys.forEach((key) => {
      saved[key] = globals[key];
      globals[key] = key === 'window' ? dom.window : dom.window[key];
    });
    globals.document = dom.window.document;
    globals.requestAnimationFrame = (callback: () => void) =>
      setTimeout(callback, 0);
    globals.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) =>
      clearTimeout(id);
    // jsdom does not implement media loading.
    dom.window.HTMLMediaElement.prototype.load = () => {};
  });

  afterEach(() => {
    keys.forEach((key) => {
      globals[key] = saved[key];
    });
  });

  const createVideoWidget = () =>
    new TemplateWidget({ getMedia: async (url: string) => url } as any, {
      widget: {
        name: 'video',
        template: {
          type: 'video',
          name: 'video',
          opts: { url: 'https://example.com/clip.mp4' },
        },
      } as any,
      config: { options: {}, data: {} } as any,
      globals: { target: 'poster' },
    });

  it('waits for the first render to be ready when shown again meanwhile', async () => {
    const widget = createVideoWidget();
    const el = dom.window.document.getElementById('root');
    const events: string[] = [];

    widget.show(el, 0).subscribe(() => events.push('first'));
    await flush();
    widget.show(el, 0).subscribe(() => events.push('second'));
    await flush();

    const videos = el.querySelectorAll('video');
    expect(videos.length).to.equal(1);
    // The video has no metadata yet, so its duration is still the default.
    expect(events).to.deep.equal([]);
    expect(widget.duration()).to.equal(10000);

    const video = videos[0];
    Object.defineProperty(video, 'duration', { value: 13.967 });
    Object.defineProperty(video, 'readyState', { value: 4 });
    video.dispatchEvent(new dom.window.Event('loadedmetadata'));
    video.dispatchEvent(new dom.window.Event('canplaythrough'));
    await flush();

    expect(events).to.deep.equal(['first', 'second']);
    expect(widget.duration()).to.equal(13967);

    // Once ready, later shows complete immediately.
    expect(await firstValueFrom(widget.show(el, 0))).to.equal(
      'template-widget:shown'
    );

    await widget.unload();
    expect(widget.duration()).to.equal(13967);

    const secondShow = firstValueFrom(widget.show(el, 0));
    await flush();
    expect(widget.duration()).to.equal(13967);

    const rerenderedVideo = el.querySelector('video')!;
    Object.defineProperty(rerenderedVideo, 'duration', { value: 8.5 });
    Object.defineProperty(rerenderedVideo, 'readyState', { value: 4 });
    rerenderedVideo?.dispatchEvent(new dom.window.Event('loadedmetadata'));
    rerenderedVideo?.dispatchEvent(new dom.window.Event('canplaythrough'));
    await secondShow;
    expect(widget.duration()).to.equal(8500);
    await widget.unload();
  });

  it('remeasures scroller duration when its content size changes', async () => {
    const observed: Array<{
      target: Element;
      callback: ResizeObserverCallback;
    }> = [];
    globals.ResizeObserver = class {
      constructor(private callback: ResizeObserverCallback) {}

      observe(target: Element) {
        observed.push({ target, callback: this.callback });
      }

      disconnect() {}
    };

    let contentWidth = 200;
    const prototype = dom.window.HTMLElement.prototype;
    const originalGetBoundingClientRect = prototype.getBoundingClientRect;
    prototype.getBoundingClientRect = function () {
      if (
        this.parentElement?.getAttribute('data-component') === 'scroller' &&
        this.style.position !== 'absolute'
      ) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: contentWidth,
          bottom: 20,
          width: contentWidth,
          height: 20,
          toJSON: () => ({}),
        };
      }
      return originalGetBoundingClientRect.call(this);
    };

    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'ticker',
          template: {
            type: 'scroller',
            name: 'ticker',
            opts: {
              items: [{ label: 'first' }],
              gap: '0px',
              speed: 100,
            },
            component: {
              type: 'text',
              name: 'ticker-item',
              opts: { text: { key: '$.label' } },
            },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    const el = dom.window.document.getElementById('root');

    try {
      await firstValueFrom(widget.show(el, 0));
      expect(widget.duration()).to.equal(1000);

      const scrollerContent = el.querySelector(
        '[data-component="scroller"] > div'
      );
      const observer = observed.find(
        ({ target }) => target === scrollerContent
      );
      expect(observer).to.not.equal(undefined);
      contentWidth = 400;
      observer?.callback([], {} as ResizeObserver);
      expect(widget.duration()).to.equal(2000);
    } finally {
      prototype.getBoundingClientRect = originalGetBoundingClientRect;
      await widget.unload();
    }
  });

  it('remeasures scroller duration when the legacy font baseline changes', async () => {
    let templateWidth = 960;
    let templateHeight = 540;

    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'ticker',
          template: {
            type: 'scroller',
            name: 'ticker',
            fontScale: true,
            opts: {
              items: [{ label: 'first' }],
              gap: '0px',
              speed: 100,
            },
            component: {
              type: 'text',
              name: 'ticker-item',
              opts: { text: { key: '$.label' } },
            },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    const el = dom.window.document.getElementById('root');

    try {
      await firstValueFrom(widget.show(el, 0));
      const template = el.querySelector(
        '[data-component="template"]'
      ) as HTMLElement;
      Object.defineProperty(template, 'clientWidth', {
        configurable: true,
        get: () => templateWidth,
      });
      Object.defineProperty(template, 'clientHeight', {
        configurable: true,
        get: () => templateHeight,
      });
      const content = el.querySelector(
        '[data-component="scroller"] > div'
      ) as HTMLElement;
      content.getBoundingClientRect = () => {
        const width = Number.parseFloat(template.style.fontSize || '0') * 40;
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: width,
          bottom: 20,
          width,
          height: 20,
          toJSON: () => ({}),
        } as DOMRect;
      };

      dom.window.dispatchEvent(new dom.window.Event('resize'));
      expect(widget.duration()).to.equal(1000);
      templateWidth = 1920;
      templateHeight = 1080;
      dom.window.dispatchEvent(new dom.window.Event('resize'));
      expect(widget.duration()).to.equal(2000);
    } finally {
      await widget.unload();
    }
  });

  it('does not initialize a scroller after cleanup while fonts are loading', async () => {
    let resolveFonts!: () => void;
    let markFontsPending!: () => void;
    const fontsPending = new Promise<void>((resolve) => {
      markFontsPending = resolve;
    });
    const fontsReady = new Promise<void>((resolve) => {
      resolveFonts = resolve;
    });
    Object.defineProperty(dom.window.document, 'fonts', {
      configurable: true,
      value: {
        get ready() {
          markFontsPending();
          return fontsReady;
        },
      },
    });

    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'ticker',
          template: {
            type: 'scroller',
            name: 'ticker',
            opts: { items: [{ label: 'first' }], gap: '0px' },
            component: {
              type: 'text',
              name: 'ticker-item',
              opts: { text: { key: '$.label' } },
            },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    const el = dom.window.document.getElementById('root');
    const timeline = (widget as any).timeline;
    let addedItems = 0;
    const add = timeline.add.bind(timeline);
    timeline.add = (item: unknown) => {
      addedItems++;
      add(item);
    };

    widget.show(el, 0).subscribe();
    await fontsPending;
    await widget.unload();
    resolveFonts();
    await new Promise((resolve) => setTimeout(resolve, 60));
    await flush();

    expect(addedItems).to.equal(0);
    expect(timeline.items).to.have.length(0);
  });

  it('disposes observers on unload and renders again when shown', async () => {
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'template',
          template: {
            type: 'group',
            name: 'root',
            fontScale: true,
            components: [],
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    const el = dom.window.document.getElementById('root');
    let added = 0;
    let removed = 0;
    const addEventListener = dom.window.addEventListener.bind(dom.window);
    const removeEventListener = dom.window.removeEventListener.bind(dom.window);
    dom.window.addEventListener = (type: string, ...args: any[]) => {
      if (type === 'resize') added++;
      return addEventListener(type, ...args);
    };
    dom.window.removeEventListener = (type: string, ...args: any[]) => {
      if (type === 'resize') removed++;
      return removeEventListener(type, ...args);
    };

    await firstValueFrom(widget.show(el, 0));
    expect(added).to.equal(1);
    await widget.unload();
    expect(removed).to.equal(1);
    expect(el.children.length).to.equal(0);

    await firstValueFrom(widget.show(el, 0));
    expect(added).to.equal(2);
    expect(el.children.length).to.equal(1);
    await widget.unload();
    expect(removed).to.equal(2);
  });
});
