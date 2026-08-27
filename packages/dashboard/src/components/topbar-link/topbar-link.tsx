/**
 * TopbarLink Component.
 *
 * Allows for a link to be rendered in the topbar including and optional icon.
 * Supports both internal routing links and external links.
 *
 */

import { Component, Show } from 'solid-js';
import './topbar-link.scss';
import { A } from '@solidjs/router';

interface TopbarLinkProps {
  to: string;
  icon?: Component;
  text: string;
  external?: boolean;
}

const TopbarLink: Component<TopbarLinkProps> = (props) => {
  return (
    <span class="castmill-topbar-link">
      <Show
        when={props.external}
        fallback={
          <A href={props.to}>
            {props.icon && <props.icon></props.icon>}
            <span>{props.text}</span>
          </A>
        }
      >
        <a href={props.to} target="_blank" rel="noopener noreferrer">
          {props.icon && <props.icon></props.icon>}
          <span>{props.text}</span>
        </a>
      </Show>
    </span>
  );
};

export default TopbarLink;
