/**
 * PanelItem Component.
 *
 * Items for the side panel.
 * @param to - The route to navigate to.
 * @param icon - The icon to display.
 * @param text - The text to display.
 * @param disabled - Shows the item greyed out and not clickable, for example
 *   organization pages when the user has no organization.
 * @param disabledTitle - Tooltip explaining why the item is disabled.
 *
 * TODO: Support children items
 *
 */

import { Component, Show } from 'solid-js';
import { A } from '@solidjs/router';

import './panel-item.scss';

interface PanelItemProps {
  to: string;
  text: string;
  level: number;
  icon?: Component;
  disabled?: boolean;
  disabledTitle?: string;
}

const PanelItem: Component<PanelItemProps> = (props) => {
  return (
    <span class={`castmill-panel-item item-level-${props.level}`}>
      <Show
        when={!props.disabled}
        fallback={
          <span
            class="panel-item-disabled"
            role="link"
            aria-disabled="true"
            title={props.disabledTitle}
          >
            {props.icon && <props.icon></props.icon>}
            <span>{props.text}</span>
          </span>
        }
      >
        <A href={props.to} end={false} title={props.text}>
          {props.icon && <props.icon></props.icon>}
          <span>{props.text}</span>
        </A>
      </Show>
    </span>
  );
};

export default PanelItem;
