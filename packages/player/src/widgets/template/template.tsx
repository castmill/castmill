import { Component, JSX, onCleanup, onMount } from 'solid-js';
import { ResourceManager } from '@castmill/cache';

import { Item } from './item';
import { TemplateConfig } from './binding';
import { GroupComponent } from './group';
import { TextComponent } from './text';
import { ImageComponent } from './image';
import { VideoComponent } from './video';
import { PaginatedListComponent, ListComponent } from './paginated-list';
import { ScrollerComponent } from './scroller';
import { ImageCarouselComponent } from './image-carousel';
import { LayoutComponent } from './layout';
import { QRCodeComponent } from './qr-code';
import { Timeline } from './timeline';
import { observeElementResize } from './text-autofit';
import { ComponentAnimation } from './animation';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export type TemplateComponentTypeUnion =
  | TextComponent
  | ImageComponent
  | VideoComponent
  | PaginatedListComponent
  | ScrollerComponent
  | GroupComponent
  | LayoutComponent
  | ImageCarouselComponent
  | QRCodeComponent;

export enum TemplateComponentType {
  Template = 'template',
  Layout = 'layout',
  Text = 'text',
  Image = 'image',
  Video = 'video',
  /** @deprecated Use PaginatedList instead */
  List = 'list',
  PaginatedList = 'paginated-list',
  Scroller = 'scroller',
  Group = 'group',
  ImageCarousel = 'image-carousel',
  QRCode = 'qr-code',
}

export class TemplateComponent {
  readonly type: any = TemplateComponentType.Template;
  readonly style: JSX.CSSProperties = {};

  constructor(
    public name: string,
    public opts: any, // public config: TemplateConfig, // public component: TemplateComponentTypeUnion
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>,
    public $styles?: { filter: Record<string, any>; style: JSX.CSSProperties }[]
  ) {}

  resolveDuration(medias: { [index: string]: string }): number {
    return 0;
  }

  /**
   * @param config The widget config. Components such as layouts use it to
   * resolve their bindings before rendering, e.g. to know their duration.
   */
  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals,
    config?: TemplateConfig
  ): TemplateComponent {
    const component = TemplateComponent.build(
      json,
      resourceManager,
      globals,
      config
    );
    // `when` (see visibility.ts) applies to every component type.
    if (json.when !== undefined) {
      (component as any).when = json.when;
    }
    return component;
  }

  private static build(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals,
    config?: TemplateConfig
  ): TemplateComponent {
    switch (json.type) {
      case TemplateComponentType.Group:
        return GroupComponent.fromJSON(json, resourceManager, globals, config);
      // Support both 'list' (deprecated) and 'paginated-list'
      case TemplateComponentType.List:
      case TemplateComponentType.PaginatedList:
        return PaginatedListComponent.fromJSON(json, resourceManager, globals);
      case TemplateComponentType.Scroller:
        return ScrollerComponent.fromJSON(json, resourceManager, globals);
      case TemplateComponentType.Layout:
        return LayoutComponent.fromJSON(json, resourceManager, globals, config);
      case TemplateComponentType.Text:
        return TextComponent.fromJSON(json);
      case TemplateComponentType.Image:
        return ImageComponent.fromJSON(json);
      case TemplateComponentType.Video:
        return VideoComponent.fromJSON(json);
      case TemplateComponentType.ImageCarousel:
        return ImageCarouselComponent.fromJSON(json);
      case TemplateComponentType.QRCode:
        return QRCodeComponent.fromJSON(json);
      default:
        throw new Error(`Unknown template component type: ${json.type}`);
    }
  }
}

/**
 * Templates are designed in `em` of a base font size that follows the widget's
 * rendered size, like legacy templates: 10px for a 1920×1080 widget, scaled by
 * the smaller of the width and height ratios ("contain"), so a 1080×1920
 * portrait widget gets 5.625px. A design then looks the same in any zone,
 * region or preview.
 */
export const BASE_FONT = { width: 1920, height: 1080, size: 10 };

/** The base font size in px for a widget of `width` × `height` px, or null. */
export const baseFontSize = (width: number, height: number): number | null =>
  width > 0 && height > 0
    ? BASE_FONT.size *
      Math.min(width / BASE_FONT.width, height / BASE_FONT.height)
    : null;

export const Template: Component<{
  name: string;
  root: TemplateComponentTypeUnion;

  style?: JSX.CSSProperties;
  timeline: Timeline;
  resourceManager: ResourceManager;

  config: TemplateConfig;
  globals: PlayerGlobals;

  onReady: () => void;
}> = (props) => {
  let rootRef: HTMLDivElement | undefined;
  let stopObserving: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const applyBaseFont = () => {
    const size = rootRef
      ? baseFontSize(rootRef.clientWidth, rootRef.clientHeight)
      : null;
    if (size !== null) rootRef!.style.fontSize = size + 'px';
    return size !== null;
  };

  // Templates are often rendered before they are attached or shown, so keep
  // measuring until the widget has a size; resizes are observed afterwards.
  const applyWhenSized = (delay: number) => {
    if (!applyBaseFont()) {
      retry = setTimeout(() => applyWhenSized(500), delay);
    }
  };

  onMount(() => {
    applyWhenSized(0);
    stopObserving = observeElementResize(rootRef!, applyBaseFont);
  });

  onCleanup(() => {
    stopObserving?.();
    clearTimeout(retry);
  });

  return (
    <div
      ref={rootRef}
      data-component="template"
      data-name={props.name}
      style={props.style || { width: '100%', height: '100%' }}
    >
      <Item
        config={props.config}
        context={null}
        component={props.root}
        timeline={props.timeline}
        resourceManager={props.resourceManager}
        onReady={props.onReady}
        globals={props.globals}
      />
    </div>
  );
};
