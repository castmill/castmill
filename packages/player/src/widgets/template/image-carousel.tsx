import gsap from 'gsap';

import {
  Component,
  createEffect,
  createMemo,
  For,
  JSX,
  onCleanup,
} from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import {
  isPreviewLoadFrozen,
  PlayerGlobals,
} from '../../interfaces/player-globals.interface';

export type ImageCarouselTransition = 'slide' | 'fade';

export interface ImageCarouselComponentOptions {
  images: string[];
  imageDuration: number;
  transition?: ImageCarouselTransition;
}

const TRANSITION_SECONDS = 1;
const MEDIA_CACHE_TIMEOUT_MS = 5000;
const IMAGE_LOAD_TIMEOUT_MS = 5000;

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
  console.warn('Carousel image not found in cached media, using original URL');
  return url;
}

function backgroundImageUrl(url: string): string {
  const escapedUrl = url.replace(/["\\()]/g, (character) => `\\${character}`);
  return `url("${escapedUrl}")`;
}

export function preloadCarouselImages(
  urls: string[],
  createImage: () => HTMLImageElement = () => new Image()
): Promise<void> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = createImage();
          let settled = false;
          const finish = (error?: string) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            if (error) console.warn(`Carousel image ${error}`);
            resolve();
          };
          const timeout = setTimeout(
            () => finish('load timed out'),
            IMAGE_LOAD_TIMEOUT_MS
          );
          image.onload = () => finish();
          image.onerror = () => finish('could not be loaded');
          image.src = url;
          if (image.complete && image.naturalWidth > 0) finish();
        })
    )
  ).then(() => undefined);
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

  const style = createMemo(() =>
    Object.assign(
      {
        width: '100%',
        height: '100%',
        'background-size': 'cover',
        'background-repeat': 'no-repeat',
        'background-position': 'center',
        position: 'absolute',
      },
      props.style
    )
  );
  let buildId = 0;
  let hasReportedReady = false;
  let previousImageUrls: string[] | undefined;
  let previousImageDuration: number | undefined;
  let previousTransition: string | undefined;

  const buildTimeline = async () => {
    const imageUrls = props.opts.images || [];
    const imageDuration = props.opts.imageDuration;
    const transition = props.opts.transition;
    if (
      previousImageUrls &&
      previousImageDuration === imageDuration &&
      previousTransition === transition &&
      previousImageUrls.length === imageUrls.length &&
      previousImageUrls.every((url, index) => url === imageUrls[index])
    ) {
      return;
    }
    previousImageUrls = imageUrls.slice();
    previousImageDuration = imageDuration;
    previousTransition = transition;
    const transitionArgs = carouselTransitionArgs(transition);
    const currentBuild = ++buildId;
    const images = Array.from(parentRef?.children || []) as HTMLElement[];

    const sources = imageUrls.slice(0, images.length);
    let urls: string[];
    if (isPreviewLoadFrozen(props.globals)) {
      urls = sources.slice();
      const loading = sources.map(async (source, index) => {
        const [url] = await resolveCarouselImageUrls(props.resourceManager, [
          source,
        ]);
        if (currentBuild !== buildId) return;
        urls[index] = url;
        images[index].style.backgroundImage = backgroundImageUrl(url);
        if (index === 0) await preloadCarouselImages([url]);
      });
      // Only the first frame gates a paused preview; later photos load independently.
      await loading[0];
    } else {
      urls = await resolveCarouselImageUrls(props.resourceManager, sources);
      if (currentBuild !== buildId) return;
      urls.forEach((url, index) => {
        images[index].style.backgroundImage = backgroundImageUrl(url);
      });
    }
    // A newer build (the images changed meanwhile) or a cleanup supersedes it.
    if (currentBuild !== buildId) return;

    props.timeline.remove(timelineItem);
    timeline.pause(0);
    timeline.clear();

    images.forEach((image) => {
      // Undo a previous build's transitions, as on a first render.
      gsap.set(image, {
        clearProps: 'transform,opacity,visibility',
      });
    });

    const targetArgs = {
      duration: TRANSITION_SECONDS,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    if (urls.length === 1) {
      timeline.set(images[0], Object.assign({}, targetArgs), 0);
      timeline.duration(imageDuration);
    } else if (urls.length > 1) {
      urls.forEach((_url, index) => {
        const image = images[index];

        if (index === 0) {
          timeline.set(images[urls.length - 1], {
            visibility: 'hidden',
          });
          timeline.set(image, Object.assign({}, targetArgs));
        } else {
          timeline.from(
            image,
            Object.assign({}, props.startArgs || transitionArgs.startArgs),
            '<'
          );
          timeline.set(images[index - 1], {
            visibility: 'hidden',
          });
        }

        // When the last image leaves, the first one comes back in.
        let position = `>+=${imageDuration}`;
        if (index === urls.length - 1) {
          timeline.from(
            images[0],
            Object.assign({}, props.startArgs || transitionArgs.startArgs),
            position
          );
          position = '<';
        }
        timeline.to(
          image,
          Object.assign({}, props.endArgs || transitionArgs.endArgs),
          position
        );
      });
    }

    // Show the first image now: seeking a timeline that is already at 0
    // renders nothing, so it would stay hidden until playback moves.
    timeline.render(0, false, true);
    timelineItem.start = props.timeline.isRunning() ? props.timeline.time : 0;
    props.timeline.add(timelineItem);
    if (!hasReportedReady) {
      hasReportedReady = true;
      props.onReady();
    }
  };

  onCleanup(() => {
    buildId++;
    props.timeline.remove(timelineItem);
    timeline.kill();
  });

  createEffect(() => {
    void buildTimeline();
  });

  return (
    <div
      ref={parentRef}
      data-component="image-carousel"
      data-name={props.name}
      style="position: absolute; width: 100%; height: 100%;"
    >
      <For each={props.opts.images}>
        {(item, i) => <div data-component="image" style={style()}></div>}
      </For>
    </div>
  );
};
