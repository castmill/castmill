import gsap from 'gsap';

import { Component, JSX, mergeProps, onCleanup, onMount } from 'solid-js';
import { TemplateConfig, resolveOption } from './binding';
import { TemplateComponent, TemplateComponentType } from './template';
import { TimelineItem } from './timeline';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';
import {
  observeTextContainerResize,
  observeTextContentChanges,
} from './text-autofit';
interface AutoFitOpts {
  // Base size of the text (in em). Used if the text fits in the container.
  baseSize?: number;

  // Maximum size the text can have (in em)
  maxSize?: number;

  // Minimum size the text can have (in em) before scroll is enabled.
  minSize?: number;
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
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>,
    public $styles?: { filter: Record<string, any>; style: JSX.CSSProperties }[]
  ) {}

  resolveDuration(): number {
    return 0;
  }

  static fromJSON(json: any): TextComponent {
    return new TextComponent(
      json.name,
      json.opts,
      json.style,
      json.animations,
      json.filter,
      json.$styles
    );
  }

  static resolveOptions(
    opts: TextComponentOptions,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): TextComponentOptions {
    return {
      text: resolveOption(opts.text, config, context, globals),
      autofit: {
        maxSize: resolveOption(opts.autofit?.maxSize, config, context, globals),
        minSize: resolveOption(opts.autofit?.minSize, config, context, globals),
        baseSize: resolveOption(
          opts.autofit?.baseSize,
          config,
          context,
          globals
        ),
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

interface TextProps extends BaseComponentProps {
  opts: TextComponentOptions;
}

export const Text: Component<TextProps> = (props) => {
  let textRef: HTMLDivElement | undefined;
  let timelineItem: TimelineItem | undefined;
  let scrollTimeline: gsap.core.Timeline | undefined;
  let cleanUpAnimations: (() => void) | undefined;
  let stopObservingResize: (() => void) | undefined;
  let contentObserver: MutationObserver | null = null;
  let animationFrame: number | undefined;

  // Determine default sizing based on context:
  // 1. Positioned elements (absolute/fixed) - no default size, auto-size to content
  // 2. Flex items (have flex property) - let flex control sizing, don't override with 100%
  // 3. Other elements - apply width/height 100% for autofit to work
  const isPositioned =
    props.style?.position === 'absolute' || props.style?.position === 'fixed';
  const isFlexItem = props.style?.flex !== undefined;

  let defaultStyle: JSX.CSSProperties;
  if (isPositioned) {
    // Positioned elements auto-size to content
    defaultStyle = { 'line-height': '1em' };
  } else if (isFlexItem) {
    // Flex items: let flex control height, but keep width for autofit measurement
    defaultStyle = { width: '100%', 'line-height': '1em' };
  } else {
    // Default: fill container for autofit to measure
    defaultStyle = { width: '100%', height: '100%', 'line-height': '1em' };
  }
  const merged = mergeProps(defaultStyle, props.style);

  const spanStyle = {
    'line-height': merged['line-height'],
  };

  onCleanup(() => {
    cleanUpAnimations?.();
    resetScrollTimeline();
    stopObservingResize?.();
    contentObserver?.disconnect();
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
    }
  });

  const resetScrollTimeline = () => {
    if (timelineItem) {
      props.timeline.remove(timelineItem);
      timelineItem = undefined;
    }

    if (scrollTimeline) {
      scrollTimeline.kill();
      scrollTimeline = undefined;
    }

    const element = textRef;
    if (!element) {
      return;
    }

    gsap.set(element, { x: 0 });
  };

  const updateScrollTimeline = (size: number) => {
    resetScrollTimeline();

    const element = textRef;
    if (
      !element ||
      !props.opts.autofit.minSize ||
      props.opts.autofit.minSize <= size
    ) {
      return;
    }

    const containerRect = element.parentElement?.getBoundingClientRect();
    const textRect = element.getBoundingClientRect();
    if (!containerRect) {
      return;
    }

    scrollTimeline = gsap.timeline({
      repeat: -1,
      paused: true,
    });

    // Duration should be proportional to the length in chars of the text
    const duration = props.opts.text.length * 0.25;

    const slack = textRect.width * 0.1;
    scrollTimeline.to(
      element,
      {
        duration,
        x: -(textRect.width + slack),
        ease: 'none',
      },
      1 // Wait 1 second before starting the animation
    );

    timelineItem = {
      start: 0, // Text scroll animations should start immediately, not sequentially
      repeat: true,
      duration: scrollTimeline.duration() * 1000,
      child: scrollTimeline,
    };

    props.timeline.add(timelineItem);
  };

  onMount(() => {
    if (!textRef) {
      return;
    }

    const fitText = () => {
      const size = autoFitText(textRef!, props.opts?.autofit || {});
      updateScrollTimeline(size);
      return size;
    };

    fitText();
    animationFrame = requestAnimationFrame(() => {
      fitText();
    });
    stopObservingResize = observeTextContainerResize(textRef, () => {
      fitText();
    });
    contentObserver = observeTextContentChanges(textRef, () => {
      fitText();
    });

    if (props.animations) {
      const splittedText = splitText(textRef, props.opts.chars);

      if (props.opts.perspective) {
        gsap.set(textRef, { perspective: props.opts.perspective });
      }

      cleanUpAnimations = applyAnimations(
        props.timeline,
        props.animations,
        splittedText.chars || splittedText.words,
        props.timeline.duration()
      );
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
  textElement.style.overflowWrap = 'normal';

  const setSize = function (size: number) {
    textElement.style.fontSize = `${size}em`;
  };

  const containerElement = div.parentElement;
  if (!containerElement) {
    const fallbackSize = options.baseSize ?? 1;
    setSize(fallbackSize);
    return fallbackSize;
  }

  const containerRect = containerElement.getBoundingClientRect();
  const maxHeight = containerRect.height;
  const maxWidth = containerRect.width;
  if (maxWidth === 0 || maxHeight === 0) {
    // Container not yet sized - use baseSize as fallback
    if (options.baseSize) {
      setSize(options.baseSize);
      return options.baseSize;
    }
    // Default to 1em if no baseSize specified
    setSize(1);
    return 1;
  }

  const fits = () => {
    const { height, width } = textElement.getBoundingClientRect();
    return height <= maxHeight && width <= maxWidth;
  };

  if (options.baseSize) {
    setSize(options.baseSize);
    if (fits()) {
      return options.baseSize;
    }
  }

  let l = 0;
  let r = options.maxSize || limits.max;

  let count = 0;
  let lastSize = 0;
  let lastSmallerSize = 0;
  while (r - l > tolerance && count < maxNumIterations) {
    count++;
    const size = (l + r) / 2;

    lastSize = size;

    setSize(size);

    if (fits()) {
      // Make the text larger
      l = size;
      lastSmallerSize = size;
    } else {
      // Make the text smaller
      r = size;
    }
  }

  if (!fits()) {
    lastSize = lastSmallerSize;
    setSize(lastSmallerSize);
  }

  // If the height of the text is too small, we could enable scrolling (using GSAP for the animation)
  if (options.minSize && lastSize < options.minSize) {
    setSize(options.minSize);
  }

  return lastSize;
}

function createElementFromHTML(htmlString: string) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return Array.prototype.slice.call(div.children);
}

function splitText(div: HTMLDivElement, splitChars?: boolean) {
  if (splitChars) {
    const chars: HTMLDivElement[] = [];
    const words = div.innerHTML
      .split(' ')
      .map((word, index, arr) =>
        splitInChars(word, chars, index === arr.length - 1)
      );

    div.replaceChildren(...words);

    return { words, chars };
  } else {
    const wordsHTML = div.innerHTML
      .split(' ')
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
  const div = document.createElement('div');
  div.style.display = 'inline-block';
  div.style.textAlign = 'start';
  div.style.position = 'relative';

  const charElements = createElementFromHTML(
    word
      .split('')
      .map(
        (char) =>
          `<div style="display: inline-block; text-align: start; position: relative;">${char}</div>`
      )
      .join('')
  );

  if (!isLast) {
    const space = document.createElement('div');
    space.style.display = 'inline-block';
    space.style.textAlign = 'start';
    space.style.position = 'relative';
    space.innerHTML = '&nbsp;';
    charElements.push(space);
  }

  div.replaceChildren(...charElements);

  charArray.push.apply(charArray, charElements);

  return div;
}
