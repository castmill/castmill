import { Component, For, JSX, createMemo, onCleanup, onMount } from 'solid-js';
import { Item } from './item';
import { TemplateConfig, resolveOption } from './binding';
import { isVisible } from './visibility';
import { observeElementResize } from './text-autofit';
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
  /**
   * Scales the group's font size with its rendered size, so designs in `em`
   * look the same at any size: `{ height: 1080, size: 10 }` gives 10px when the
   * group is 1080px high. With `width` and `height`, the smaller ratio wins.
   */
  fontScale?: FontScale;
}

export interface FontScale {
  width?: number;
  height?: number;
  size: number;
}

/**
 * The font size in px for a group of `width` × `height` px, or null. With both
 * a width and a height the smaller ratio wins, so the design fits ("contain").
 */
export const scaledFontSize = (
  scale: FontScale | undefined,
  width: number,
  height: number
): number | null => {
  if (!scale || !(scale.size > 0)) return null;
  const ratios: number[] = [];
  if (scale.height! > 0 && height > 0) ratios.push(height / scale.height!);
  if (scale.width! > 0 && width > 0) ratios.push(width / scale.width!);
  return ratios.length ? scale.size * Math.min.apply(Math, ratios) : null;
};

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
  fontScale?: FontScale;
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

  let count = 0;
  const onReadyAfter = () => {
    count++;
    if (count == children().length) {
      props.onReady();
    }
  };

  let stopScaling: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    cleanUpAnimations?.();
    stopScaling?.();
    clearTimeout(retry);
  });

  // Like legacy templates, the base font size follows the group's size.
  const applyFontScale = () => {
    if (!groupRef) return false;
    const size = scaledFontSize(
      props.fontScale,
      groupRef.clientWidth,
      groupRef.clientHeight
    );
    if (size !== null) groupRef.style.fontSize = size + 'px';
    return size !== null;
  };

  // Templates are often rendered before they are attached or shown, so keep
  // measuring until the group has a size; resizes are observed afterwards.
  const scaleWhenSized = (delay: number) => {
    if (!applyFontScale()) {
      retry = setTimeout(() => scaleWhenSized(500), delay);
    }
  };

  onMount(() => {
    if (groupRef && props.fontScale) {
      scaleWhenSized(0);
      stopScaling = observeElementResize(groupRef, applyFontScale);
    }

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
            onReady={onReadyAfter}
          />
        )}
      </For>
    </div>
  );
};
