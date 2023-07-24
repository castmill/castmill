import { Component, For, JSX } from "solid-js";
import { Item } from "./item";
import { TemplateConfig } from "./binding";
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from "./template";
import { ResourceManager } from "@castmill/cache";
import { Timeline } from "./timeline";

export interface GroupComponentOptions {}

export class GroupComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Group;

  constructor(
    public name: string,
    public config: TemplateConfig,
    public context: any,
    public opts: GroupComponentOptions,
    public style: JSX.CSSProperties,
    public components: TemplateComponentTypeUnion[] = []
  ) {}

  static fromJSON(json: any, resourceManager: ResourceManager): GroupComponent {
    return new GroupComponent(
      json.name,
      json.config,
      json.context,
      json.opts,
      json.style,
      json.components.map((component: any) =>
        TemplateComponent.fromJSON(component, resourceManager)
      )
    );
  }

  resolveDuration(medias: { [index: string]: string }): number {
    return this.components.reduce(
      (acc: number, component: TemplateComponentTypeUnion) =>
        Math.max(acc, component.resolveDuration(medias)),
      0
    );
  }
}

export const Group: Component<{
  name: string;
  config: TemplateConfig;
  context: any;
  components: TemplateComponentTypeUnion[];
  style: JSX.CSSProperties;
  timeline: Timeline;
  medias: { [index: string]: string };
  resourceManager: ResourceManager;
  onReady: () => void;
}> = (props) => {
  let count = 0;
  const onReadyAfter = () => {
    count++;
    if (count == props.components.length) {
      props.onReady();
    }
  };

  return (
    <div data-component="group" data-name={props.name} style={props.style}>
      <For each={props.components}>
        {(component, i) => (
          <Item
            config={props.config}
            context={props.context}
            medias={props.medias}
            component={component}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={onReadyAfter}
          />
        )}
      </For>
    </div>
  );
};
