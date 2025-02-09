/**
 * Dropdown Component.
 *
 * Items for the side panel.
 * @param items - The items to display.
 *
 */

import { Component } from 'solid-js';

import './dropdown.scss';

interface DropdownItem {
  value: string;
  name: string;
}

interface DropdownProps {
  label: string;
  items: Array<DropdownItem>;
  onSelectChange: (value: string, name?: string) => void; // Callback function for when selection changes
}

export const Dropdown: Component<DropdownProps> = (props) => {
  // Function to handle change events on the dropdown
  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    props.onSelectChange(
      target.value,
      props.items.find((item) => item.value === target.value)?.name
    ); // Call the callback function with the new value
  };
  return (
    <div class="castmill-dropdown">
      <span class="label">{props.label}</span>
      <select onChange={handleChange}>
        {props.items.map((item) => {
          return <option value={item.value}>{item.name}</option>;
        })}
      </select>
    </div>
  );
};
