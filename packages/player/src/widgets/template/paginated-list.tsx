import gsap from 'gsap';
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

export interface PaginatedListComponentOptions {
  /**
   * Duration in seconds to display each page before transitioning to the next.
   */
  pageDuration: number;

  /**
   * Maximum number of items to display per page.
   * If not specified, items will be auto-fitted based on container height.
   */
  pageSize?: number;

  /**
   * The array of items to display. Each item will be passed as context
   * to the component template.
   */
  items: any[];
}

/**
 * PaginatedListComponent displays a list of items in pages, with smooth
 * fade transitions between pages. Ideal for menus, schedules, catalogs,
 * and any content that needs to cycle through groups of items.
 *
 * Each item is rendered using the provided component template, with the
 * item data available as context (accessible via $.fieldName bindings).
 *
 * @example
 * ```json
 * {
 *   "type": "paginated-list",
 *   "opts": {
 *     "items": { "key": "data.menuItems" },
 *     "pageDuration": 5,
 *     "pageSize": 4
 *   },
 *   "component": {
 *     "type": "group",
 *     "components": [
 *       { "type": "text", "opts": { "text": { "key": "$.name" } } },
 *       { "type": "text", "opts": { "text": { "key": "$.price" } } }
 *     ]
 *   }
 * }
 * ```
 */
export class PaginatedListComponent implements TemplateComponent {
  readonly type = TemplateComponentType.PaginatedList;

  constructor(
    public name: string,
    public config: TemplateConfig,
    public opts: PaginatedListComponentOptions,
    public style: JSX.CSSProperties,
    public component: TemplateComponentTypeUnion,
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    // If opts contain bindings (objects with 'key' property), return 0 to indicate dynamic duration
    // The actual duration will be calculated at runtime once data is resolved
    const items = this.opts.items;
    const pageDuration = this.opts.pageDuration;

    // Check if items or pageDuration are unresolved bindings
    if (
      !Array.isArray(items) ||
      typeof pageDuration !== 'number' ||
      items.length === 0
    ) {
      return 0; // Dynamic duration - will be calculated at runtime
    }

    const pageSize = this.opts.pageSize || items.length;
    return (pageDuration * items.length) / pageSize;
  }

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): PaginatedListComponent {
    return new PaginatedListComponent(
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
  ): PaginatedListComponentOptions {
    const resolvedItems =
      resolveOption(opts.items, config, context, globals) || [];

    return {
      pageDuration: resolveOption(opts.pageDuration, config, context, globals),
      pageSize: resolveOption(opts.pageSize, config, context, globals),
      items: resolvedItems,
    };
  }
}

interface PaginatedListProps extends BaseComponentProps {
  config: TemplateConfig;
  opts: PaginatedListComponentOptions;
  component: TemplateComponentTypeUnion;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
}

/**
 * PaginatedList renders items in pages with fade transitions.
 * Automatically calculates how many items fit per page based on container size.
 */
export const PaginatedList: Component<PaginatedListProps> = (props) => {
  const [pages, setPages] = createSignal<any[][]>([]);
  const [pageStyle, setPageStyle] = createSignal('');

  let containerRef: HTMLDivElement | undefined;
  let gsapTimeline: GSAPTimeline = gsap.timeline({ repeat: -1, paused: true });
  let timelineItem: TimelineItem | null = null;
  let readyCount = 0;
  let expectedPages = 0;

  const resetTimeline = () => {
    if (timelineItem) {
      props.timeline.remove(timelineItem);
      timelineItem = null;
    }
    gsapTimeline.kill();
    gsapTimeline = gsap.timeline({ repeat: -1, paused: true });
  };

  const buildPages = (itemsPerPage: number): any[][] => {
    const items = props.opts.items || [];
    if (!items.length) {
      return [];
    }

    const perPage = Math.max(1, Math.floor(itemsPerPage || 1));
    const pagesArray: any[][] = [];
    for (let i = 0; i < items.length; i += perPage) {
      pagesArray.push(items.slice(i, i + perPage));
    }
    return pagesArray;
  };

  const applyPages = (
    pagesArray: any[][],
    containerWidth?: number,
    containerHeight?: number
  ) => {
    expectedPages = pagesArray.length;
    readyCount = 0;
    resetTimeline();

    // Pages need both width and height for absolute positioning
    if (
      typeof containerWidth === 'number' &&
      typeof containerHeight === 'number'
    ) {
      setPageStyle(
        `position: absolute; width: ${containerWidth}px; height: ${containerHeight}px;`
      );
    } else {
      setPageStyle('position: absolute; width: 100%; height: 100%;');
    }

    setPages(pagesArray);

    if (expectedPages === 0) {
      props.onReady();
    }
  };

  const finalizeTimeline = () => {
    const currentPages = pages();
    if (!currentPages.length) {
      return;
    }

    const durationSeconds =
      currentPages.length === 1
        ? props.opts.pageDuration
        : gsapTimeline.duration();
    const totalDurationMs = durationSeconds * 1000;

    const repeatTimeline = currentPages.length > 1 && !!gsapTimeline.repeat();

    timelineItem = {
      start: 0,
      duration: totalDurationMs,
      repeat: repeatTimeline,
      child: gsapTimeline,
    };

    props.timeline.add(timelineItem);
    props.onReady();
  };

  const onPageReady = () => {
    if (!expectedPages) {
      return;
    }
    readyCount++;
    if (readyCount === expectedPages) {
      finalizeTimeline();
    }
  };

  onCleanup(() => {
    if (timelineItem) {
      props.timeline.remove(timelineItem);
    }
    gsapTimeline.kill();
  });

  const setupPages = (
    itemsPerPage: number,
    containerWidth?: number,
    containerHeight?: number
  ) => {
    if (itemsPerPage <= 0) {
      applyPages([]);
      return;
    }
    const pagesArray = buildPages(itemsPerPage);
    applyPages(pagesArray, containerWidth, containerHeight);
  };

  onMount(() => {
    // Defer measurement to ensure layout is computed
    // This is critical for proper autofit text sizing
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        measureAndSetupPages();
      });
    });
  });

  const measureAndSetupPages = () => {
    if (!containerRef) {
      const itemsPerPage = props.opts.pageSize || props.opts.items.length || 1;
      setupPages(itemsPerPage);
      return;
    }

    const containerRect = containerRef.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      // Container still not sized, try again on next frame
      requestAnimationFrame(() => measureAndSetupPages());
      return;
    }

    let itemsPerPage: number;
    if (props.opts.pageSize) {
      itemsPerPage = props.opts.pageSize;
    } else {
      itemsPerPage = Math.min(
        Math.max(calcNumItemsPerPage(containerRef, props.opts.items.length), 1),
        Math.max(props.opts.items.length, 1)
      );
    }

    if (itemsPerPage > 0) {
      setupPages(itemsPerPage, containerRect.width, containerRect.height);
    }
  };

  return (
    <div
      data-component="paginated-list"
      data-name={props.name}
      style={props.style}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <For each={pages()}>
          {(page, i) => (
            <Page
              config={props.config}
              items={page}
              component={props.component}
              style={pageStyle()}
              timeline={props.timeline}
              gsapTimeline={gsapTimeline}
              pageIndex={i()}
              totalPages={pages().length}
              duration={props.opts.pageDuration}
              skipAnimation={pages().length === 1}
              resourceManager={props.resourceManager}
              globals={props.globals}
              onReady={onPageReady}
            />
          )}
        </For>
      </div>
    </div>
  );
};

/**
 * Internal Page component - renders a single page of items
 */
const Page: Component<{
  config: TemplateConfig;
  items: any[];
  component: TemplateComponentTypeUnion;
  style: string;
  gsapTimeline: gsap.core.Timeline;
  timeline: Timeline;
  pageIndex: number;
  totalPages: number;
  duration: number;
  skipAnimation: boolean;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
  onReady: () => void;
}> = (props) => {
  let pageRef: HTMLDivElement | undefined;

  let readyCount = 0;
  const onItemReady = () => {
    readyCount++;
    if (readyCount === props.items.length) {
      props.onReady();
    }
  };

  onMount(() => {
    if (!pageRef) {
      return;
    }

    // Set initial opacity: first page visible, others hidden
    if (props.pageIndex === 0) {
      gsap.set(pageRef.children, { opacity: 1 });
    } else {
      gsap.set(pageRef.children, { opacity: 0 });
    }

    if (!props.skipAnimation) {
      // For the first page, we don't need to fade in - it starts visible
      // Just add the hold and fade out
      if (props.pageIndex === 0) {
        // Hold for duration then fade out
        props.gsapTimeline.to(
          pageRef.children,
          { opacity: 0, stagger: 0.1, duration: 1 },
          `+=${props.duration}`
        );
      } else {
        // For subsequent pages, fade in, hold, then fade out
        props.gsapTimeline.to(
          pageRef.children,
          { opacity: 1, stagger: 0.1, duration: 1 },
          `>` // Start after previous animation
        );
        // Hold for duration then fade out
        props.gsapTimeline.to(
          pageRef.children,
          { opacity: 0, stagger: 0.1, duration: 1 },
          `>+=${props.duration}`
        );
      }
    }
  });

  return (
    <div ref={pageRef} style={props.style}>
      <For each={props.items}>
        {(item, i) => (
          <Item
            config={props.config}
            context={item}
            component={props.component}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={onItemReady}
            globals={props.globals}
          />
        )}
      </For>
    </div>
  );
};

/**
 * Calculates how many items can fit in the container based on height
 */
function calcNumItemsPerPage(div: HTMLDivElement, numItems: number): number {
  const containerRect = div.parentElement!.getBoundingClientRect();
  if (containerRect.width === 0 || containerRect.height === 0) {
    return 0;
  }

  const maxHeight = Math.ceil(containerRect.height);
  const { height } = div.getBoundingClientRect();
  const itemHeight = height / numItems;

  return Math.floor(maxHeight / itemHeight);
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

/**
 * @deprecated Use PaginatedListComponent instead. This alias is kept for backward compatibility.
 */
export const ListComponent = PaginatedListComponent;

/**
 * @deprecated Use PaginatedListComponentOptions instead. This alias is kept for backward compatibility.
 */
export type ListComponentOptions = PaginatedListComponentOptions;

/**
 * @deprecated Use PaginatedList instead. This alias is kept for backward compatibility.
 */
export const List = PaginatedList;
