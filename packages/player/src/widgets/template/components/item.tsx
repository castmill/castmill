import { Component, Switch, Match } from "solid-js";
import { Group, GroupComponent, TemplateComponentType } from "./group";
import { Image, ImageComponent } from "./image";
import { List, ListComponent } from "./list";
import { ImageCarousel, ImageCarouselComponent } from "./image-carousel";
import { Model } from "../data/model";
import { Text, TextComponent } from "./text";

export type TemplateComponentTypeUnion =
  | TextComponent
  | ImageComponent
  | ListComponent
  | GroupComponent
  | ImageCarouselComponent;

export const Item: Component<{
  model: Model;
  component: TemplateComponentTypeUnion;
  timeline: GSAPTimeline;
  mediasMap: { [index: string]: string };
}> = (props) => {
  let value, err;
  const binding = props.component.binding;
  if (binding && props.model) {
    [value, err] = Model.get(props.model, binding);
  }
  return (
    <Switch fallback={<p>Invalid component type...</p>}>
      <Match when={props.component.type == TemplateComponentType.Text}>
        <Text
          name={props.component.name}
          text={value || (props.component as TextComponent).text}
          opts={(props.component as TextComponent).opts}
          style={props.component.style}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.Image}>
        <Image
          name={props.component.name}
          url={value || (props.component as ImageComponent).url}
          style={props.component.style}
          timeline={props.timeline}
          mediasMap={props.mediasMap}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.Group}>
        <Group
          name={props.component.name}
          model={value || props.model}
          components={(props.component as GroupComponent).components}
          style={props.component.style}
          timeline={props.timeline}
          mediasMap={props.mediasMap}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.List}>
        <List
          name={props.component.name}
          value={value}
          component={(props.component as ListComponent).component}
          style={props.component.style}
          pageDuration={(props.component as ListComponent).pageDuration || 5}
          timeline={props.timeline}
          mediasMap={props.mediasMap}
        />
      </Match>
      <Match when={props.component.type == TemplateComponentType.ImageCarousel}>
        <ImageCarousel
          name={props.component.name}
          value={value || (props.component as ImageCarouselComponent).value}
          style={props.component.style}
          imageDuration={
            (props.component as ImageCarouselComponent).imageDuration || 3
          }
          timeline={props.timeline}
          mediasMap={props.mediasMap}
        />
      </Match>
    </Switch>
  );
};
