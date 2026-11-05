import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import {
  ImageCarouselComponent,
  TemplateWidget,
  carouselTransitionArgs,
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
      expect(warnings[0]).to.contain('b');
      expect(warnings[1]).to.contain('c');
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
    const keys = ['window', 'document', 'Node', 'HTMLElement', 'Element'];
    let dom: any;

    beforeEach(() => {
      dom = new JSDOM('<!doctype html><div id="root"></div>');
      keys.forEach((key) => {
        saved[key] = globals[key];
        globals[key] = key === 'window' ? dom.window : dom.window[key];
      });
      // gsap reads computed styles; it may still tick after the test ends.
      globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    });

    afterEach(() => {
      keys.forEach((key) => {
        globals[key] = saved[key];
      });
    });

    it('cross-fades images in order even when downloads finish out of order', async () => {
      const delays: Record<string, number> = {
        'https://img/1': 15,
        'https://img/2': 0,
        'https://img/3': 5,
      };
      const resourceManager = {
        getMedia: (url: string) =>
          new Promise<string | void>((resolve) =>
            setTimeout(
              () =>
                resolve(url === 'https://img/3' ? undefined : `blob:${url}`),
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
            images: ['https://img/1', 'https://img/2', 'https://img/3'],
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
      expect(warnings).to.have.length(1);

      const images = el.querySelectorAll('[data-component="image"]');
      expect(images.length).to.equal(3);
      await firstValueFrom(widget.seek(0));
      expect(images[0].style.backgroundImage).to.contain('blob:https://img/1');
      expect(images[0].style.opacity).to.equal('1');

      // Fade keeps images in place: no slide or zoom transforms.
      await firstValueFrom(widget.seek(6500));
      expect(images[1].style.backgroundImage).to.contain('blob:https://img/2');
      expect(images[1].style.opacity).to.equal('1');
      expect(images[0].style.visibility).to.equal('hidden');
      expect(images[1].style.transform).to.equal('');

      // The image that could not be cached plays from its original URL.
      await firstValueFrom(widget.seek(13000));
      expect(images[2].style.backgroundImage).to.contain('https://img/3');
      expect(images[2].style.backgroundImage).to.not.contain('blob:');

      // Halfway through the loop back to the first image both are visible.
      await firstValueFrom(widget.seek(17500));
      expect(Number(images[0].style.opacity)).to.be.within(0.5, 1);
      expect(Number(images[2].style.opacity)).to.be.within(0, 0.5);
      widget.stop();
    });
  });
});
