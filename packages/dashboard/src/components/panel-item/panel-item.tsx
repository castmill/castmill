/**
 * PanelItem Component.
 *
 * Items for the side panel.
 * @param to - The route to navigate to.
 * @param icon - The icon to display.
 * @param text - The text to display.
 *
 * TODO: Support children items
 *
 */

import { Component } from 'solid-js';
import { A } from '@solidjs/router';

import './panel-item.scss';

interface PanelItemProps {
  to: string;
  text: string;
  level: number;
  icon?: Component;
}

const PanelItem: Component<PanelItemProps> = (props) => {
  return (
    <span class={`castmill-panel-item item-level-${props.level}`}>
      <A href={props.to} end={false}>
        {props.icon && <props.icon></props.icon>}
        <span>{props.text}</span>
      </A>
    </span>
  );
};

export default PanelItem;
