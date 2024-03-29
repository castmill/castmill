import gsap from 'gsap';

import { Component, For, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { ResourceManager } from '@castmill/cache';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface ImageCarouselComponentOptions {
  images: string[];
  imageDuration: number;
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
    return this.opts.imageDuration * this.opts.images.length;
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
    return {
      images: resolveOption(opts.images, config, context, globals),
      imageDuration: resolveOption(
        opts.imageDuration,
        config,
        context,
        globals
      ),
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
    start: props.timeline.duration(),
    child: timeline,
  };

  props.timeline.add(timelineItem);

  props = mergeProps(
    {
      startArgs: {
        duration: 1,
        x: -100,
        autoAlpha: 0,
        scale: 1.5,
      },
      endArgs: {
        duration: 1,
        x: 100,
        autoAlpha: 0,
        scale: 1.5,
      },
    },
    props
  );

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
    const images = parentRef?.children!;
    const targetArgs = {
      duration: 1,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    if (images && images.length == 1) {
      const imageUrl = await props.resourceManager.getMedia(
        props.opts.images[0]
      );
      timeline.set(
        images[0],
        {
          backgroundImage: `url(${imageUrl})`,
        },
        '<'
      );
      timeline.duration(props.opts.imageDuration);
    }

    if (images && images.length > 1) {
      Array.from(images || []).forEach(async (image, index) => {
        const imageUrl = await props.resourceManager.getMedia(
          props.opts.images[index]
        );
        timeline.set(
          image,
          {
            backgroundImage: `url(${imageUrl})`,
          },
          '<'
        );

        if (index === 0) {
          timeline.set(images[images.length - 1], {
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
        if (index === images.length - 1) {
          const imageUrl = await props.resourceManager.getMedia(
            props.opts.images[0]
          );

          timeline.set(images[0], {
            backgroundImage: `url(${imageUrl})`,
          });
          timeline.from(
            images[0],
            Object.assign({}, props.startArgs),
            position
          );
          position = `<`;
        }
        timeline.to(image, Object.assign({}, props.endArgs), position);
      });
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
