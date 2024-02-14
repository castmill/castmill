/**
 * Dropdown Component.
 *
 * Items for the side panel.
 * @param items - The items to display.
 *
 */

import { Component } from "solid-js";

import "./dropdown.scss";

interface DropdownItem {
  value: string;
  name: string;
}

interface DropdownProps {
  label: string;
  items: Array<DropdownItem>;
}

const Dropdown: Component<DropdownProps> = (props) => {
  return (
    <div class="castmill-dropdown">
      <span class="label">{props.label}</span>
      <select>
        {props.items.map((item) => {
          return <option value={item.value}>{item.name}</option>;
        })}
      </select>
    </div>
  );
};

export default Dropdown;
