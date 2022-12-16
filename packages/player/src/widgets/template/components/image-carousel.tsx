import gsap from "gsap";

import { Component, For, JSX, mergeProps, onMount } from "solid-js";
import { TemplateComponent, TemplateComponentType } from "./group";

export class ImageCarouselComponent implements TemplateComponent {
  readonly type = TemplateComponentType.ImageCarousel;

  constructor(
    public name: string,
    public value: string[],
    public imageDuration: number,
    public style: JSX.CSSProperties,
    public binding?: string
  ) {}
}

export const ImageCarousel: Component<{
  name: string;
  value: string[];
  style: JSX.CSSProperties;
  imageDuration: number;
  timeline: GSAPTimeline;
  startArgs?: GSAPTweenVars;
  endArgs?: GSAPTweenVars;
  mediasMap: { [index: string]: string };
}> = (props) => {
  let parentRef: HTMLDivElement | undefined;
  const timeline: GSAPTimeline = gsap.timeline({ repeat: -1 });

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

  props.timeline.add(timeline);

  const style = Object.assign(
    {
      width: "100%",
      height: "100%",
      "background-size": "cover",
      "background-repeat": "no-repeat",
      "background-position": "center",
      position: "absolute",
    },
    props.style
  );

  onMount(() => {
    const images = parentRef?.children!;
    const targetArgs = {
      duration: 1,
      x: 0,
      y: 0,
      autoAlpha: 1,
      scale: 1,
    };

    if (images && images.length == 1) {
      timeline.set(
        images[0],
        { backgroundImage: `url(${props.mediasMap[props.value[0]]})` },
        "<"
      );
      timeline.duration(props.imageDuration);
    }

    if (images && images.length > 1) {
      Array.from(images || []).forEach((image, index) => {
        timeline.set(
          image,
          { backgroundImage: `url(${props.mediasMap[props.value[index]]})` },
          "<"
        );

        if (index === 0) {
          timeline.set(images[images.length - 1], {
            visibility: "hidden",
            backgroundImage: "none",
          });
          timeline.set(image, Object.assign({}, targetArgs));
        } else {
          timeline.from(image, Object.assign({}, props.startArgs), "<");
          timeline.set(images[index - 1], {
            visibility: "hidden",
            backgroundImage: "none",
          });
        }
        // When the last image fades out we need to cross-fade the first image
        let position = `>+=${props.imageDuration}`;
        if (index === images.length - 1) {
          timeline.set(images[0], {
            backgroundImage: `url(${props.mediasMap[props.value[0]]})`,
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
  });

  return (
    <div
      ref={parentRef}
      data-component="image-carousell"
      data-name={props.name}
      style="position: absolute; width: 100%; height: 100%;"
    >
      <For each={props.value}>
        {(item, i) => <div data-component="image" style={style}></div>}
      </For>
    </div>
  );
};
