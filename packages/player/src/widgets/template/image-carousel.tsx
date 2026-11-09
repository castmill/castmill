import gsap from 'gsap';

import { Component, For, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export type ImageCarouselTransition = 'slide' | 'fade';

export interface ImageCarouselComponentOptions {
  images: string[];
  imageDuration: number;
  transition?: ImageCarouselTransition;
}

const TRANSITION_SECONDS = 1;
const MEDIA_CACHE_TIMEOUT_MS = 5000;

/**
 * Tween vars for an image entering (start) and leaving (end) the carousel.
 * "slide" (default) slides and zooms; "fade" cross-fades in place.
 */
export function carouselTransitionArgs(transition?: string): {
  startArgs: GSAPTweenVars;
  endArgs: GSAPTweenVars;
} {
  if (transition === 'fade') {
    return {
      startArgs: { duration: TRANSITION_SECONDS, autoAlpha: 0 },
      endArgs: { duration: TRANSITION_SECONDS, autoAlpha: 0 },
    };
  }
  return {
    startArgs: {
      duration: TRANSITION_SECONDS,
      x: -100,
      autoAlpha: 0,
      scale: 1.5,
    },
    endArgs: { duration: TRANSITION_SECONDS, x: 100, autoAlpha: 0, scale: 1.5 },
  };
}

/**
 * Resolves the cached URL of every image, in order. When an image cannot be
 * cached (e.g. its host sends no CORS headers or storage is full) the original
 * URL is used so it still displays while online.
 */
export function resolveCarouselImageUrls(
  resourceManager: Pick<ResourceManager, 'getMedia'>,
  urls: string[]
): Promise<string[]> {
  return Promise.all(
    urls.map((url) =>
      getMediaWithTimeout(resourceManager, url).then(
        (cachedUrl) => cachedUrl || fallbackUrl(url),
        () => fallbackUrl(url)
      )
    )
  );
}

function getMediaWithTimeout(
  resourceManager: Pick<ResourceManager, 'getMedia'>,
  url: string
): Promise<string | void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve(undefined);
    }, MEDIA_CACHE_TIMEOUT_MS);

    Promise.resolve()
      .then(() => resourceManager.getMedia(url))
      .then(
        (cachedUrl) => {
          if (settled) return;
          clearTimeout(timeout);
          resolve(cachedUrl);
        },
        (error) => {
          if (settled) return;
          clearTimeout(timeout);
          reject(error);
        }
      );
  });
}

function fallbackUrl(url: string): string {
  console.warn(`Image ${url} not found in cached medias, using original URL`);
  return url;
}

function backgroundImageUrl(url: string): string {
  const escapedUrl = url.replace(/["\\()]/g, (character) => `\\${character}`);
  return `url("${escapedUrl}")`;
}

export class ImageCarouselComponent implements TemplateComponent {
  readonly type = TemplateComponentType.ImageCarousel;

  constructor(
    public name: string,
    public opts: ImageCarouselComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    const images = Array.isArray(this.opts.images) ? this.opts.images : [];
    return this.opts.imageDuration * images.length;
  }

  static fromJSON(json: any): ImageCarouselComponent {
    return new ImageCarouselComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter
    );
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): ImageCarouselComponentOptions {
    const images = resolveOption(opts.images, config, context, globals);
    return {
      images: Array.isArray(images) ? images : [],
      imageDuration: resolveOption(
        opts.imageDuration,
        config,
        context,
        globals
      ),
      transition: resolveOption(opts.transition, config, context, globals),
    };
  }
}

interface ImageCarouselProps extends BaseComponentProps {
  config: TemplateConfig;
  context: any;

  opts: ImageCarouselComponentOptions;

  startArgs?: GSAPTweenVars;
  endArgs?: GSAPTweenVars;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

export const ImageCarousel: Component<ImageCarouselProps> = (props) => {
  let parentRef: HTMLDivElement | undefined;
  const timeline: GSAPTimeline = gsap.timeline();
  const timelineItem = {
    start: 0, // Carousel should start immediately, not after other items
    child: timeline,
  };

  props.timeline.add(timelineItem);

  props = mergeProps(carouselTransitionArgs(props.opts.transition), props);

  const style = Object.assign(
    {
      width: '100%',
      height: '100%',
      'background-size': 'cover',
      'background-repeat': 'no-repeat',
      'background-position': 'center',
      position: 'absolute',
    },
    props.style
  );

  onCleanup(() => {
    props.timeline.remove(timelineItem);
    timeline.kill();
  });

  onMount(async () => {
    if (!parentRef) {
      props.onReady();
      return;
    }

    const images = parentRef.children;
    const targetArgs = {
      duration: TRANSITION_SECONDS,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    // Resolve all URLs first so the timeline is built in image order no
    // matter which download finishes first.
    const urls = await resolveCarouselImageUrls(
      props.resourceManager,
      props.opts.images.slice(0, images.length)
    );

    if (urls.length == 1) {
      timeline.set(
        images[0],
        {
          backgroundImage: backgroundImageUrl(urls[0]),
        },
        '<'
      );
      timeline.duration(props.opts.imageDuration);
    }

    if (urls.length > 1) {
      for (let index = 0; index < urls.length; index++) {
        const image = images[index];
        timeline.set(
          image,
          {
            backgroundImage: backgroundImageUrl(urls[index]),
          },
          '<'
        );

        if (index === 0) {
          timeline.set(images[urls.length - 1], {
            visibility: 'hidden',
            backgroundImage: 'none',
          });
          timeline.set(image, Object.assign({}, targetArgs));
        } else {
          timeline.from(image, Object.assign({}, props.startArgs), '<');
          timeline.set(images[index - 1], {
            visibility: 'hidden',
            backgroundImage: 'none',
          });
        }
        // When the last image fades out we need to cross-fade the first image
        let position = `>+=${props.opts.imageDuration}`;
        if (index === urls.length - 1) {
          timeline.set(images[0], {
            backgroundImage: backgroundImageUrl(urls[0]),
          });
          timeline.from(
            images[0],
            Object.assign({}, props.startArgs),
            position
          );
          position = `<`;
        }
        timeline.to(image, Object.assign({}, props.endArgs), position);
      }
    }

    props.onReady();
  });

  return (
    <div
      ref={parentRef}
      data-component="image-carousel"
      data-name={props.name}
      style="position: absolute; width: 100%; height: 100%;"
    >
      <For each={props.opts.images}>
        {(item, i) => <div data-component="image" style={style}></div>}
      </For>
    </div>
  );
};
