import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom, Subject } from 'rxjs';
import { useFakeTimers } from 'sinon';

import {
  ImageCarouselComponent,
  Layer,
  Playlist,
  Renderer,
  TemplateWidget,
  carouselTransitionArgs,
  preloadCarouselImages,
  resolveCarouselImageUrls,
} from '../dist/index.js';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const silenceWarnings = async <T>(fn: () => Promise<T>) => {
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (message: string) => warnings.push(message);
  try {
    return { result: await fn(), warnings };
  } finally {
    console.warn = warn;
  }
};

describe('ImageCarousel', () => {
  describe('carouselTransitionArgs', () => {
    it('slides and zooms by default', () => {
      for (const transition of [undefined, 'slide', 'unknown']) {
        const { startArgs, endArgs } = carouselTransitionArgs(transition);
        expect(startArgs).to.deep.equal({
          duration: 1,
          x: -100,
          autoAlpha: 0,
          scale: 1.5,
        });
        expect(endArgs).to.deep.equal({
          duration: 1,
          x: 100,
          autoAlpha: 0,
          scale: 1.5,
        });
      }
    });

    it('cross-fades in place for "fade"', () => {
      const { startArgs, endArgs } = carouselTransitionArgs('fade');
      expect(startArgs).to.deep.equal({ duration: 1, autoAlpha: 0 });
      expect(endArgs).to.deep.equal({ duration: 1, autoAlpha: 0 });
    });
  });

  describe('preloadCarouselImages', () => {
    it('waits for decoding and falls back to load events on legacy engines', async () => {
      let finishDecode!: () => void;
      const images: HTMLImageElement[] = [];
      let complete = false;
      const loading = preloadCarouselImages(['a', 'b'], () => {
        const image = {
          complete: false,
          naturalWidth: 0,
          ...(images.length === 0
            ? {
                decode: () =>
                  new Promise<void>((resolve) => {
                    finishDecode = resolve;
                  }),
              }
            : {}),
        } as HTMLImageElement;
        images.push(image);
        return image;
      }).then(() => {
        complete = true;
      });
      images.forEach((image) => image.onload?.call(image, new Event('load')));
      await flush();
      expect(complete).to.equal(false);
      finishDecode();
      await loading;
      expect(complete).to.equal(true);
    });

    for (const failure of ['error', 'timeout', 'decode']) {
      it(`rejects ${failure} instead of reporting an unloaded image ready`, async () => {
        const clock = useFakeTimers();
        const images: HTMLImageElement[] = [];
        try {
          const loading = preloadCarouselImages(['a'], () => {
            const image = {
              complete: false,
              naturalWidth: 0,
              ...(failure === 'decode'
                ? { decode: () => Promise.reject(new Error('decode failed')) }
                : {}),
            } as HTMLImageElement;
            images.push(image);
            return image;
          }).then(
            () => undefined,
            (error: Error) => error
          );
          if (failure === 'error')
            images[0].onerror?.call(images[0], new Event('error'));
          if (failure === 'decode')
            images[0].onload?.call(images[0], new Event('load'));
          if (failure === 'timeout') await clock.tickAsync(30000);
          expect(await loading).to.be.instanceOf(Error);
          expect(images[0].onload).to.equal(null);
        } finally {
          clock.restore();
        }
      });
    }
  });

  describe('resolveCarouselImageUrls', () => {
    it('keeps image order and falls back to the original URL', async () => {
      const delays: Record<string, number> = { a: 20, b: 0, c: 5, d: 0 };
      const resourceManager = {
        getMedia: (url: string) =>
          new Promise<string | void>((resolve, reject) =>
            setTimeout(() => {
              if (url === 'c') reject(new Error('quota exceeded'));
              else resolve(url === 'b' ? undefined : `cached:${url}`);
            }, delays[url])
          ),
      };

      const { result, warnings } = await silenceWarnings(() =>
        resolveCarouselImageUrls(resourceManager as any, ['a', 'b', 'c', 'd'])
      );

      expect(result).to.deep.equal(['cached:a', 'b', 'c', 'cached:d']);
      expect(warnings).to.have.length(2);
      expect(warnings[0]).to.contain('using original URL');
      expect(warnings[1]).to.contain('using original URL');
    });

    it('falls back when a cache lookup never settles', async () => {
      const clock = useFakeTimers();
      try {
        const resourceManager = {
          getMedia: (url: string) =>
            url === 'stalled'
              ? new Promise<string>(() => {})
              : Promise.resolve(`cached:${url}`),
        };
        const urlsPromise = silenceWarnings(() =>
          resolveCarouselImageUrls(resourceManager as any, ['stalled', 'ready'])
        );

        await clock.tickAsync(5000);
        const { result, warnings } = await urlsPromise;
        expect(result).to.deep.equal(['stalled', 'cached:ready']);
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.contain('using original URL');
      } finally {
        clock.restore();
      }
    });
  });

  describe('ImageCarouselComponent.resolveOptions', () => {
    it('resolves bindings, including the transition', () => {
      const opts = ImageCarouselComponent.resolveOptions(
        {
          images: { key: 'data.images' },
          imageDuration: { key: 'options.duration' },
          transition: { key: 'options.transition' },
        },
        {
          options: { duration: 4, transition: 'fade' },
          data: { images: ['x', 'y'] },
        } as any,
        {},
        {} as any
      );
      expect(opts).to.deep.equal({
        images: ['x', 'y'],
        imageDuration: 4,
        transition: 'fade',
      });
    });

    it('treats missing images as an empty carousel', () => {
      const component = ImageCarouselComponent.fromJSON({
        name: 'carousel',
        opts: { images: { key: 'data.images' }, imageDuration: 5 },
      });
      const opts = ImageCarouselComponent.resolveOptions(
        component.opts,
        { options: {}, data: {} } as any,
        {},
        {} as any
      );
      expect(opts.images).to.deep.equal([]);
      expect(component.resolveDuration({})).to.equal(0);
    });
  });

  describe('rendering', () => {
    const globals = globalThis as any;
    const saved: Record<string, unknown> = {};
    const keys = [
      'window',
      'document',
      'Node',
      'HTMLElement',
      'Element',
      'Image',
    ];
    let dom: any;

    beforeEach(() => {
      dom = new JSDOM('<!doctype html><div id="root"></div>');
      keys.forEach((key) => {
        saved[key] = globals[key];
        globals[key] = key === 'window' ? dom.window : dom.window[key];
      });
      // gsap reads computed styles; it may still tick after the test ends.
      globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
      globals.Image = class {
        complete = true;
        naturalWidth = 100;
        onload = null;
        onerror = null;
        src = '';
      };
    });

    afterEach(() => {
      keys.forEach((key) => {
        globals[key] = saved[key];
      });
    });

    it('renders and preloads exact cached bytes through reusable, render-only blob URLs', async () => {
      const source =
        'data:image/png;charset=iso-8859-1;castmill-revision=123;base64,AAECA/7/';
      const blobs: Blob[] = [];
      const revoked: string[] = [];
      dom.window.URL.createObjectURL = (blob: Blob) => {
        blobs.push(blob);
        return `blob:carousel-${blobs.length}`;
      };
      dom.window.URL.revokeObjectURL = (url: string) => revoked.push(url);
      const preloads: Array<{ src: string }> = [];
      globals.Image = class {
        complete = true;
        naturalWidth = 100;
        onload = null;
        onerror = null;
        src = '';
        constructor() {
          preloads.push(this);
        }
      };
      const lookups: string[] = [];
      const widget = new TemplateWidget(
        {
          getMedia: async (url: string) => {
            lookups.push(url);
            return source;
          },
        } as any,
        {
          widget: {
            name: 'binary-carousel',
            template: {
              type: 'image-carousel',
              name: 'binary-carousel',
              opts: {
                images: ['https://img/1', 'https://img/2'],
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      try {
        await firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        await flush();
        expect(blobs).to.have.length(1);
        expect(blobs[0].type).to.equal(
          'image/png;charset=iso-8859-1;castmill-revision=123'
        );
        const bytes = await new Promise<Uint8Array>((resolve, reject) => {
          const reader = new dom.window.FileReader();
          reader.onload = () =>
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(blobs[0]);
        });
        expect(Array.from(bytes)).to.deep.equal([0, 1, 2, 3, 254, 255]);
        const images = dom.window.document.querySelectorAll(
          '[data-component="image"]'
        );
        expect(images[0].style.backgroundImage).to.contain('blob:carousel-1');
        expect(images[1].style.backgroundImage).to.contain('blob:carousel-1');
        expect(preloads[0].src).to.equal('blob:carousel-1');
        await firstValueFrom(widget.seek(6500));
        expect(images[1].style.opacity).to.equal('1');
        expect(revoked).to.deep.equal([]);
        expect(lookups).to.deep.equal(['https://img/1', 'https://img/2']);
      } finally {
        await widget.unload();
      }
      expect(revoked).to.deep.equal(['blob:carousel-1']);
    });

    for (const firstToUnload of [0, 1]) {
      it(`reuses overlapping widget images until owner ${1 - firstToUnload} also unloads`, async () => {
        const created: Blob[] = [];
        const revoked: string[] = [];
        dom.window.URL.createObjectURL = (blob: Blob) => {
          created.push(blob);
          return `blob:shared-${created.length}`;
        };
        dom.window.URL.revokeObjectURL = (url: string) => revoked.push(url);
        const resourceManager = {
          getMedia: async () => 'data:image/png;base64,AA==',
        };
        const roots = [0, 1].map(() => {
          const root = dom.window.document.createElement('div');
          dom.window.document.getElementById('root').appendChild(root);
          return root;
        });
        const widgets = roots.map(
          (_root, index) =>
            new TemplateWidget(resourceManager as any, {
              widget: {
                name: `overlapping-${index}`,
                template: {
                  type: 'image-carousel',
                  name: `overlapping-${index}`,
                  opts: { images: ['https://img/1'], imageDuration: 5 },
                },
              } as any,
              config: { options: {}, data: {} } as any,
              globals: { target: 'poster' },
            })
        );
        try {
          for (let index = 0; index < widgets.length; index++) {
            await firstValueFrom(widgets[index].show(roots[index], 0));
          }
          expect(created).to.have.length(1);
          await widgets[firstToUnload].unload();
          expect(revoked).to.deep.equal([]);
          expect(
            roots[1 - firstToUnload].querySelector('[data-component="image"]')
              .style.backgroundImage
          ).to.contain('blob:shared-1');
          await widgets[1 - firstToUnload].unload();
          expect(revoked).to.deep.equal(['blob:shared-1']);

          await firstValueFrom(widgets[0].show(roots[0], 0));
          expect(created).to.have.length(2);
        } finally {
          for (const widget of widgets) await widget.unload();
        }
        expect(revoked).to.deep.equal(['blob:shared-1', 'blob:shared-2']);
      });
    }

    it('keeps cached data URLs usable without Blob URL support', async () => {
      const source = 'data:image/png;base64,AA==';
      const widget = new TemplateWidget(
        { getMedia: async () => source } as any,
        {
          widget: {
            name: 'unsupported-blob-carousel',
            template: {
              type: 'image-carousel',
              name: 'unsupported-blob-carousel',
              opts: { images: ['https://img/1'], imageDuration: 5 },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'poster' },
        }
      );
      try {
        await firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        expect(
          dom.window.document.querySelector('[data-component="image"]').style
            .backgroundImage
        ).to.contain(source);
      } finally {
        await widget.unload();
      }
    });

    it('does not allocate blob URLs for late preview loads after cleanup', async () => {
      const created: Blob[] = [];
      const revoked: string[] = [];
      dom.window.URL.createObjectURL = (blob: Blob) => {
        created.push(blob);
        return `blob:preview-${created.length}`;
      };
      dom.window.URL.revokeObjectURL = (url: string) => revoked.push(url);
      let resolveLater: ((url: string) => void) | undefined;
      const widget = new TemplateWidget(
        {
          getMedia: (url: string) =>
            url.endsWith('/1')
              ? Promise.resolve('data:image/png;base64,AA==')
              : new Promise<string>((resolve) => {
                  resolveLater = resolve;
                }),
        } as any,
        {
          widget: {
            name: 'late-blob-carousel',
            template: {
              type: 'image-carousel',
              name: 'late-blob-carousel',
              opts: {
                images: ['https://img/1', 'https://img/2'],
                imageDuration: 5,
              },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      await firstValueFrom(
        widget.show(dom.window.document.getElementById('root'), 0)
      );
      await widget.unload();
      resolveLater!('data:image/png;base64,AQ==');
      await flush();
      expect(created).to.have.length(1);
      expect(revoked).to.deep.equal(['blob:preview-1']);
    });

    it('does not clear transforms on fresh carousel images', async () => {
      const prototype = dom.window.CSSStyleDeclaration.prototype;
      const removeProperty = prototype.removeProperty;
      let transformClears = 0;
      prototype.removeProperty = function (property: string) {
        if (property === 'transform' && this.backgroundImage) transformClears++;
        return removeProperty.call(this, property);
      };
      const widget = new TemplateWidget(
        { getMedia: async (url: string) => url } as any,
        {
          widget: {
            name: 'fresh-carousel',
            template: {
              type: 'image-carousel',
              name: 'fresh-carousel',
              opts: {
                images: ['https://img/1', 'https://img/2'],
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'poster' },
        }
      );
      try {
        await firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        expect(transformClears).to.equal(0);
      } finally {
        await widget.unload();
        prototype.removeProperty = removeProperty;
      }
    });

    it('bounds a large gallery to the current and next photos, releasing images on seeks and unload', async () => {
      let created = 0;
      const live = new Set<string>();
      dom.window.URL.createObjectURL = () => {
        const url = `blob:bounded-${++created}`;
        live.add(url);
        expect(live.size).to.be.at.most(2);
        return url;
      };
      dom.window.URL.revokeObjectURL = (url: string) => live.delete(url);
      const sources = Array.from(
        { length: 30 },
        (_value, index) => `photo-${index}`
      );
      const widget = new TemplateWidget(
        {
          getMedia: async (url: string) =>
            `data:image/png;base64,${dom.window.btoa(url)}`,
        } as any,
        {
          widget: {
            name: 'large-gallery',
            template: {
              type: 'image-carousel',
              name: 'large-gallery',
              opts: { images: sources, imageDuration: 5, transition: 'fade' },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'poster' },
        }
      );
      try {
        await firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        await flush();
        const images = Array.from(
          dom.window.document.querySelectorAll('[data-component="image"]')
        ) as HTMLElement[];
        const assigned = () =>
          images.filter((image) => image.style.backgroundImage).length;
        expect(assigned()).to.equal(2);
        expect(
          images.filter((image) => image.style.display !== 'none')
        ).to.have.length(2);
        expect(created).to.equal(2);
        expect(widget.duration()).to.equal(180000);
        for (const index of [2, 8, 29, 0]) {
          await firstValueFrom(widget.seek(index * 6000 + 2000));
          await flush();
          expect(images[index].style.backgroundImage).not.to.equal('');
          expect(images[index].style.opacity, `photo ${index}`).to.equal('1');
          expect(assigned()).to.be.at.most(2);
          expect(
            images.filter((image) => image.style.display !== 'none')
          ).to.have.length(2);
          expect(live.size).to.be.at.most(2);
        }
      } finally {
        await widget.unload();
      }
      expect(live.size).to.equal(0);
    });

    it('holds the decoded photo and extends playback while the next photo is still loading', async () => {
      const preloads: Array<{ onload: (() => void) | null }> = [];
      globals.Image = class {
        complete = false;
        naturalWidth = 0;
        onload: (() => void) | null = null;
        onerror = null;
        src = '';
        constructor() {
          preloads.push(this);
        }
      };
      const widget = new TemplateWidget(
        { getMedia: async (url: string) => url } as any,
        {
          widget: {
            name: 'slow-gallery',
            template: {
              type: 'image-carousel',
              name: 'slow-gallery',
              opts: {
                images: ['/one', '/two', '/three'],
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      const shown = firstValueFrom(
        widget.show(dom.window.document.getElementById('root'), 0)
      );
      await flush();
      preloads[0].onload?.();
      await shown;
      await flush();
      const images = dom.window.document.querySelectorAll(
        '[data-component="image"]'
      );
      const clock = useFakeTimers({
        toFake: ['Date', 'setInterval', 'clearInterval'],
      });
      const timer = new Subject<number>();
      const playing = widget.play(timer).subscribe();
      try {
        await clock.tickAsync(7000);
        expect(images[0].style.opacity).to.equal('1');
        expect(Number(images[1].style.opacity)).to.equal(0);
        expect(widget.duration()).to.be.greaterThan(19000);
        expect(preloads).to.have.length(2);
        preloads[1].onload?.();
        await flush();
        await clock.tickAsync(500);
        expect(Number(images[0].style.opacity)).to.be.within(0, 1);
        expect(Number(images[1].style.opacity)).to.be.within(0, 1);
        await clock.tickAsync(600);
        expect(images[1].style.opacity).to.equal('1');
        expect(images[0].style.backgroundImage).to.equal('');
        expect(preloads).to.have.length(3);
      } finally {
        playing.unsubscribe();
        await widget.stop();
        await widget.unload();
        clock.restore();
      }
    });

    it('waits for a distant seek and cancels evicted and unloaded image preparations', async () => {
      const preloads: Array<{ src: string; onload: (() => void) | null }> = [];
      globals.Image = class {
        complete = false;
        naturalWidth = 0;
        src = '';
        onload: (() => void) | null = null;
        onerror = null;
        constructor() {
          preloads.push(this);
        }
      };
      const widget = new TemplateWidget(
        { getMedia: async (url: string) => url } as any,
        {
          widget: {
            name: 'seek-gallery',
            template: {
              type: 'image-carousel',
              name: 'seek-gallery',
              opts: {
                images: Array.from(
                  { length: 10 },
                  (_value, index) => `/photo-${index}`
                ),
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: { options: {}, data: {} } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      try {
        const shown = firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        await flush();
        preloads[0].onload?.();
        await shown;
        await flush();
        const images = Array.from(
          dom.window.document.querySelectorAll('[data-component="image"]')
        ) as HTMLElement[];
        let sought = false;
        const seeking = firstValueFrom(widget.seek(32000)).then(() => {
          sought = true;
        });
        await flush();
        expect(sought).to.equal(false);
        expect(preloads[1].src).to.equal('');
        expect(preloads[1].onload).to.equal(null);
        expect(preloads[2].src).to.equal('/photo-5');
        expect(images[0].style.opacity).to.equal('1');
        expect(
          images.filter((image) => image.style.backgroundImage)
        ).to.have.length(2);
        preloads[2].onload?.();
        await seeking;
        await flush();
        expect(images[5].style.opacity).to.equal('1');
        expect(images[0].style.backgroundImage).to.equal('');
        expect(preloads[0].src).to.equal('');
        expect(preloads[3].src).to.equal('/photo-6');
        preloads[3].onload?.();
        await flush();
        await firstValueFrom(widget.seek(35500));
        expect(Number(images[5].style.opacity)).to.be.within(0.01, 0.99);
        const nextSeek = firstValueFrom(widget.seek(44000));
        await flush();
        expect(images[5].style.opacity).to.equal('1');
        expect(images[6].style.display).to.equal('none');
        preloads[4].onload?.();
        await nextSeek;
        await flush();
        const lateLoad = preloads[5].onload;
        await widget.unload();
        expect(preloads.every((image) => image.src === '')).to.equal(true);
        lateLoad?.();
        await flush();
        expect(preloads).to.have.length(6);
        expect(
          dom.window.document.querySelector('[data-component="image-carousel"]')
        ).to.equal(null);
      } finally {
        await widget.unload();
      }
    });

    it('cross-fades images in order even when downloads finish out of order', async function () {
      this.timeout(6000);
      const delays: Record<string, number> = {
        'https://img/1': 15,
        'https://img/2': 0,
        'https://img/3(1).jpg': 5,
      };
      const resourceManager = {
        getMedia: (url: string) =>
          new Promise<string | void>((resolve) =>
            setTimeout(
              () =>
                resolve(
                  url === 'https://img/3(1).jpg' ? undefined : `blob:${url}`
                ),
              delays[url]
            )
          ),
      };
      const widget = new TemplateWidget(resourceManager as any, {
        widget: {
          name: 'carousel',
          template: {
            type: 'image-carousel',
            name: 'carousel',
            opts: {
              images: { key: 'data.images' },
              imageDuration: 5,
              transition: 'fade',
            },
          },
        } as any,
        config: {
          options: {},
          data: {
            images: ['https://img/1', 'https://img/2', 'https://img/3(1).jpg'],
          },
        } as any,
        globals: { target: 'poster' },
      });
      const el = dom.window.document.getElementById('root');

      const { warnings } = await silenceWarnings(async () => {
        const shown = firstValueFrom(widget.show(el, 0));
        await new Promise((resolve) => setTimeout(resolve, 30));
        await flush();
        return shown;
      });
      expect(warnings).to.have.length(0);

      const images = el.querySelectorAll('[data-component="image"]');
      expect(images.length).to.equal(3);
      expect(images[0].style.backgroundImage).to.contain('blob:https://img/1');
      expect(images[0].style.opacity).to.equal('1');
      expect(images[1].style.backgroundImage).to.contain('blob:https://img/2');
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(images[0].style.opacity).to.equal('1');
      expect(images[0].style.visibility).to.not.equal('hidden');
      await firstValueFrom(widget.seek(0));
      expect(images[0].style.backgroundImage).to.contain('blob:https://img/1');
      expect(images[0].style.opacity).to.equal('1');

      // Fade keeps images in place: no slide or zoom transforms.
      const { warnings: laterWarnings } = await silenceWarnings(async () => {
        await firstValueFrom(widget.seek(6500));
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      expect(laterWarnings).to.have.length(1);
      expect(images[1].style.backgroundImage).to.contain('blob:https://img/2');
      expect(images[1].style.opacity).to.equal('1');
      expect(images[0].style.visibility).to.equal('hidden');
      expect(images[0].style.backgroundImage).to.equal('');
      expect(images[1].style.transform).to.equal('');

      // The image that could not be cached plays from its original URL.
      await firstValueFrom(widget.seek(13000));
      expect(images[2].style.backgroundImage).to.contain(
        'url("https://img/3(1).jpg")'
      );
      expect(images[2].style.backgroundImage).to.not.contain('blob:');

      // Halfway through the loop back to the first image both are visible.
      await firstValueFrom(widget.seek(17500));
      expect(Number(images[0].style.opacity)).to.be.within(0.5, 1);
      expect(Number(images[2].style.opacity)).to.be.within(0, 0.5);
      widget.stop();
    });

    for (const count of [1, 2]) {
      it(`${count === 1 ? 'loops back' : 'holds the last image'} at the end of a ${count}-widget playlist item`, async () => {
        const resourceManager = { getMedia: async (url: string) => url };
        const playlist = Playlist.fromJSON(
          {
            name: 'carousel-boundary',
            items: Array.from({ length: count }, (_value, index) => ({
              name: `carousel-${index}`,
              widget: {
                name: `carousel-${index}`,
                template: {
                  type: 'image-carousel',
                  name: `carousel-${index}`,
                  opts: {
                    images: ['https://img/1', 'https://img/2', 'https://img/3'],
                    imageDuration: 5,
                    transition: 'fade',
                  },
                },
              },
              config: { options: {}, data: {} },
            })),
          } as any,
          resourceManager as any,
          { target: 'preview', freezePreviewDuringLoad: true }
        );
        const root = dom.window.document.getElementById('root');
        const renderer = new Renderer(root);
        try {
          await firstValueFrom(playlist.show(renderer));
          const images = root.querySelectorAll('[data-component="image"]');
          expect(playlist.layers[0].duration()).to.equal(18000);
          await firstValueFrom(playlist.layers[0].seek(17500));
          if (count === 1) {
            expect(Number(images[0].style.opacity)).to.be.within(0.5, 1);
            expect(Number(images[2].style.opacity)).to.be.within(0, 0.5);
          } else {
            expect(Number(images[0].style.opacity)).to.equal(0);
            expect(Number(images[2].style.opacity)).to.equal(1);
            await firstValueFrom(playlist.layers[0].seek(20000));
            expect(Number(images[0].style.opacity)).to.equal(0);
            expect(Number(images[2].style.opacity)).to.equal(1);

            const clock = useFakeTimers();
            const timer = new Subject<number>();
            const playing = playlist.layers[0].play(timer).subscribe();
            try {
              await clock.tickAsync(2000);
              expect(Number(images[0].style.opacity)).to.equal(0);
              expect(Number(images[2].style.opacity)).to.equal(1);
            } finally {
              playing.unsubscribe();
              await playlist.layers[0].stop();
              clock.restore();
            }
          }
        } finally {
          playlist.unload();
          renderer.clean();
        }
      });
    }

    it('does not show the carousel until the incoming image has loaded', async () => {
      const preloads: Array<{ onload: ((event: Event) => void) | null }> = [];
      globals.Image = class {
        complete = false;
        naturalWidth = 0;
        onload: ((event: Event) => void) | null = null;
        onerror = null;
        src = '';
        constructor() {
          preloads.push(this);
        }
      };
      const widget = new TemplateWidget(
        { getMedia: async (url: string) => url } as any,
        {
          widget: {
            name: 'carousel',
            template: {
              type: 'image-carousel',
              name: 'carousel',
              opts: {
                images: { key: 'data.images' },
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: {
            options: {},
            data: { images: ['https://img/1', 'https://img/2'] },
          } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      let shown = false;
      const show = firstValueFrom(
        widget.show(dom.window.document.getElementById('root'), 0)
      ).then(() => {
        shown = true;
      });
      await flush();
      expect(shown).to.equal(false);
      expect(preloads).to.have.length(1);
      preloads[0].onload?.(new Event('load'));
      await show;
      expect(shown).to.equal(true);
      const images = dom.window.document.querySelectorAll(
        '[data-component="image"]'
      );
      expect(images[0].style.opacity).to.equal('1');
      const seeking = firstValueFrom(widget.seek(5500));
      await flush();
      preloads[1].onload?.(new Event('load'));
      await seeking;
      expect(Number(images[0].style.opacity)).to.be.greaterThan(0);
      expect(Number(images[1].style.opacity)).to.be.greaterThan(0);
      await widget.unload();
    });

    it('shows the first preview image without waiting for later cache lookups', async () => {
      let resolveLater: ((url: string) => void) | undefined;
      const widget = new TemplateWidget(
        {
          getMedia: (url: string) =>
            url.endsWith('/1')
              ? Promise.resolve('blob:first')
              : new Promise<string>((resolve) => {
                  resolveLater = resolve;
                }),
        } as any,
        {
          widget: {
            name: 'carousel',
            template: {
              type: 'image-carousel',
              name: 'carousel',
              opts: {
                images: { key: 'data.images' },
                imageDuration: 5,
                transition: 'fade',
              },
            },
          } as any,
          config: {
            options: {},
            data: { images: ['https://img/1', 'https://img/2'] },
          } as any,
          globals: { target: 'preview', freezePreviewDuringLoad: true },
        }
      );
      try {
        await firstValueFrom(
          widget.show(dom.window.document.getElementById('root'), 0)
        );
        const images = dom.window.document.querySelectorAll(
          '[data-component="image"]'
        );
        expect(images[0].style.backgroundImage).to.contain('blob:first');
        expect(images[0].style.opacity).to.equal('1');
        expect(images[1].style.backgroundImage).to.equal('');
        resolveLater!('blob:second');
        await flush();
        expect(images[1].style.backgroundImage).to.contain('blob:second');
        await firstValueFrom(widget.seek(6500));
        expect(images[1].style.opacity).to.equal('1');
      } finally {
        await widget.unload();
      }
    });

    for (const loop of [false, true]) {
      it(`waits for device images before starting a ${loop ? 'looping' : 'finite'} playlist slot`, async () => {
        let preloadCount = 0;
        const preloads: Array<{ onload: (() => void) | null }> = [];
        globals.Image = class {
          complete = false;
          naturalWidth = 0;
          onload: (() => void) | null = null;
          onerror = null;
          src = '';
          constructor() {
            preloadCount++;
            preloads.push(this);
          }
        };
        const resourceManager = { getMedia: async (url: string) => url };
        const makeWidget = (name: string, template: object) =>
          new TemplateWidget(resourceManager as any, {
            widget: { name, template } as any,
            config: {
              options: {},
              data: { images: ['https://img/1', 'https://img/2'] },
            } as any,
            globals: { target: 'poster' },
          });
        const carousel = makeWidget('carousel', {
          type: 'image-carousel',
          name: 'carousel',
          opts: {
            images: { key: 'data.images' },
            imageDuration: 5,
            transition: 'fade',
          },
        });
        const next = makeWidget('next', {
          type: 'text',
          name: 'next',
          opts: { text: 'next' },
        });
        const playlist = new Playlist('test', resourceManager as any);
        playlist.add(
          new Layer('carousel', { duration: 2000, widget: carousel })
        );
        playlist.add(new Layer('next', { duration: 2000, widget: next }));
        const renderer = new Renderer(
          dom.window.document.getElementById('root')
        );
        const timer = new Subject<number>();
        const subscription = playlist
          .play(renderer, timer, { loop })
          .subscribe();
        try {
          await flush();
          await flush();
          expect(preloadCount).to.equal(1);
          expect(renderer.getCurrentLayer()).to.equal(undefined);
          preloads.forEach((image) => image.onload?.());
          await flush();
          await flush();
          expect(renderer.getCurrentLayer()).to.equal(playlist.layers[0]);
          const first = dom.window.document.querySelector(
            '[data-layer="carousel"]'
          );
          expect(first).not.to.equal(null);
          timer.next(0);
          timer.next(1000);
          expect(
            dom.window.document.querySelector('[data-layer="next"]')
          ).to.equal(null);
          timer.next(2000);
          await flush();
          await flush();
          expect(
            dom.window.document.querySelector('[data-layer="next"]')
          ).not.to.equal(null);
          expect(
            dom.window.document.querySelector('[data-layer="carousel"]')
          ).to.equal(null);
        } finally {
          subscription.unsubscribe();
          playlist.unload();
        }
      });
    }
  });
});
