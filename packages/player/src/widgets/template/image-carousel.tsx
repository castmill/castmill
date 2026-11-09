import gsap from 'gsap';

import {
  Component,
  createEffect,
  createMemo,
  For,
  JSX,
  mergeProps,
  onCleanup,
} from 'solid-js';
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
    start: 0, // Carousel should start immediately, not after other items
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

  const buildTimeline = async () => {
    const currentBuild = ++buildId;
    const imageUrls = props.opts.images || [];
    const imageDuration = props.opts.imageDuration;
    const images = Array.from(parentRef?.children || []) as HTMLElement[];

    const mediaUrls = await Promise.all(
      imageUrls.map((url) =>
        props.resourceManager.getMedia(url).catch(() => undefined)
      )
    );
    if (currentBuild !== buildId) return;

    props.timeline.remove(timelineItem);
    timeline.pause(0);
    timeline.clear();

    images.forEach((image) => {
      gsap.set(image, { x: 0, y: 0, autoAlpha: 1, scale: 1 });
    });
    images.forEach((image, index) => {
      gsap.set(image, {
        backgroundImage: `url(${mediaUrls[index] || imageUrls[index]})`,
      });
    });

    const targetArgs = {
      duration: 1,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    if (images.length === 1) {
      timeline.set(
        images[0],
        {
          backgroundImage: `url(${mediaUrls[0] || imageUrls[0]})`,
        },
        0
      );
      timeline.duration(imageDuration);
    } else if (images.length > 1) {
      images.forEach((image, index) => {
        timeline.set(
          image,
          {
            backgroundImage: `url(${mediaUrls[index] || imageUrls[index]})`,
          },
          0
        );

        if (index === 0) {
          timeline.set(images[images.length - 1], {
            visibility: 'hidden',
            backgroundImage: 'none',
          });
          timeline.set(image, targetArgs);
        } else {
          timeline.from(image, props.startArgs!, '<');
          timeline.set(images[index - 1], {
            visibility: 'hidden',
            backgroundImage: 'none',
          });
        }

        let position = `>+=${imageDuration}`;
        if (index === images.length - 1) {
          timeline.set(images[0], {
            backgroundImage: `url(${mediaUrls[0] || imageUrls[0]})`,
          });
          timeline.from(images[0], props.startArgs!, position);
          position = '<';
        }
        timeline.to(image, props.endArgs!, position);
      });
    }

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
