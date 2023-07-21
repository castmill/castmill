import gsap from "gsap";

import { Component, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { TemplateConfig, resolveOption } from "./binding";
import { TemplateComponent, TemplateComponentType } from "./template";
import { Timeline, TimelineItem } from "./timeline";

const hackedDuration = 4000;

export interface ImageComponentOptions {
  url: string;
  size: "cover" | "contain";
}

export class ImageComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Image;

  constructor(
    public name: string,
    public opts: ImageComponentOptions,
    public style: JSX.CSSProperties
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return hackedDuration;
  }

  static fromJSON(json: any): ImageComponent {
    return new ImageComponent(json.name, json.opts, json.style);
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any
  ): ImageComponentOptions {
    return {
      url: resolveOption(opts.url, config, context),
      size: resolveOption(opts.size, config, context),
    };
  }
}

export const Image: Component<{
  name: string;
  opts: ImageComponentOptions;
  timeline: Timeline;
  style: JSX.CSSProperties;
  medias: { [index: string]: string };
  onReady: () => void;
}> = (props) => {
  let imageRef: HTMLDivElement | undefined;
  let gsapTimeline: GSAPTimeline;
  let timelineItem: TimelineItem;

  const imageUrl = props.medias[props.opts.url];

  if (!imageUrl) {
    // TODO: Mechanism to report errors without breaking the whole template nor the playlist.
    throw new Error(`Image ${props.opts.url} not found in medias`);
  }

  const merged = mergeProps(
    {
      width: "100%",
      height: "100%",
      "background-image": `url(${imageUrl})`,
      "background-size": props.opts.size,
      "background-repeat": "no-repeat",
      "background-position": "center",
    },
    props.style
  );

  onCleanup(() => {
    props.timeline.remove(timelineItem);
    gsapTimeline?.kill();
  });

  onMount(() => {
    gsapTimeline = gsap.timeline({
      repeat: -1,
      yoyo: true,
      paused: true,
    });

    timelineItem = {
      start: props.timeline.duration(),
      duration: hackedDuration, // Hacked a duration.
      child: gsapTimeline,
    };

    props.timeline.add(timelineItem);

    if (imageRef) {
      gsapTimeline.to(
        imageRef,
        {
          scale: 1.3,
          duration: 1,
          translateX: "1%",
          translate: "1%",
          ease: "power1.inOut",
        },
        0
      );
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
