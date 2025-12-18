import { Component, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface ImageComponentOptions {
  url: string;
  size: 'cover' | 'contain';
  duration?: number;
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
    return {
      url: resolveOption(opts.url, config, context, globals),
      size: resolveOption(opts.size, config, context, globals),
      duration: resolveOption(opts.duration, config, context, globals),
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

  // const imageUrl = props.medias[props.opts.url];
  const imageUrl = props.opts.url;

  // Gracefully handle missing/empty image URLs - don't crash the player
  const hasValidUrl = imageUrl && imageUrl.trim() !== '';

  const merged = mergeProps(
    {
      width: '100%',
      height: '100%',
      'background-size': props.opts.size,
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
          imageRef
        );
      }

      if (hasValidUrl) {
        let cachedUrl = await props.resourceManager.getMedia(props.opts.url);
        if (!cachedUrl) {
          // Log warning but don't crash - use original URL as fallback
          console.warn(
            `Image ${props.opts.url} not found in cached medias, using original URL`
          );
        }
        imageRef.style.backgroundImage = `url(${cachedUrl || props.opts.url})`;
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
