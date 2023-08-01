import { Component, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { TemplateConfig, resolveOption } from "./binding";
import { TemplateComponent, TemplateComponentType } from "./template";
import { Timeline, TimelineItem } from "./timeline";
import { ComponentAnimation, applyAnimations } from "./animation";

export interface ImageComponentOptions {
  url: string;
  size: "cover" | "contain";
  duration: number;
}

export class ImageComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Image;

  constructor(
    public name: string,
    public opts: ImageComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[]
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return this.opts.duration;
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
      duration: resolveOption(opts.duration, config, context),
    };
  }
}

interface ImageProps {
  name: string;
  opts: ImageComponentOptions;
  timeline: Timeline;
  animations?: ComponentAnimation[];
  style: JSX.CSSProperties;
  medias: { [index: string]: string };
  onReady: () => void;
}

export const Image: Component<ImageProps> = (props: ImageProps) => {
  let imageRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;

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
    cleanUpAnimations && cleanUpAnimations();
  });

  onMount(() => {
    if (imageRef && props.animations) {
      cleanUpAnimations = applyAnimations(
        props.timeline,
        props.animations,
        imageRef
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
