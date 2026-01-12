import {
  Component,
  createSignal,
  For,
  JSX,
  onCleanup,
  onMount,
} from 'solid-js';
import { Item } from './item';
import { resolveOption, TemplateConfig } from './binding';
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from './template';
import { ResourceManager } from '@castmill/cache';
import { Timeline, TimelineItem } from './timeline';
import { ComponentAnimation } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export type ScrollDirection = 'left' | 'right' | 'up' | 'down';

export interface ScrollerComponentOptions {
  /**
   * The array of items to display. Each item will be passed as context
   * to the component template.
   */
  items: any[];

  /**
   * Direction of the scroll animation.
   * - 'left': Items scroll from right to left (default, like a stock ticker)
   * - 'right': Items scroll from left to right
   * - 'up': Items scroll from bottom to top
   * - 'down': Items scroll from top to bottom
   */
  direction?: ScrollDirection;

  /**
   * Scroll speed in pixels per second.
   * Higher values = faster scrolling.
   * Default: 100
   */
  speed?: number;

  /**
   * Gap between items in em units.
   * Default: '2em'
   */
  gap?: string;

  /**
   * Initial delay in seconds before scrolling starts.
   * Default: 0
   */
  delay?: number;
}

/**
 * ScrollerComponent displays items in a continuously scrolling container.
 * Ideal for news tickers, stock tickers, announcements, and any content
 * that needs to scroll continuously.
 *
 * Each item is rendered using the provided component template, with the
 * item data available as context (accessible via $.fieldName bindings).
 *
 * Uses duplicated content and requestAnimationFrame for seamless infinite scrolling.
 *
 * @example
 * ```json
 * {
 *   "type": "scroller",
 *   "opts": {
 *     "items": { "key": "data.stocks" },
 *     "direction": "left",
 *     "speed": 100,
 *     "gap": "3em"
 *   },
 *   "style": {
 *     "height": "4em",
 *     "background": "#1a1a2e"
 *   },
 *   "component": {
 *     "type": "group",
 *     "style": { "display": "flex", "alignItems": "center", "gap": "0.5em" },
 *     "components": [
 *       { "type": "text", "opts": { "text": { "key": "$.symbol" } }, "style": { "fontWeight": "bold" } },
 *       { "type": "text", "opts": { "text": { "key": "$.price" } } },
 *       { "type": "text", "opts": { "text": { "key": "$.changeFormatted" } }, "style": { "color": { "key": "$.changeColor" } } }
 *     ]
 *   }
 * }
 * ```
 */
export class ScrollerComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Scroller;

  constructor(
    public name: string,
    public config: TemplateConfig,
    public opts: ScrollerComponentOptions,
    public style: JSX.CSSProperties,
    public component: TemplateComponentTypeUnion,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    // Scroller runs indefinitely, return 0 to indicate it doesn't have a fixed duration
    return 0;
  }

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): ScrollerComponent {
    return new ScrollerComponent(
      json.name,
      json.config,
      json.opts,
      json.style,
      TemplateComponent.fromJSON(json.component, resourceManager, globals),
      json.animations,
      json.filter
    );
  }

  static resolveOptions(
    opts: any,
    config: TemplateConfig,
    context: any,
    globals: PlayerGlobals
  ): ScrollerComponentOptions {
    return {
      items: resolveOption(opts.items, config, context, globals) || [],
      direction:
        resolveOption(opts.direction, config, context, globals) || 'left',
      speed: resolveOption(opts.speed, config, context, globals) ?? 100,
      gap: resolveOption(opts.gap, config, context, globals) || '2em',
      delay: resolveOption(opts.delay, config, context, globals) || 0,
    };
  }
}

/**
 * Simple scroll animation controller using requestAnimationFrame.
 * Provides play/pause/seek functionality without external dependencies.
 */
class ScrollAnimation {
  private position = 0;
  private lastTime: number | null = null;
  private animationId: number | null = null;
  private _paused = true;
  private initialized = false; // Track if animation is fully initialized

  constructor(
    private element: HTMLElement,
    private config: {
      speed: number; // pixels per second
      scrollDistance: number; // distance to scroll before resetting (one set of items)
      isHorizontal: boolean;
      isReverse: boolean;
    }
  ) {
    // Set initial transform to position 0
    this.updateTransform();
  }

  /**
   * Mark the animation as initialized. After this, seeks will work normally.
   * This should be called after the timeline item is added.
   */
  markInitialized(): void {
    this.initialized = true;
  }

  play(): void {
    if (!this._paused) return;
    this._paused = false;
    this.lastTime = null;
    this.tick();
  }

  pause(): void {
    this._paused = true;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  seek(timeMs: number): void {
    // Ignore seeks before initialization is complete
    // This prevents the initial seek from the parent timeline setting a non-zero position
    // but allows seeks after the widget is fully mounted
    if (!this.initialized && timeMs > 0) {
      return;
    }
    // Calculate position based on time
    const distance = (timeMs / 1000) * this.config.speed;
    const newPosition = distance % this.config.scrollDistance;

    this.position = newPosition;
    this.updateTransform();
  }

  get paused(): boolean {
    return this._paused;
  }

  get duration(): number {
    // Duration in seconds for one complete loop
    return this.config.scrollDistance / this.config.speed;
  }

  destroy(): void {
    this.pause();
  }

  private tick = (): void => {
    if (this._paused) return;

    const now = performance.now();
    if (this.lastTime !== null) {
      const deltaMs = now - this.lastTime;
      const deltaPx = (deltaMs / 1000) * this.config.speed;

      this.position += deltaPx;

      // Reset when we've scrolled one full set (seamless loop)
      if (this.position >= this.config.scrollDistance) {
        this.position = this.position % this.config.scrollDistance;
      }

      this.updateTransform();
    }

    this.lastTime = now;
    this.animationId = requestAnimationFrame(this.tick);
  };

  private updateTransform(): void {
    const offset = this.config.isReverse ? this.position : -this.position;

    if (this.config.isHorizontal) {
      this.element.style.transform = `translateX(${offset}px)`;
    } else {
      this.element.style.transform = `translateY(${offset}px)`;
    }
  }
}

/**
 * Parse a CSS gap value (e.g., '2em', '20px') to pixels.
 * Uses a temporary element to compute the actual pixel value.
 */
function parseGap(gap: string, referenceElement: HTMLElement): number {
  // Create a temporary element to measure the gap
  const temp = document.createElement('div');
  temp.style.position = 'absolute';
  temp.style.visibility = 'hidden';
  temp.style.width = gap;

  // Append to the reference element's parent to inherit font-size for em units
  referenceElement.parentElement?.appendChild(temp);
  const width = temp.getBoundingClientRect().width;
  temp.remove();

  return width;
}

interface ScrollerProps extends BaseComponentProps {
  config: TemplateConfig;
  opts: ScrollerComponentOptions;
  component: TemplateComponentTypeUnion;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

/**
 * Scroller renders items in a continuously scrolling container.
 * Uses duplicated content and requestAnimationFrame for seamless infinite scrolling.
 */
export const Scroller: Component<ScrollerProps> = (props) => {
  let containerRef: HTMLDivElement | undefined;
  let contentRef: HTMLDivElement | undefined;
  let scrollAnimation: ScrollAnimation | null = null;
  let timelineItem: TimelineItem;

  // Track ready state for all items (original + duplicates)
  let readyCount = 0;
  const totalItems = props.opts.items.length * 2; // Duplicated for seamless loop

  const onItemReady = () => {
    readyCount++;
    if (readyCount >= totalItems) {
      // Wait for fonts to be loaded, then defer to next frames for layout
      const waitForFontsAndInit = async () => {
        // Wait for all fonts to be loaded
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
        // Add a small delay to ensure layout is fully settled
        // This helps with text content that may need extra time to calculate widths
        await new Promise((resolve) => setTimeout(resolve, 50));
        // Then defer to animation frame for final measurement
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            initializeScroll();
          });
        });
      };
      waitForFontsAndInit();
    }
  };

  const initializeScroll = () => {
    if (!containerRef || !contentRef) {
      props.onReady();
      return;
    }

    const isHorizontal =
      props.opts.direction === 'left' || props.opts.direction === 'right';
    const isReverse =
      props.opts.direction === 'right' || props.opts.direction === 'down';

    // Get the size of one set of items (half of duplicated content)
    const contentRect = contentRef.getBoundingClientRect();

    // The content has 2n items with (2n-1) gaps between them.
    // Half the content gives us n items but only (n - 0.5) gaps worth.
    // We need to add half a gap to get the correct scroll distance
    // (which represents n items + n gaps, including the gap to the duplicate's first item)
    const gapPx = parseGap(props.opts.gap || '2em', contentRef);
    const halfContentSize = isHorizontal
      ? contentRect.width / 2
      : contentRect.height / 2;
    const oneSetSize = halfContentSize + gapPx / 2;

    const pixelsPerSecond = props.opts.speed || 100;

    // Create scroll animation
    scrollAnimation = new ScrollAnimation(contentRef, {
      speed: pixelsPerSecond,
      scrollDistance: oneSetSize,
      isHorizontal,
      isReverse,
    });

    // Loop duration = time to scroll one complete set of items
    // This is when the animation resets (seamlessly due to duplication)
    const loopDuration = oneSetSize / pixelsPerSecond;

    // Create a timeline-compatible child object
    // Note: duration() must return milliseconds for non-GSAP children
    const scrollChild = {
      play: () => scrollAnimation?.play(),
      pause: () => scrollAnimation?.pause(),
      paused: () => scrollAnimation?.paused ?? true,
      seek: (timeMs: number) => scrollAnimation?.seek(timeMs),
      duration: () => (scrollAnimation?.duration ?? 0) * 1000, // Convert to ms
    };

    // Add to parent timeline with repeat: true
    // Start at 0 - the scroller should begin immediately when the timeline starts
    timelineItem = {
      start: 0,
      repeat: true,
      duration: loopDuration * 1000, // Convert to ms
      child: scrollChild,
    };

    props.timeline.add(timelineItem);

    // Mark as initialized - seeks will now work normally
    setTimeout(() => {
      scrollAnimation?.markInitialized();
    }, 0);

    props.onReady();
  };

  onCleanup(() => {
    timelineItem && props.timeline.remove(timelineItem);
    scrollAnimation?.destroy();
  });

  // If no items, render empty and signal ready
  if (!props.opts.items || props.opts.items.length === 0) {
    onMount(() => props.onReady());
    return (
      <div
        data-component="scroller"
        data-name={props.name}
        style={props.style}
      />
    );
  }

  const isHorizontal =
    props.opts.direction === 'left' || props.opts.direction === 'right';

  // Container style with overflow hidden
  const containerStyle: JSX.CSSProperties = {
    ...props.style,
    overflow: 'hidden',
    position: 'relative',
  };

  // Content wrapper style - flex container for items
  const contentStyle: JSX.CSSProperties = {
    display: 'flex',
    'flex-direction': isHorizontal ? 'row' : 'column',
    gap: props.opts.gap || '2em',
    'will-change': 'transform',
    'flex-wrap': 'nowrap',
    'white-space': isHorizontal ? 'nowrap' : undefined,
    // Set initial transform to prevent clipping before animation initializes
    transform: isHorizontal ? 'translateX(0px)' : 'translateY(0px)',
  };

  // Duplicate items for seamless infinite scroll
  const duplicatedItems = [...props.opts.items, ...props.opts.items];

  return (
    <div
      ref={containerRef}
      data-component="scroller"
      data-name={props.name}
      style={containerStyle}
    >
      <div ref={contentRef} style={contentStyle}>
        <For each={duplicatedItems}>
          {(item, i) => (
            <div
              style={{
                'flex-shrink': 0,
                display: isHorizontal ? 'inline-flex' : 'flex',
              }}
            >
              <Item
                config={props.config}
                context={item}
                component={props.component}
                timeline={props.timeline}
                resourceManager={props.resourceManager}
                onReady={onItemReady}
                globals={props.globals}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
