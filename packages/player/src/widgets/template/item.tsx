import { Component, Switch, Match, Show } from "solid-js";

import { ResourceManager } from "@castmill/cache";

import { Group, GroupComponent } from "./group";
import { Image, ImageComponent } from "./image";
import { List, ListComponent } from "./list";
import { ImageCarousel, ImageCarouselComponent } from "./image-carousel";
import { Text, TextComponent, TextComponentOptions } from "./text";
import { TemplateConfig, resolveBinding, resolveKey } from "./binding";
import { Video, VideoComponent } from "./video";
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from "./template";
import { Layout, LayoutComponent } from "./layout";
import { Timeline } from "./timeline";

/**
 *
 * Checks if the condition is true or false.
 *
 * @param cond The condition to check, as an object of keypaths to data and values.
 *
 *
 * @param config
 * @param context
 * @returns
 */
function checkCondition(
  cond: Record<string, any> | undefined,
  config: TemplateConfig,
  context: any
): boolean {
  if (!cond) {
    return true;
  }

  return Object.keys(cond).every(
    (key) => cond[key] === resolveKey(key, config, context)[0]
  );
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
  medias: { [index: string]: string };
  resourceManager: ResourceManager;
  onReady: () => void;
}> = (props) => {
  let style = props.component.style || {};
  if ((props.component as TemplateComponent).$styles) {
    const $styles = (props.component as TemplateComponent).$styles!;
    for (let i = 0; i < $styles.length; i++) {
      if (checkCondition($styles![i].cond, props.config, props.context)) {
        console.log("applying style", $styles![i].style);
        style = { ...style, ...$styles![i].style };
      }
    }
  }

  return (
    <Show
      when={checkCondition(props.component.cond, props.config, props.context)}
      fallback={<Empty onReady={props.onReady} />}
    >
      <Switch fallback={<p>Invalid component type...</p>}>
        <Match when={props.component.type == TemplateComponentType.Image}>
          <Image
            name={props.component.name}
            opts={ImageComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context
            )}
            style={style}
            animations={props.component.animations}
            timeline={props.timeline}
            medias={props.medias}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Video}>
          <Video
            name={props.component.name}
            opts={VideoComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context
            )}
            style={style}
            timeline={props.timeline}
            medias={props.medias}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Text}>
          <Text
            name={props.component.name}
            opts={TextComponent.resolveOptions(
              props.component.opts as TextComponentOptions,
              props.config,
              props.context
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
            medias={props.medias}
            resourceManager={props.resourceManager}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.Layout}>
          <Layout
            name={props.component.name}
            opts={LayoutComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context
            )}
            style={style}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={props.onReady}
          />
        </Match>
        <Match when={props.component.type == TemplateComponentType.List}>
          <List
            name={props.component.name}
            config={props.config}
            opts={ListComponent.resolveOptions(
              props.component.opts,
              props.config,
              props.context
            )}
            component={(props.component as ListComponent).component}
            style={style}
            timeline={props.timeline}
            medias={props.medias}
            resourceManager={props.resourceManager}
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
              props.context
            )}
            style={style}
            timeline={props.timeline}
            medias={props.medias}
            onReady={props.onReady}
          />
        </Match>
      </Switch>
    </Show>
  );
};
