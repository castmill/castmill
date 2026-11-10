import { Component, For, JSX, createMemo, onCleanup, onMount } from 'solid-js';
import { Item } from './item';
import { TemplateConfig, resolveOption } from './binding';
import { isVisible } from './visibility';
import {
  TemplateComponent,
  TemplateComponentType,
  TemplateComponentTypeUnion,
} from './template';
import { ResourceManager } from '@castmill/cache';
import { ComponentAnimation, applyAnimations } from './animation';
import { BaseComponentProps } from './interfaces/base-component-props';
import { PlayerGlobals } from '../../interfaces/player-globals.interface';

export interface GroupComponentOptions {
  /** Renders only the first `limit` visible children (see `when`). */
  limit?: number | Record<string, any>;
}

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
    public filter?: Record<string, any>,
    public $styles?: { filter: Record<string, any>; style: JSX.CSSProperties }[]
  ) {}

  static fromJSON(
    json: any,
    resourceManager: ResourceManager,
    globals: PlayerGlobals,
    config?: TemplateConfig
  ): GroupComponent {
    const components = json.components || [];
    return new GroupComponent(
      json.name,
      json.config,
      json.context,
      json.opts,
      json.style,
      components.map((component: any) =>
        TemplateComponent.fromJSON(component, resourceManager, globals, config)
      ),
      json.animations,
      json.filter,
      json.$styles
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

/**
 * The context of a group's children. A group may declare `context` (any
 * binding, e.g. `{ "key": "data.listing" }`) so its children bind to that
 * value with `$.` paths; otherwise they keep the group's own context.
 */
export const resolveGroupContext = (
  component: GroupComponent,
  config: TemplateConfig,
  context: any,
  globals: PlayerGlobals
) =>
  component.context === undefined || component.context === null
    ? context
    : resolveOption(component.context, config, context, globals);

interface GroupProps extends BaseComponentProps {
  config: TemplateConfig;
  context: any;
  limit?: number;
  components: TemplateComponentTypeUnion[];
  globals: PlayerGlobals;
  resourceManager: ResourceManager;
}

export const Group: Component<GroupProps> = (props) => {
  let groupRef: HTMLDivElement | undefined;
  let cleanUpAnimations: () => void;

  // With a limit, only the first visible children render.
  const children = createMemo(() => {
    const limit = props.limit;
    if (typeof limit !== 'number' || !(limit >= 0)) {
      return props.components;
    }
    return props.components
      .filter((component) =>
        isVisible(
          component as { filter?: Record<string, any>; when?: any },
          props.config,
          props.context,
          props.globals
        )
      )
      .slice(0, limit);
  });

  const readyComponents = new Set<number>();
  const onReadyAfter = (index: number) => {
    if (readyComponents.has(index)) {
      props.onLayoutUpdate?.();
      return;
    }
    readyComponents.add(index);
    if (readyComponents.size === children().length) {
      props.onReady();
    }
  };

  onCleanup(() => {
    cleanUpAnimations?.();
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
    if (children().length === 0) {
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
      <For each={children()}>
        {(component, i) => (
          <Item
            config={props.config}
            context={props.context}
            component={component}
            globals={props.globals}
            timeline={props.timeline}
            resourceManager={props.resourceManager}
            onReady={() => onReadyAfter(i())}
            onLayoutUpdate={props.onLayoutUpdate}
          />
        )}
      </For>
    </div>
  );
};
