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
}

export const Image: Component<ImageProps> = (props: ImageProps) => {
  let imageRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;
  let loadId = 0;
  let hasReportedReady = false;

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
    loadId++;
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
    if (!imageRef) return;

    if (!sourceUrl) {
      imageRef.style.backgroundImage = '';
      if (!hasReportedReady) {
        hasReportedReady = true;
        props.onReady();
      }
      return;
    }

    void props.resourceManager
      .getMedia(sourceUrl)
      .then((cachedUrl) => {
        if (currentLoad !== loadId || !imageRef) return;
        if (!cachedUrl) {
          console.warn(
            `Image ${sourceUrl} not found in cached medias, using original URL`
          );
        }
        imageRef.style.backgroundImage = `url(${cachedUrl || sourceUrl})`;
        if (!hasReportedReady) {
          hasReportedReady = true;
          props.onReady();
        }
      })
      .catch((error) => {
        if (currentLoad !== loadId || !imageRef) return;
        console.warn(`Image ${sourceUrl} could not be loaded`, error);
        imageRef.style.backgroundImage = `url(${sourceUrl})`;
        if (!hasReportedReady) {
          hasReportedReady = true;
          props.onReady();
        }
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
