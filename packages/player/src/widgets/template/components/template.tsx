import { Component, JSX } from "solid-js";

import { Item, TemplateComponentTypeUnion } from "./item";
import { Model } from "../data/model";

export const Template: Component<{
  name: string;
  model: Model;
  root: TemplateComponentTypeUnion;
  style: JSX.CSSProperties;
  timeline: GSAPTimeline;
  mediasMap: { [index: string]: string };
}> = (props) => {
  return (
    <div data-component="template" data-name={props.name} style={props.style}>
      <Item
        model={props.model}
        component={props.root}
        timeline={props.timeline}
        mediasMap={props.mediasMap}
      />
    </div>
  );
};
