import { Component, Switch, Match, Show } from 'solid-js';

import { ResourceManager } from '@castmill/cache';

import { Group, GroupComponent } from './group';
import { Image, ImageComponent } from './image';
import {
  PaginatedList,
  PaginatedListComponent,
  ListComponent,
} from './paginated-list';
import { Scroller, ScrollerComponent } from './scroller';
import { ImageCarousel, ImageCarouselComponent } from './image-carousel';
import { Text, TextComponent, TextComponentOptions } from './text';
import { TemplateConfig, resolveKey, resolveOption } from './binding';
import { Video, VideoComponent } from './video';
import { QRCode, QRCodeComponent } from './qr-code';
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from './template';
import { Layout, LayoutComponent } from './layout';
import { Timeline } from './timeline';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

/**
 *
 * Checks if the condition is true or false.
 *
 * @param filter The condition to check, as an object of keypaths to data and values.
 *
 *
 * @param config
 * @param context
 * @returns
 */
function checkFilter(
  filter: Record<string, any> | undefined,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): boolean {
  if (!filter) {
    return true;
  }

  return Object.keys(filter).every(
    (key) => filter[key] === resolveKey(key, config, context, globals)[0]
  );
}

/**
 * Resolves bindings in style objects.
 * Allows style properties to use bindings like { key: "data.progress_percent" }
 */
function resolveStyleBindings(
  style: Record<string, any>,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
): Record<string, any> {
  const resolvedStyle: Record<string, any> = {};
  const keys = Object.keys(style);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    resolvedStyle[key] = resolveOption(style[key], config, context, globals);
  }

  return resolvedStyle;
}

const Empty: Component<{ onReady: () => void }> = (props) => {
  props.onReady();
  return <></>;
};

/**
 * The Item component is the component that acts as a switcher and glue
 * between the different component types.
 *
 * It is responsible for resolving every component's options of the template,
 * and passing them to the appropriate component.
 *
 */
export const Item: Component<{
  config: TemplateConfig;
  context: any;
  component: TemplateComponentTypeUnion;
  timeline: Timeline;
  resourceManager: ResourceManager;
  globals: PlayerGlobals;
  onReady: () => void;
}> = (props) => {
  let style = props.component.style || {};
  if ((props.component as TemplateComponent).$styles) {
    const $styles = (props.component as TemplateComponent).$styles!;
    for (let i = 0; i < $styles.length; i++) {
      if (
        $styles[i] &&
        checkFilter(
          $styles[i]!.filter,
          props.config,
          props.context,
          props.globals
        )
      ) {
        style = { ...style, ...$styles[i]!.style };
      }
    }
  }

  // Resolve any bindings in style properties (e.g., { key: "data.progress_percent" })
  style = resolveStyleBindings(
    style,
    props.config,
    props.context,
    props.globals
  );

  return (
    <Show
      when={checkFilter(
        props.component.filter,
        props.config,
        props.context,
        props.globals
      )}
      fallback={<Empty onReady={props.onReady} />}
    >
      <Switch fallback={<p>Invalid component type...</p>}>
        <Match when={props.component.type == TemplateComponentType.Image}>
          <Image
            name={props.component.name}
            opts={ImageComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            style={style}
            animations={props.component.animations}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Video}>
          <Video
            name={props.component.name}
            opts={VideoComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Text}>
          <Text
            name={props.component.name}
            opts={TextComponent.resolveOptions(
              props.component.opts as TextComponentOptions,
              props.config,
              props.context,
              props.globals
            )}
            animations={(props.component as TextComponent).animations}
            style={style}
            timeline={props.timeline}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Group}>
          <Group
            name={props.component.name}
            config={props.config}
            context={props.context}
            components={(props.component as GroupComponent).components}
            style={style}
            animations={(props.component as GroupComponent).animations}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Layout}>
          <Layout
            name={props.component.name}
            opts={LayoutComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        {/* Note: 'list' type is handled by fromJSON which returns PaginatedListComponent */}
        <Match
          when={props.component.type == TemplateComponentType.PaginatedList}
        >
          <PaginatedList
            name={props.component.name}
            config={props.config}
            opts={PaginatedListComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            component={(props.component as PaginatedListComponent).component}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Scroller}>
          <Scroller
            name={props.component.name}
            config={props.config}
            opts={ScrollerComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            component={(props.component as ScrollerComponent).component}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        <Match
          when={props.component.type == TemplateComponentType.ImageCarousel}
        >
          <ImageCarousel
            name={props.component.name}
            config={props.config}
            context={props.context}
            opts={ImageCarouselComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            globals={props.globals}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.QRCode}>
          <QRCode
            name={props.component.name}
            opts={QRCodeComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context,
              props.globals
            )}
            style={style}
            animations={props.component.animations}
            timeline={props.timeline}
            onReady={props.onReady}
          />
        </Match>
      </Switch>
    </Show>
  );
};
