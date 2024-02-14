/**
 * TopbarLink Component.
 *
 * Allows for a link to be rendered in the topbar including and optional icon.
 *
 */

import { Component } from "solid-js";
import "./topbar-link.scss";
import { A } from "@solidjs/router";

interface TopbarLinkProps {
  to: string;
  icon?: Component;
  text: string;
}

const TopbarLink: Component<TopbarLinkProps> = (props) => {
  return (
    <span class="castmill-topbar-link">
      <A href={props.to}>
        {props.icon && <props.icon></props.icon>}
        <span>{props.text}</span>
      </A>
    </span>
  );
};

export default TopbarLink;
