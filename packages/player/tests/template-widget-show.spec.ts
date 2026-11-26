import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom, Subject } from 'rxjs';
import { useFakeTimers } from 'sinon';

import { TemplateWidget, Layer, Renderer } from '../dist/index.js';

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
    'Image',
    'FontFace',
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

  it('isolates widget alignment from the host without overriding authored alignments', async () => {
    const root = dom.window.document.getElementById('root');
    root.style.textAlign = 'center';
    const widget = new TemplateWidget({ getMedia: async () => {} } as any, {
      widget: {
        name: 'alignment',
        template: {
          type: 'group',
          name: 'content',
          components: [
            { type: 'text', name: 'default', opts: { text: 'Default' } },
            ...['left', 'center', 'right'].map((alignment) => ({
              type: 'group',
              name: alignment,
              style: { 'text-align': alignment },
              components: [
                { type: 'text', name: alignment, opts: { text: alignment } },
              ],
            })),
          ],
        },
      } as any,
      config: { options: {}, data: {} } as any,
      globals: { target: 'poster' },
      style: { width: '640px', height: '360px' },
    });
    try {
      await firstValueFrom(widget.show(root, 0));
      const boundary = root.querySelector('[data-component=template]');
      expect(boundary.style.textAlign).to.equal('initial');
      expect(boundary.style.width).to.equal('640px');
      expect(boundary.style.height).to.equal('360px');
      const plain = root.querySelector(
        '[data-component=text][data-name=default]'
      );
      expect(plain.style.textAlign).to.equal('');
      for (const alignment of ['left', 'center', 'right']) {
        expect(
          root.querySelector(`[data-component=group][data-name=${alignment}]`)
            .style.textAlign
        ).to.equal(alignment);
      }
    } finally {
      await widget.unload();
    }
  });

  it('preserves explicit template-boundary alignment', async () => {
    const root = dom.window.document.getElementById('root');
    const widget = new TemplateWidget({ getMedia: async () => {} } as any, {
      widget: {
        name: 'explicit-alignment',
        template: { type: 'text', name: 'text', opts: { text: 'Aligned' } },
      } as any,
      config: { options: {}, data: {} } as any,
      globals: { target: 'poster' },
      style: { 'text-align': 'right' },
    });
    try {
      await firstValueFrom(widget.show(root, 0));
      expect(
        root.querySelector('[data-component=template]').style.textAlign
      ).to.equal('right');
    } finally {
      await widget.unload();
    }
  });

  it('waits for every declared font before rendering or reporting ready', async () => {
    const resolveFonts: Array<() => void> = [];
    const added: unknown[] = [];
    globals.FontFace = class {
      load() {
        return new Promise((resolve) => resolveFonts.push(() => resolve(this)));
      }
    };
    Object.defineProperty(dom.window.document, 'fonts', {
      value: { add: (font: unknown) => added.push(font), delete: () => {} },
    });
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'font-ready',
          template: { type: 'text', name: 'text', opts: { text: 'Ready' } },
        } as any,
        fonts: [
          { name: 'one', url: '/one.woff' },
          { name: 'two', url: '/two.woff' },
        ],
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    let ready = false;
    const root = dom.window.document.getElementById('root');
    const shown = firstValueFrom(widget.show(root, 0)).then(() => {
      ready = true;
    });
    try {
      await flush();
      expect(resolveFonts).to.have.length(2);
      expect(root.children.length).to.equal(0);
      resolveFonts[1]();
      await flush();
      expect(ready).to.equal(false);
      resolveFonts[0]();
      await shown;
      expect(added).to.have.length(2);
      expect(root.textContent).to.equal('Ready');
    } finally {
      resolveFonts.forEach((resolve) => resolve());
      await shown;
      await widget.unload();
    }
  });

  it('reports a failed font as blocked without rendering an incomplete template', async () => {
    globals.FontFace = class {
      load() {
        return Promise.reject(new Error('Font download failed'));
      }
    };
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'font-failure',
          template: { type: 'text', name: 'text', opts: { text: 'Not ready' } },
        } as any,
        fonts: [{ name: 'missing', url: '/missing.woff' }],
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }
    );
    const root = dom.window.document.getElementById('root');
    let ready = false;
    const blocks: unknown[] = [];
    const blocking = widget.blocked$().subscribe((value) => {
      if (value) blocks.push(value);
    });
    const error = console.error;
    console.error = () => {};
    const showing = widget.show(root, 0).subscribe(() => {
      ready = true;
    });
    try {
      await flush();
      expect(ready).to.equal(false);
      expect(root.children.length).to.equal(0);
      expect(blocks).to.have.length(1);
    } finally {
      console.error = error;
      showing.unsubscribe();
      blocking.unsubscribe();
      await widget.unload();
    }
  });

  for (const kind of ['image', 'image-carousel']) {
    it(`keeps the previous layer when ${kind} fails instead of reporting readiness`, async () => {
      const preloads: Array<{ onerror: (() => void) | null }> = [];
      globals.Image = class {
        complete = false;
        naturalWidth = 0;
        src = '';
        onload = null;
        onerror: (() => void) | null = null;
        constructor() {
          preloads.push(this);
        }
      };
      const errors: unknown[] = [];
      const make = (name: string, template: object) =>
        new Layer(name, {
          widget: new TemplateWidget(
            { getMedia: async (url: string) => url } as any,
            {
              widget: { name, template } as any,
              config: { options: {}, data: {} } as any,
              globals: {
                target: 'poster',
                reportError: (error) => errors.push(error),
              },
            }
          ),
        });
      const previous = make('previous', {
        type: 'text',
        name: 'text',
        opts: { text: 'Previous' },
      });
      const incoming = make('failed', {
        type: kind,
        name: kind,
        opts:
          kind === 'image'
            ? { url: '/missing.png' }
            : { images: ['/missing.png'], imageDuration: 5 },
      });
      const renderer = new Renderer(dom.window.document.getElementById('root'));
      await firstValueFrom(renderer.show(previous, 0));
      let ready = false;
      const blocked: unknown[] = [];
      const blocking = incoming.blocked$().subscribe((value) => {
        if (value) blocked.push(value);
      });
      const showing = renderer.show(incoming, 0).subscribe(() => {
        ready = true;
      });
      const warn = console.warn;
      console.warn = () => {};
      try {
        await flush();
        preloads[0].onerror?.();
        await flush();
        expect(ready).to.equal(false);
        expect(renderer.getCurrentLayer()).to.equal(previous);
        expect(previous.el.isConnected).to.equal(true);
        expect(incoming.el.style.visibility).to.equal('hidden');
        expect(errors).to.have.length(1);
        expect(blocked).to.have.length(1);
      } finally {
        console.warn = warn;
        showing.unsubscribe();
        blocking.unsubscribe();
        renderer.clear();
      }
    });

    for (const playing of [false, true]) {
      it(`keeps the previous layer visible until ${kind} loads and decodes during ${playing ? 'play' : 'show'}`, async () => {
        const preloads: Array<{ onload: (() => void) | null }> = [];
        const decode: Array<() => void> = [];
        globals.Image = class {
          complete = false;
          naturalWidth = 0;
          src = '';
          onload: (() => void) | null = null;
          onerror = null;
          constructor() {
            preloads.push(this);
          }
          decode() {
            return new Promise<void>((resolve) => decode.push(resolve));
          }
        };
        const resourceManager = { getMedia: async (url: string) => url };
        const make = (name: string, template: object) =>
          new Layer(name, {
            widget: new TemplateWidget(resourceManager as any, {
              widget: { name, template } as any,
              config: { options: {}, data: {} } as any,
              globals: { target: 'poster' },
            }),
          });
        const previous = make('previous', {
          type: 'text',
          name: 'text',
          opts: { text: 'Previous' },
        });
        const incoming = make('incoming', {
          type: kind,
          name: kind,
          opts:
            kind === 'image'
              ? { url: '/image.png' }
              : { images: ['/one.png', '/two.png'], imageDuration: 5 },
        });
        const renderer = new Renderer(
          dom.window.document.getElementById('root')
        );
        const timer = new Subject<number>();
        await firstValueFrom(renderer.show(previous, 0));
        let switched = false;
        const subscription = (
          playing
            ? renderer.play(incoming, timer, 0, 100)
            : renderer.show(incoming, 0)
        ).subscribe(() => {
          switched = true;
        });
        try {
          await flush();
          expect(preloads).to.have.length(1);
          expect(renderer.getCurrentLayer()).to.equal(previous);
          expect(previous.el.isConnected).to.equal(true);
          expect(incoming.el.style.visibility).to.equal('hidden');
          preloads.forEach((image) => image.onload?.());
          await flush();
          expect(renderer.getCurrentLayer()).to.equal(previous);
          expect(switched).to.equal(false);
          decode.forEach((resolve) => resolve());
          await flush();
          expect(renderer.getCurrentLayer()).to.equal(incoming);
          expect(incoming.el.style.visibility).to.equal('visible');
          expect(previous.el.isConnected).to.equal(false);
        } finally {
          subscription.unsubscribe();
          await incoming.stop();
          renderer.clear();
        }
      });
    }
  }

  it('releases an unfinished image preparation when the widget unloads', async () => {
    const preloads: Array<{
      src: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    }> = [];
    globals.Image = class {
      complete = false;
      naturalWidth = 0;
      src = '';
      onload = null;
      onerror = null;
      constructor() {
        preloads.push(this);
      }
    };
    const errors: unknown[] = [];
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'stalled-image',
          template: {
            type: 'image',
            name: 'image',
            opts: { url: '/stalled.png' },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: {
          target: 'poster',
          reportError: (error) => errors.push(error),
        },
      }
    );
    const clock = useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let ready = false;
    const showing = widget
      .show(dom.window.document.getElementById('root'), 0)
      .subscribe(() => {
        ready = true;
      });
    try {
      await clock.tickAsync(0);
      expect(preloads).to.have.length(1);
      const pendingTimers = clock.countTimers();
      const lateLoad = preloads[0].onload;
      await widget.unload();
      expect(preloads[0].src).to.equal('');
      expect(preloads[0].onload).to.equal(null);
      expect(preloads[0].onerror).to.equal(null);
      expect(clock.countTimers()).to.be.lessThan(pendingTimers);
      lateLoad?.();
      await clock.tickAsync(30000);
      expect(ready).to.equal(false);
      expect(errors).to.have.length(0);
    } finally {
      showing.unsubscribe();
      await widget.unload();
      clock.restore();
    }
  });

  it('does not reveal a pending layer when its show is cancelled', async () => {
    const previous = new Layer('previous', {
      widget: new TemplateWidget({} as any, {
        widget: {
          name: 'previous',
          template: { type: 'text', name: 'text', opts: { text: 'Previous' } },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'poster' },
      }),
    });
    const incoming = new Layer('pending', { widget: createVideoWidget() });
    const renderer = new Renderer(dom.window.document.getElementById('root'));
    await firstValueFrom(renderer.show(previous, 0));
    const subscription = renderer.show(incoming, 0).subscribe();
    await flush();
    subscription.unsubscribe();
    expect(renderer.getCurrentLayer()).to.equal(previous);
    expect(previous.el.isConnected).to.equal(true);
    expect(incoming.el.style.visibility).to.equal('hidden');
    renderer.clear();
  });

  it('uses a measured duration hint until the visible widget loads its actual duration', async () => {
    const widget = createVideoWidget();
    widget.setDurationHint(13500);
    widget.setDurationHint(20000);
    expect(widget.duration()).to.equal(13500);
    const shown = firstValueFrom(
      widget.show(dom.window.document.getElementById('root'), 0)
    );
    await flush();
    const video = dom.window.document.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 8.5 });
    Object.defineProperty(video, 'readyState', { value: 4 });
    video.dispatchEvent(new dom.window.Event('loadedmetadata'));
    video.dispatchEvent(new dom.window.Event('canplaythrough'));
    await shown;
    expect(widget.duration()).to.equal(8500);
    await widget.unload();
    expect(widget.duration()).to.equal(8500);
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

    const timeline = (widget as any).timeline;
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const secondShow = firstValueFrom(widget.show(el, 0));
      await flush();
      expect(widget.duration()).to.equal(13967);

      now += 1500;
      const rerenderedVideo = el.querySelector('video')!;
      Object.defineProperty(rerenderedVideo, 'duration', { value: 8.5 });
      Object.defineProperty(rerenderedVideo, 'readyState', { value: 4 });
      rerenderedVideo?.dispatchEvent(new dom.window.Event('loadedmetadata'));
      rerenderedVideo?.dispatchEvent(new dom.window.Event('canplaythrough'));
      await secondShow;
      expect(timeline.time).to.equal(1500);
      expect(widget.duration()).to.equal(8500);
    } finally {
      Date.now = originalNow;
    }
    await widget.unload();
  });

  it('keeps the requested paused preview position after a slow load', async () => {
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'video',
          template: {
            type: 'video',
            name: 'video',
            opts: { url: 'https://example.com/clip.mp4' },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'preview', freezePreviewDuringLoad: true },
      }
    );
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const shown = firstValueFrom(
        widget.show(dom.window.document.getElementById('root'), 0)
      );
      await flush();
      now += 8000;
      const video = dom.window.document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 20 });
      Object.defineProperty(video, 'readyState', { value: 4 });
      video.dispatchEvent(new dom.window.Event('loadedmetadata'));
      video.dispatchEvent(new dom.window.Event('canplaythrough'));
      await shown;
      expect((widget as any).timeline.time).to.equal(0);
    } finally {
      Date.now = originalNow;
      await widget.unload();
    }
  });

  it('compensates loading time if the preview starts playing while loading', async () => {
    let paused = true;
    const widget = new TemplateWidget(
      { getMedia: async (url: string) => url } as any,
      {
        widget: {
          name: 'video',
          template: {
            type: 'video',
            name: 'video',
            opts: { url: 'https://example.com/clip.mp4' },
          },
        } as any,
        config: { options: {}, data: {} } as any,
        globals: { target: 'preview', freezePreviewDuringLoad: () => paused },
      }
    );
    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const shown = firstValueFrom(
        widget.show(dom.window.document.getElementById('root'), 0)
      );
      await flush();
      now += 1500;
      paused = false;
      const video = dom.window.document.querySelector('video')!;
      Object.defineProperty(video, 'duration', { value: 20 });
      Object.defineProperty(video, 'readyState', { value: 4 });
      video.dispatchEvent(new dom.window.Event('loadedmetadata'));
      video.dispatchEvent(new dom.window.Event('canplaythrough'));
      await shown;
      expect((widget as any).timeline.time).to.equal(1500);
    } finally {
      Date.now = originalNow;
      await widget.unload();
    }
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

      const scrollerContent = el.querySelector(
        '[data-component="scroller"] > div'
      ) as HTMLElement;
      // Solid clones elements from the document it first rendered this
      // template into (possibly another spec's window), so stub the element
      // itself rather than a window's prototype.
      scrollerContent.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: contentWidth,
          bottom: 20,
          width: contentWidth,
          height: 20,
          toJSON: () => ({}),
        }) as DOMRect;
      const observer = observed.find(
        ({ target }) => target === scrollerContent
      );
      expect(observer).to.not.equal(undefined);

      observer?.callback([], {} as ResizeObserver);
      expect(widget.duration()).to.equal(1000);

      contentWidth = 400;
      observer?.callback([], {} as ResizeObserver);
      expect(widget.duration()).to.equal(2000);
    } finally {
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
