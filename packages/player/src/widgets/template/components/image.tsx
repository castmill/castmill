import gsap from "gsap";

import { Component, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { TemplateComponent, TemplateComponentType } from "./group";

export class ImageComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Image;

  constructor(
    public name: string,
    public url: string,
    public style: JSX.CSSProperties,
    public binding?: string,
    public classes?: string
  ) {}
}

export const Image: Component<{
  name: string;
  url: string;
  timeline: GSAPTimeline;
  style: JSX.CSSProperties;
  mediasMap: { [index: string]: string };
}> = (props) => {
  let imageRef: HTMLDivElement | undefined;

  const timeline: GSAPTimeline = gsap.timeline({ repeat: -1, yoyo: true });
  props.timeline.add(timeline);

  const merged = mergeProps(
    {
      width: "100%",
      height: "100%",
      "background-image": `url(${props.mediasMap[props.url]})`,
      "background-size": "cover", // "contain",
      "background-repeat": "no-repeat",
      "background-position": "center",
    },
    props.style
  );

  onCleanup(() => {
    props.timeline.remove(timeline);
    timeline.kill();
  });

  onMount(() => {
    if (imageRef) {
      timeline.to(imageRef, {
        scale: 1.3,
        duration: 10,
        translateX: "1%",
        translate: "1%",
      });
    }
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
