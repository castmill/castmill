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
import { PlayerGlobals } from '../../interfaces/player-globals.interface';
import { getImageMediaWithTimeout, prepareImage } from './image-loading';
import { TimelineBasic } from './timeline';
export { preloadImages as preloadCarouselImages } from './image-loading';

export type ImageCarouselTransition = 'slide' | 'fade';

export interface ImageCarouselComponentOptions {
  images: string[];
  imageDuration: number;
  transition?: ImageCarouselTransition;
}

const TRANSITION_SECONDS = 1;

interface CarouselImageUrl {
  url: string;
  users: number;
}

const sharedImageUrls = new WeakMap<
  ResourceManager,
  Map<string, CarouselImageUrl>
>();

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
      getImageMediaWithTimeout(resourceManager, url).then(
        (cachedUrl) => cachedUrl || fallbackUrl(url),
        () => fallbackUrl(url)
      )
    )
  );
}

function fallbackUrl(url: string): string {
  console.warn('Carousel image not found in cached media, using original URL');
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
  const timeline: GSAPTimeline = gsap.timeline({ paused: true });

  const style = createMemo(() =>
    Object.assign(
      {
        width: '100%',
        height: '100%',
        'background-size': 'cover',
        'background-repeat': 'no-repeat',
        'background-position': 'center',
        position: 'absolute',
        display: 'none',
      },
      props.style
    )
  );
  let buildId = 0;
  const loadBlock = {};
  let disposed = false;
  let hasBuiltTimeline = false;
  let hasReportedReady = false;
  let previousImageUrls: string[] | undefined;
  let previousImageDuration: number | undefined;
  let previousTransition: string | undefined;
  const objectUrls = new Map<string, CarouselImageUrl>();
  const sharedObjectUrls =
    sharedImageUrls.get(props.resourceManager) ||
    new Map<string, CarouselImageUrl>();
  sharedImageUrls.set(props.resourceManager, sharedObjectUrls);
  interface PreparedImage {
    ready: boolean;
    stage: 'cache lookup' | 'load/decode';
    release?: () => void;
  }
  const prepared = new Map<number, PreparedImage>();
  let sources: string[] = [];
  let images: HTMLElement[] = [];
  let interval: ReturnType<typeof setInterval> | undefined;
  let running = false;
  let position = 0;
  let started = 0;
  let waiting = false;
  let required: number[] = [];
  let waitingSince: number | undefined;
  let waited = 0;
  const preparing = {
    category: 'media-load' as const,
    code: 'carousel-image-preparing',
    error: new Error('Waiting for carousel image'),
  };
  const currentPosition = () =>
    position + (running && !waiting ? Date.now() - started : 0);
  const finishWaiting = () => {
    if (waitingSince !== undefined) waited += Date.now() - waitingSince;
    waitingSince = undefined;
    waiting = false;
    started = Date.now();
    props.globals.setPlaybackReadinessBlocked?.(loadBlock);
  };
  const playback: TimelineBasic & {
    getChildren: GSAPTimeline['getChildren'];
  } = {
    duration: () =>
      timeline.duration() * 1000 +
      waited +
      (waitingSince === undefined ? 0 : Date.now() - waitingSince),
    getChildren: (...args) => timeline.getChildren(...args),
    seek: (offset) => {
      playback.pause();
      if (offset === 0) waited = 0;
      position = Math.max(0, offset - waited);
      syncImages();
    },
    play: (offset) => {
      playback.pause();
      position = Math.max(0, offset - waited);
      running = true;
      started = Date.now();
      if (waiting) waitingSince = started;
      syncImages();
      interval = setInterval(syncImages, 16);
    },
    pause: () => {
      position = currentPosition();
      if (waitingSince !== undefined) waited += Date.now() - waitingSince;
      waitingSince = undefined;
      running = false;
      clearInterval(interval);
      interval = undefined;
    },
  };
  const timelineItem = { start: 0, child: playback };
  props.timeline.add(timelineItem);

  const stopObserving = props.globals.observeWidgetPlayback?.(() => {
    if ((!running && !waiting) || !sources.length) return;
    const slot = ((previousImageDuration || 0) + TRANSITION_SECONDS) * 1000;
    const time = Math.min(currentPosition(), timeline.duration() * 1000);
    const index = Math.min(Math.floor(time / slot), sources.length - 1);
    const canTransition =
      index < sources.length - 1 ||
      (props.globals.loopPlaylistItem !== false && sources.length > 1);
    const state = waiting
      ? ' waiting'
      : canTransition && time - index * slot >= slot - TRANSITION_SECONDS * 1000
        ? ' transitioning'
        : '';
    const pending = waiting
      ? required
          .map((photo) => prepared.get(photo))
          .find((photo) => photo && !photo.ready)
      : undefined;
    const description = pending ? `Carousel photo ${pending.stage}` : undefined;
    return {
      label: `Photo ${index + 1}/${sources.length}${state} (${prepared.size} prepared)${pending ? `: ${pending.stage}` : ''}`,
      pending: description,
    };
  });
  if (stopObserving) onCleanup(stopObserving);

  const releaseImageUrl = (source: string, imageUrl: CarouselImageUrl) => {
    objectUrls.delete(source);
    if (--imageUrl.users === 0) {
      window.URL.revokeObjectURL(imageUrl.url);
      sharedObjectUrls.delete(source);
    }
  };

  const displayImageUrl = (source: string): string => {
    const match = /^data:(image\/[^;,]+(?:;[^,]*)?);base64,/i.exec(source);
    if (
      !match ||
      typeof window.URL?.createObjectURL !== 'function' ||
      typeof window.URL?.revokeObjectURL !== 'function' ||
      typeof window.Blob !== 'function'
    ) {
      return source;
    }
    const existing = objectUrls.get(source);
    if (existing) return existing.url;
    // Incoming widgets overlap their predecessor while preparing. Reuse its
    // decoded bytes without retaining an unbounded, permanent image cache.
    const shared = sharedObjectUrls.get(source);
    if (shared) {
      shared.users++;
      objectUrls.set(source, shared);
      return shared.url;
    }

    try {
      const decoded = window.atob(source.slice(match[0].length));
      const bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < decoded.length; index++) {
        bytes[index] = decoded.charCodeAt(index);
      }
      // Keep megabytes of base64 out of animated CSS; cache identities stay intact.
      const url = window.URL.createObjectURL(
        new window.Blob([bytes], { type: match[1] })
      );
      const imageUrl = { url, users: 1 };
      sharedObjectUrls.set(source, imageUrl);
      objectUrls.set(source, imageUrl);
      return url;
    } catch (error) {
      console.warn(
        'Could not create carousel image object URL, using data URL',
        error
      );
      return source;
    }
  };

  const releaseUnusedUrls = () => {
    const activeBackgrounds = new Set(
      Array.from(
        parentRef?.children || [],
        (child) => (child as HTMLElement).style.backgroundImage
      )
    );
    objectUrls.forEach((imageUrl, dataUrl) => {
      if (!activeBackgrounds.has(backgroundImageUrl(imageUrl.url))) {
        releaseImageUrl(dataUrl, imageUrl);
      }
    });
  };

  const clearPreparedImages = (keep: number[] = []) => {
    prepared.forEach((image, index) => {
      if (keep.indexOf(index) !== -1) return;
      prepared.delete(index);
      image.release?.();
      props.globals.setPlaybackBlocked?.(image);
      if (images[index]) {
        images[index].style.backgroundImage = '';
        // Empty transformed elements can still retain full-size GPU surfaces.
        images[index].style.display = 'none';
      }
    });
    releaseUnusedUrls();
  };

  const prepare = (index: number) => {
    if (prepared.has(index)) return;
    const image: PreparedImage = { ready: false, stage: 'cache lookup' };
    const generation = buildId;
    prepared.set(index, image);
    void resolveCarouselImageUrls(props.resourceManager, [sources[index]])
      .then(async ([source]) => {
        if (generation !== buildId || prepared.get(index) !== image) return;
        const url = displayImageUrl(source);
        image.stage = 'load/decode';
        images[index].style.display = '';
        images[index].style.backgroundImage = backgroundImageUrl(url);
        const loading = prepareImage(url);
        image.release = loading.release;
        await loading.ready;
        if (generation !== buildId || prepared.get(index) !== image) return;
        image.ready = true;
        syncImages();
      })
      .catch((error) => {
        if (generation === buildId && prepared.get(index) === image) {
          reportLoadError(error, image);
        }
      });
  };

  function syncImages() {
    if (disposed || !sources.length) return;
    const time = Math.min(currentPosition(), timeline.duration() * 1000);
    const slot = ((previousImageDuration || 0) + TRANSITION_SECONDS) * 1000;
    const index = Math.min(Math.floor(time / slot), sources.length - 1);
    const local = time - index * slot;
    const next =
      index + 1 < sources.length
        ? index + 1
        : props.globals.loopPlaylistItem !== false && sources.length > 1
          ? 0
          : undefined;
    const transitioning = local >= slot - TRANSITION_SECONDS * 1000;
    required = transitioning && next !== undefined ? [index, next] : [index];
    if (!required.every((item) => prepared.get(item)?.ready)) {
      if (!waiting) {
        position = time;
        waiting = true;
        if (running) waitingSince = Date.now();
      }
      props.globals.setPlaybackReadinessBlocked?.(loadBlock, preparing);
      if (!prepared.get(index)?.ready) {
        // A seek may jump across the gallery. Keep one displayed photo while
        // preparing the target, rather than retaining the whole old window.
        const displayed = Array.from(prepared.keys()).find(
          (candidate) =>
            candidate !== index &&
            images[candidate].style.visibility !== 'hidden' &&
            Number(images[candidate].style.opacity || 1) > 0
        );
        if (displayed !== undefined) {
          timeline.totalTime((displayed * slot) / 1000, true);
        }
        clearPreparedImages(
          displayed === undefined ? [index] : [displayed, index]
        );
        prepare(index);
      } else if (next !== undefined) {
        // Hold the fully loaded photo at the start of its transition.
        timeline.totalTime(
          (index * slot + slot - TRANSITION_SECONDS * 1000) / 1000,
          true
        );
        clearPreparedImages([index, next]);
        prepare(next);
      }
      return;
    }

    position = time;
    started = Date.now();
    if (waiting) finishWaiting();
    timeline.totalTime(time / 1000, true);
    const keep = next === undefined ? [index] : [index, next];
    clearPreparedImages(keep);
    keep.forEach(prepare);
    props.globals.setPlaybackBlocked?.(loadBlock);
    if (!hasReportedReady) {
      hasReportedReady = true;
      props.onReady();
    }
  }

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
    const nextImages = Array.from(parentRef?.children || []) as HTMLElement[];
    const nextSources = imageUrls.slice(0, nextImages.length);
    const retained: Array<[number, PreparedImage, string]> = [];
    prepared.forEach((image, index) => {
      const nextIndex = nextSources.indexOf(sources[index]);
      if (image.ready && nextIndex >= 0 && nextIndex < 2) {
        retained.push([nextIndex, image, images[index].style.backgroundImage]);
        prepared.delete(index);
      }
    });
    images.forEach((image) => {
      image.style.backgroundImage = '';
      image.style.display = 'none';
    });
    retained.forEach(([index, , background]) => {
      nextImages[index].style.backgroundImage = background;
      nextImages[index].style.display = '';
    });
    previousImageUrls = imageUrls.slice();
    previousImageDuration = imageDuration;
    previousTransition = transition;
    const transitionArgs = carouselTransitionArgs(transition);
    ++buildId;
    props.timeline.remove(timelineItem);
    prepared.forEach((image) => {
      image.release?.();
      props.globals.setPlaybackBlocked?.(image);
    });
    prepared.clear();
    releaseUnusedUrls();
    images = nextImages;
    sources = nextSources;
    retained.forEach(([index, image]) => prepared.set(index, image));
    position = 0;
    waited = 0;
    finishWaiting();
    timeline.pause(0);
    timeline.clear();

    images.forEach((image) => {
      // Fresh, unstyled images need no CSSPlugin initialization or layout read.
      if (
        hasBuiltTimeline ||
        image.style.transform ||
        image.style.opacity ||
        image.style.visibility
      ) {
        gsap.set(image, {
          clearProps: 'transform,opacity,visibility',
        });
      }
    });

    const targetArgs = {
      duration: TRANSITION_SECONDS,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    if (sources.length === 1) {
      timeline.set(images[0], Object.assign({}, targetArgs), 0);
      timeline.duration(imageDuration);
    } else if (sources.length > 1) {
      sources.forEach((_url, index) => {
        const image = images[index];

        if (index === 0) {
          timeline.set(images[sources.length - 1], {
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
        if (index === sources.length - 1) {
          if (props.globals.loopPlaylistItem === false) {
            // Keep the slot duration, but hold the last photo until replacement.
            timeline.to({}, { duration: TRANSITION_SECONDS }, position);
            return;
          }
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
    hasBuiltTimeline = true;
    timelineItem.start = props.timeline.isRunning() ? props.timeline.time : 0;
    props.timeline.add(timelineItem);
    if (!sources.length && !hasReportedReady) {
      hasReportedReady = true;
      props.onReady();
    }
    syncImages();
  };

  const reportLoadError = (error: unknown, source: object = loadBlock) => {
    if (disposed) return;
    console.warn('Carousel images could not be prepared', error);
    props.globals.reportError?.({ category: 'media-load', error });
    props.globals.setPlaybackBlocked?.(source, {
      category: 'media-load',
      error,
    });
  };

  onCleanup(() => {
    disposed = true;
    props.globals.setPlaybackBlocked?.(loadBlock);
    props.globals.setPlaybackReadinessBlocked?.(loadBlock);
    buildId++;
    props.timeline.remove(timelineItem);
    clearPreparedImages();
    timeline.kill();
    objectUrls.forEach((imageUrl, source) => releaseImageUrl(source, imageUrl));
  });

  createEffect(() => {
    const loading = buildTimeline();
    const currentBuild = buildId;
    void loading.catch((error) => {
      if (currentBuild === buildId) reportLoadError(error);
    });
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
