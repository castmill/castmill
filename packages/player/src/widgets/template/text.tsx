import gsap from "gsap";

import { Component, JSX, mergeProps, onCleanup, onMount } from "solid-js";
import { TemplateConfig, resolveOption } from "./binding";
import { TemplateComponent, TemplateComponentType } from "./template";
import { Timeline, TimelineItem } from "./timeline";
import { ComponentAnimation, applyAnimations } from "./animation";

interface AutoFitOpts {
  maxSize?: number;
  minSize?: number;
  minHeight?: number; // If set, the text will automatically scroll if the height is smaller than this value
}

export interface TextComponentOptions {
  text: string;
  autofit: AutoFitOpts;

  // Break text in chars when animating.
  chars?: boolean;

  // Apply perspective to the text
  perspective?: number;
}

export class TextComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Text;

  constructor(
    public name: string,
    public opts: TextComponentOptions,
    public style: JSX.CSSProperties,
    public animations?: ComponentAnimation[]
  ) {}

  resolveDuration(): number {
    return 0;
  }

  static fromJSON(json: any): TextComponent {
    return new TextComponent(json.name, json.opts, json.style);
  }

  static resolveOptions(
    opts: TextComponentOptions,
    config: TemplateConfig,
    context: any
  ): TextComponentOptions {
    return {
      text: resolveOption(opts.text, config, context),
      autofit: {
        maxSize: resolveOption(opts.autofit.maxSize, config, context),
        minSize: resolveOption(opts.autofit.minSize, config, context),
      },
    };
  }
}

// TODO: We must support formatters and templates. For example:
export interface formatter {
  fn: string;
  args: (string | number)[];
}

export type pipeline = formatter[];

// pipeline: [{fn: "formatNumber", args: ["$val"]}, {fn: "format", args: ["$val SEK"]}]
// Initial formatters must include the most important ones, such as formating numbers suitable for prices and quantities.
// TODO: rename text to value (all components that need a value should have value as prop)

export const Text: Component<{
  name?: string;
  opts: TextComponentOptions;
  style: JSX.CSSProperties;
  animations?: ComponentAnimation[];
  timeline: Timeline;
  onReady: () => void;
}> = (props) => {
  let textRef: HTMLDivElement | undefined;
  let timelineItem: TimelineItem;
  let scrollTimeline: gsap.core.Timeline;
  let cleanUpAnimations: () => void;

  const merged = mergeProps(
    { width: "100%", height: "100%", "line-height": "1em" },
    props.style
  );

  const spanStyle = {
    "line-height": merged["line-height"],
  };

  onCleanup(() => {
    cleanUpAnimations && cleanUpAnimations();
    timelineItem && props.timeline.remove(timelineItem);
    scrollTimeline?.kill();
  });

  onMount(() => {
    if (!textRef) {
      return;
    }
    const size = autoFitText(textRef, props.opts?.autofit);

    if (props.animations) {
      const splittedText = splitText(textRef, props.opts.chars);

      if (props.opts.perspective) {
        gsap.set(textRef, { perspective: props.opts.perspective });
      }

      cleanUpAnimations = applyAnimations(
        props.timeline,
        props.animations,
        splittedText.chars || splittedText.words
      );
    }

    // If the height of the text is too small, we could enable scrolling (using GSAP for the animation)
    if (props.opts.autofit.minSize && props.opts.autofit.minSize > size) {
      const containerRect = textRef?.parentElement?.getBoundingClientRect();
      const textRect = textRef?.getBoundingClientRect();
      if (containerRect) {
        scrollTimeline = gsap.timeline({
          repeat: -1,
          paused: true,
        });

        // Duration should be proportional to the length in chars of the text
        const duration = props.opts.text.length * 0.25;

        const slack = textRect.width * 0.1;
        scrollTimeline.to(textRef, {
          duration,
          x: -(textRect.width + slack),
          ease: "none",
        }, 1);

        timelineItem = {
          start: props.timeline.duration(),
          repeat: true,
          duration: scrollTimeline.duration() * 1000,
          child: scrollTimeline,
        };

        props.timeline.add(timelineItem);
      }
    }

    props.onReady();
  });

  return (
    <div data-component="text" data-name={props.name} style={merged}>
      <span ref={textRef} style={spanStyle}>
        {props.opts.text}
      </span>
    </div>
  );
};

const limits = {
  max: 10,
};

const maxNumIterations = 10;
const tolerance = 0.001;

function autoFitText(div: HTMLDivElement, options: AutoFitOpts): number {
  if (!div || !div.textContent) {
    return 0;
  }

  const textElement = div;
  textElement.style.overflowWrap = "normal";

  const setSize = function (size: number) {
    textElement.style.fontSize = `${size}em`;
  };

  const parentElement = div.parentElement!;

  const containerRect = parentElement.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) {
    return 0;
  }

  let l = 0;
  let r = (options && options.maxSize) || limits.max;

  const maxHeight = Math.ceil(containerRect.height);
  const maxWidth = Math.ceil(containerRect.width);

  let count = 0;
  let lastWidth = 0,
    lastHeight = 0,
    lastSize = 0;
  while (
    (r - l > tolerance && count < maxNumIterations) ||
    lastHeight > maxHeight ||
    lastWidth > maxWidth
  ) {
    count++;
    const size = (l + r) / 2;

    lastSize = size;

    setSize(size);
    const { height, width } = textElement.getBoundingClientRect();

    // Do not allow text to become smaller than 8px
    if (height <= 8 || width <= 8) {
      break;
    }

    if (height <= maxHeight && width <= maxWidth) {
      // Make the text larger
      l = size;
    } else {
      // Make the text smaller
      r = size;
    }

    lastHeight = height;
    lastWidth = width;
  }

  // If the height of the text is too small, we could enable scrolling (using GSAP for the animation)
  if (options.minSize && lastSize < options.minSize) {
    setSize(options.minSize);
  }

  return lastSize;
}

function createElementFromHTML(htmlString: string) {
  const div = document.createElement("div");
  div.innerHTML = htmlString.trim();
  return Array.prototype.slice.call(div.children);
}

function splitText(div: HTMLDivElement, splitChars?: boolean) {
  if (splitChars) {
    const chars: HTMLDivElement[] = [];
    const words = div.innerHTML
      .split(" ")
      .map((word, index, arr) =>
        splitInChars(word, chars, index === arr.length - 1)
      );

    div.replaceChildren(...words);

    return { words, chars };
  } else {
    const wordsHTML = div.innerHTML
      .split(" ")
      .map(
        (word) =>
          `<div style="display: inline-block; text-align: start; position: relative;">${word}</div>`
      )
      .join(
        `<div style="display: inline-block; text-align: start; position: relative;">&nbsp;</div>`
      );

    const words = createElementFromHTML(wordsHTML);

    div.replaceChildren(...words);

    return { words };
  }
}

function splitInChars(
  word: string,
  charArray: HTMLDivElement[],
  isLast: boolean
) {
  const div = document.createElement("div");
  div.style.display = "inline-block";
  div.style.textAlign = "start";
  div.style.position = "relative";

  const charElements = createElementFromHTML(
    word
      .split("")
      .map(
        (char) =>
          `<div style="display: inline-block; text-align: start; position: relative;">${char}</div>`
      )
      .join("")
  );

  if (!isLast) {
    const space = document.createElement("div");
    space.style.display = "inline-block";
    space.style.textAlign = "start";
    space.style.position = "relative";
    space.innerHTML = "&nbsp;";
    charElements.push(space);
  }

  div.replaceChildren(...charElements);

  charArray.push.apply(charArray, charElements);

  return div;
}
