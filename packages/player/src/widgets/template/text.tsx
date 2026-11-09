import gsap from 'gsap';
import { getLogicalSize } from '../../utils/logical-size';

import {
  Component,
  createMemo,
  JSX,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js';
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

/**
 * Declares a text that users can replace per playlist item (in-place editing).
 * See agents/systems/IN-PLACE-TEXT-EDITING.md.
 */
export interface EditableAttributes {
  /** Override key: a string, or a binding (e.g. for texts inside lists). */
  key: any;
  /** Label shown in the editor: a string or a binding. */
  label?: any;
  multiline?: boolean;
  max_length?: number;
}

/** A stored override in the item's `options.overrides`. */
export interface TextOverride {
  text?: string;
  hidden?: boolean;
}

export interface ResolvedEditable {
  key: string;
  label?: string;
  multiline: boolean;
  maxLength: number;
  /** How the current text is overridden, if it is. */
  overridden?: 'text' | 'hidden';
}

const DEFAULT_MAX_LENGTH = 500;

const toText = (value: unknown): string | undefined =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' && isFinite(value)
      ? String(value)
      : undefined;

/** Resolves an editable attribute; undefined when its key is not a text. */
export const resolveEditable = (
  editable: EditableAttributes | undefined,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): ResolvedEditable | undefined => {
  if (!editable || typeof editable !== 'object') {
    return undefined;
  }
  const key = toText(resolveOption(editable.key, config, context, globals));
  if (!key) {
    return undefined;
  }
  const label = toText(resolveOption(editable.label, config, context, globals));
  const maxLength = editable.max_length;
  return {
    key,
    label: label || undefined,
    multiline: editable.multiline === true,
    maxLength:
      typeof maxLength === 'number' && maxLength > 0
        ? maxLength
        : DEFAULT_MAX_LENGTH,
  };
};

/** The stored override for a key, if it is a valid one. */
export const getTextOverride = (
  config: TemplateConfig,
  key: string
): TextOverride | undefined => {
  const overrides = config && config.options && config.options.overrides;
  if (
    !overrides ||
    typeof overrides !== 'object' ||
    !Object.prototype.hasOwnProperty.call(overrides, key)
  ) {
    return undefined;
  }
  const override = overrides[key];
  if (override && override.hidden === true) {
    return { hidden: true };
  }
  if (override && typeof override.text === 'string') {
    return { text: override.text };
  }
  return undefined;
};

export interface TextComponentOptions {
  text: string;
  autofit: AutoFitOpts;

  /** Set when the text is editable (resolved key and label). */
  editable?: ResolvedEditable;

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
    public $styles?: {
      filter: Record<string, any>;
      style: JSX.CSSProperties;
    }[],
    public editable?: EditableAttributes
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
      json.$styles,
      json.editable
    );
  }

  /**
   * An override of an editable text replaces its whole binding: it is shown as
   * typed, without fmt, formatters, surrounding literals or first fallbacks.
   */
  static resolveOptions(
    opts: TextComponentOptions,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals,
    editableAttrs?: EditableAttributes
  ): TextComponentOptions {
    const editable = resolveEditable(editableAttrs, config, context, globals);
    const override =
      editable && config.textOverridesEnabled !== false
        ? getTextOverride(config, editable.key)
        : undefined;
    let text: string;
    if (override && override.hidden) {
      text = '';
      editable!.overridden = 'hidden';
    } else if (override) {
      text = override.text!;
      editable!.overridden = 'text';
    } else {
      text = resolveOption(opts.text, config, context, globals);
    }

    return {
      text,
      editable,
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
  const merged = createMemo(() => {
    const style = props.style;
    const isPositioned =
      style?.position === 'absolute' || style?.position === 'fixed';
    const isFlexItem = style?.flex !== undefined;

    let defaultStyle: JSX.CSSProperties;
    if (isPositioned) {
      defaultStyle = { 'line-height': '1em' };
    } else if (isFlexItem) {
      defaultStyle = { width: '100%', 'line-height': '1em' };
    } else {
      defaultStyle = { width: '100%', height: '100%', 'line-height': '1em' };
    }

    return mergeProps(defaultStyle, style);
  });
  const spanStyle = createMemo(() => ({
    'line-height': merged()['line-height'],
  }));

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
      !props.opts.text ||
      !props.opts.autofit.minSize ||
      props.opts.autofit.minSize <= size
    ) {
      return;
    }

    const containerRect = element.parentElement
      ? getLogicalSize(element.parentElement)
      : undefined;
    const textRect = getLogicalSize(element);
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

  // Line breaks typed into multiline overrides are kept.
  const textStyle = () =>
    props.opts.editable?.multiline && props.opts.editable.overridden
      ? { ...spanStyle(), 'white-space': 'pre-line' }
      : spanStyle();

  // The data-editable-* attributes are hooks for the dashboard editor only.
  return (
    <div
      data-component="text"
      data-name={props.name}
      data-editable-key={props.opts.editable?.key}
      data-editable-label={props.opts.editable?.label}
      data-editable-multiline={
        props.opts.editable?.multiline ? 'true' : undefined
      }
      data-editable-max-length={props.opts.editable?.maxLength}
      data-editable-overridden={props.opts.editable?.overridden}
      style={merged()}
    >
      <span ref={textRef} style={textStyle()}>
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

  const containerRect = getLogicalSize(containerElement);
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
    const { height, width } = getLogicalSize(textElement);
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
