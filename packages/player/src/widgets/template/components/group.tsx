import { Component, For } from "solid-js";
import { Item, TemplateComponentTypeUnion } from "./item";
import { Model } from "../data/model";

export enum TemplateComponentType {
  Text = "text",
  Image = "image",
  List = "list",
  Group = "group",
  ImageCarousel = "image-carousel",
  ImageCarouselLayout = "image-carousel-layout",
}

export interface TemplateComponent {
  type: TemplateComponentType;
  style: string;
  binding?: string;
}

export class GroupComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Group;

  constructor(
    public name: string,
    public model: Model,
    public style: string,
    public binding?: string,
    public components: TemplateComponentTypeUnion[] = []
  ) {}
}

export const Group: Component<{
  name: string;
  model: Model;
  components: TemplateComponentTypeUnion[];
  style: string;
  timeline: GSAPTimeline;
  mediasMap: { [index: string]: string };
}> = (props) => {
  return (
    <div data-component="group" data-name={props.name} style={props.style}>
      <For each={props.components}>
        {(component, i) => (
          <Item
            model={props.model}
            component={component}
            timeline={props.timeline}
            mediasMap={props.mediasMap}
          />
        )}
      </For>
    </div>
  );
};
