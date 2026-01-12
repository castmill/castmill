import { Component, JSX } from 'solid-js';
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

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): TemplateComponent {
    switch (json.type) {
      case TemplateComponentType.Group:
        return GroupComponent.fromJSON(json, resourceManager, globals);
      // Support both 'list' (deprecated) and 'paginated-list'
      case TemplateComponentType.List:
      case TemplateComponentType.PaginatedList:
        return PaginatedListComponent.fromJSON(json, resourceManager, globals);
      case TemplateComponentType.Scroller:
        return ScrollerComponent.fromJSON(json, resourceManager, globals);
      case TemplateComponentType.Layout:
        return LayoutComponent.fromJSON(json, resourceManager, globals);
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
  return (
    <div
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
