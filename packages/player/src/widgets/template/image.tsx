import {
  Component,
  createEffect,
  createMemo,
  JSX,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';
import { getImageMediaWithTimeout, prepareImage } from './image-loading';

export interface ImageComponentOptions {
  url?: string;
  size?: 'cover' | 'contain';
  duration?: number;
  autozoom?: boolean | 'true' | 'false';
  fallbackUrl?: string;
}

export const getImageBackgroundSize = (opts: ImageComponentOptions) =>
  opts.autozoom === true || opts.autozoom === 'true'
    ? 'cover'
    : opts.size || 'contain';

export class ImageComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Image;

  constructor(
    public name: string,
    public opts: ImageComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return this.opts.duration || 10000;
  }

  static fromJSON(json: any): ImageComponent {
    return new ImageComponent(
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
  ): ImageComponentOptions {
    const resolvedUrl =
      resolveOption(opts.url, config, context, globals) ||
      resolveOption(opts.src, config, context, globals) ||
      '';

    const resolvedFallback =
      resolveOption(opts.fallbackUrl, config, context, globals) ||
      resolveOption(opts.fallback, config, context, globals) ||
      '';

    return {
      url: resolvedUrl,
      fallbackUrl: resolvedFallback,
      size: resolveOption(opts.size, config, context, globals),
      duration: resolveOption(opts.duration, config, context, globals),
      autozoom: resolveOption(opts.autozoom, config, context, globals),
    };
  }
}

interface ImageProps extends BaseComponentProps {
  opts: ImageComponentOptions;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

export const Image: Component<ImageProps> = (props: ImageProps) => {
  let imageRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;
  let loadId = 0;
  let hasReportedReady = false;
  let preparation: ReturnType<typeof prepareImage> | undefined;
  let pending: 'cache lookup' | 'load/decode' | undefined;
  let pendingSince = 0;
  const loadBlock = {};

  const stopObserving = props.globals.observeWidgetPlayback?.(() => {
    if (!pending) return;
    const description = `Image ${pending}`;
    return {
      label: `${description} ${Math.max(0, Date.now() - pendingSince)}ms`,
      pending: description,
    };
  });

  const merged = createMemo(() => {
    const effectiveUrl =
      props.opts.url?.trim?.() || props.opts.fallbackUrl?.trim?.() || '';
    return mergeProps(
      {
        width: '100%',
        height: '100%',
        'background-size': getImageBackgroundSize(props.opts),
        'background-repeat': 'no-repeat',
        'background-position': 'center',
        ...(effectiveUrl ? {} : { 'background-color': 'rgba(0,0,0,0.2)' }),
      },
      props.style
    );
  });

  onCleanup(() => {
    stopObserving?.();
    loadId++;
    preparation?.release();
    props.globals.setPlaybackBlocked?.(loadBlock);
    cleanUpAnimations?.();
  });

  onMount(() => {
    if (imageRef) {
      if (props.animations) {
        cleanUpAnimations = applyAnimations(
          props.timeline,
          props.animations,
          imageRef,
          props.timeline.duration()
        );
      }
    }
  });

  createEffect(() => {
    const sourceUrl =
      props.opts.url?.trim?.() || props.opts.fallbackUrl?.trim?.() || '';
    const currentLoad = ++loadId;
    preparation?.release();
    preparation = undefined;
    pending = undefined;
    props.globals.setPlaybackBlocked?.(loadBlock);
    if (!imageRef) return;

    if (!sourceUrl) {
      imageRef.style.backgroundImage = '';
      if (!hasReportedReady) {
        hasReportedReady = true;
        props.onReady();
      }
      return;
    }

    pending = 'cache lookup';
    pendingSince = Date.now();
    void getImageMediaWithTimeout(props.resourceManager, sourceUrl)
      .catch(() => undefined)
      .then(async (cachedUrl) => {
        if (currentLoad !== loadId || !imageRef) return;
        pending = 'load/decode';
        pendingSince = Date.now();
        if (!cachedUrl) {
          console.warn(
            'Image unavailable from cache; trying the original source'
          );
        }
        imageRef.style.backgroundImage = `url(${cachedUrl || sourceUrl})`;
        const loading = prepareImage(cachedUrl || sourceUrl);
        preparation = loading;
        await loading.ready;
        if (currentLoad !== loadId) return;
        pending = undefined;
        loading.release();
        preparation = undefined;
        if (!hasReportedReady) {
          hasReportedReady = true;
          props.onReady();
        }
      })
      .catch((error) => {
        if (currentLoad !== loadId || !imageRef) return;
        pending = undefined;
        preparation?.release();
        preparation = undefined;
        console.warn('Image could not be loaded', error);
        props.globals.reportError?.({ category: 'media-load', error });
        props.globals.setPlaybackBlocked?.(loadBlock, {
          category: 'media-load',
          error,
        });
      });
  });

  return (
    <div
      ref={imageRef}
      data-component="image"
      data-name={props.name}
      style={merged()}
    ></div>
  );
};
