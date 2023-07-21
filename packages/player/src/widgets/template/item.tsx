import { Component, Switch, Match } from "solid-js";
import { Group, GroupComponent } from "./group";
import { Image, ImageComponent } from "./image";
import { List, ListComponent } from "./list";
import { ImageCarousel, ImageCarouselComponent } from "./image-carousel";
import { Text, TextComponent } from "./text";
import { TemplateConfig } from "./binding";
import { Video, VideoComponent } from "./video";
import { TemplateComponentType, TemplateComponentTypeUnion } from "./template";
import { Layout, LayoutComponent } from "./layout";
import { ResourceManager } from "@castmill/cache";
import { Timeline } from "./timeline";

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
  return (
    <Switch fallback={<p>Invalid component type...</p>}>
      <Match when={props.component.type == TemplateComponentType.Image}>
        <Image
          name={props.component.name}
          opts={ImageComponent.resolveOptions(
            props.component.opts,
            props.config,
            props.context
          )}
          style={props.component.style}
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
          style={props.component.style}
          timeline={props.timeline}
          medias={props.medias}
          onReady={props.onReady}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.Text}>
        <Text
          name={props.component.name}
          opts={TextComponent.resolveOptions(
            props.component.opts,
            props.config,
            props.context
          )}
          style={props.component.style}
          onReady={props.onReady}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.Group}>
        <Group
          name={props.component.name}
          config={props.config}
          context={props.context}
          components={(props.component as GroupComponent).components}
          style={props.component.style}
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
          style={props.component.style}
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
          style={props.component.style}
          timeline={props.timeline}
          medias={props.medias}
          resourceManager={props.resourceManager}
          onReady={props.onReady}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.ImageCarousel}>
        <ImageCarousel
          name={props.component.name}
          config={props.config}
          context={props.context}
          opts={ImageCarouselComponent.resolveOptions(
            props.component.opts,
            props.config,
            props.context
          )}
          style={props.component.style}
          timeline={props.timeline}
          medias={props.medias}
          onReady={props.onReady}
        />
      </Match>
    </Switch>
  );
};
