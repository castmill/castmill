import { Component, For, JSX, onCleanup, onMount } from 'solid-js';
import { Item } from './item';
import { TemplateConfig } from './binding';
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from './template';
import { ResourceManager } from '@castmill/cache';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface GroupComponentOptions {}

export class GroupComponent implements TemplateComponent {
  readonly type = TemplateComponentType.Group;

  constructor(
    public name: string,
    public config: TemplateConfig,
    public context: any,
    public opts: GroupComponentOptions,
    public style: JSX.CSSProperties,
    public components: TemplateComponentTypeUnion[] = [],
    public animations?: ComponentAnimation[],
    public filter?: Record<string, any>
  ) {}

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals
  ): GroupComponent {
    const components = json.components || [];
    return new GroupComponent(
      json.name,
      json.config,
      json.context,
      json.opts,
      json.style,
      components.map((component: any) =>
        TemplateComponent.fromJSON(component, resourceManager, globals)
      ),
      json.animations,
      json.filter
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

interface GroupProps extends BaseComponentProps {
  config: TemplateConfig;
  context: any;
  components: TemplateComponentTypeUnion[];
  globals: PlayerGlobals;
  resourceManager: ResourceManager;
}

export const Group: Component<GroupProps> = (props) => {
  let groupRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;

  let count = 0;
  const onReadyAfter = () => {
    count++;
    if (count == props.components.length) {
      props.onReady();
    }
  };

  onCleanup(() => {
    cleanUpAnimations && cleanUpAnimations();
  });

  onMount(() => {
    if (groupRef && props.animations) {
      cleanUpAnimations = applyAnimations(
        props.timeline,
        props.animations,
        groupRef,
        props.timeline.duration()
      );
    }
    // If group has no children, call onReady immediately
    if (props.components.length === 0) {
      props.onReady();
    }
  });

  return (
    <div
      ref={groupRef}
      data-component="group"
      data-name={props.name}
      style={props.style}
    >
      <For each={props.components}>
        {(component, i) => (
          <Item
            config={props.config}
            context={props.context}
            component={component}
            globals={props.globals}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={onReadyAfter}
          />
        )}
      </For>
    </div>
  );
};
