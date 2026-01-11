import { Component, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
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
  autozoom?: boolean;
  fallbackUrl?: string;
}

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

  const primaryUrl = props.opts.url?.trim?.() || '';
  const fallbackUrl = props.opts.fallbackUrl?.trim?.() || '';
  const effectiveUrl = primaryUrl || fallbackUrl;

  // Gracefully handle missing/empty image URLs - don't crash the player
  const hasValidUrl = effectiveUrl !== '';

  // Determine background-size: autozoom uses 'cover' to fill container without black borders
  const backgroundSize = props.opts.autozoom
    ? 'cover'
    : props.opts.size || 'contain';

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
      'background-size': backgroundSize,
      'background-repeat': 'no-repeat',
      'background-position': 'center',
      // Show a subtle placeholder background when no image
      ...(hasValidUrl ? {} : { 'background-color': 'rgba(0,0,0,0.2)' }),
    },
    props.style
  );

  onCleanup(() => {
    cleanUpAnimations && cleanUpAnimations();
  });

  onMount(async () => {
    if (imageRef) {
      if (props.animations) {
        cleanUpAnimations = applyAnimations(
          props.timeline,
          props.animations,
          imageRef,
          props.timeline.duration()
        );
      }

      if (hasValidUrl) {
        const sourceUrl = primaryUrl || fallbackUrl;
        let cachedUrl = sourceUrl
          ? await props.resourceManager.getMedia(sourceUrl)
          : null;
        if (!cachedUrl) {
          // Log warning but don't crash - use original URL as fallback
          console.warn(
            `Image ${sourceUrl} not found in cached medias, using original URL`
          );
        }
        imageRef.style.backgroundImage = `url(${cachedUrl || sourceUrl})`;
      }
      // If no valid URL, just leave the placeholder background
    }
    props.onReady();
  });

  return (
    <div
      ref={imageRef}
      data-component="image"
      data-name={props.name}
      style={merged}
    ></div>
  );
};
