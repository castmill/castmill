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
  icon?: Component;
  text: string;
}

const PanelItem: Component<PanelItemProps> = (props) => {
  const result = props.icon({});

  return (
    <span class="castmill-panel-item">
      <A href={props.to}>
        {props.icon && <props.icon></props.icon>}
        <span>{props.text}</span>
      </A>
    </span>
  );
};

export default PanelItem;
