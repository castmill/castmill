/**
 * Dropdown Component.
 *
 * Items for the side panel.
 * @param items - The items to display.
 *
 */

import { Component, createSignal } from 'solid-js';

import './dropdown.scss';

interface DropdownItem {
  value: string;
  name: string;
}

interface DropdownProps {
  label: string;
  items: Array<DropdownItem>;
  onSelectChange: (value: string, name?: string) => void; // Callback function for when selection changes
  defaultValue?: string;
}

export const Dropdown: Component<DropdownProps> = (props) => {
  const [selectedValue, setSelectedValue] = createSignal(
    props.defaultValue ?? (props.items[0]?.value || '')
  );

  // Handle dropdown changes
  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    props.onSelectChange(
      target.value,
      props.items.find((item) => item.value === target.value)?.name
    ); // Call the callback function with the new value
    setSelectedValue(target.value);
  };

  return (
    <div class="castmill-dropdown">
      <span class="label">{props.label}</span>
      <select onChange={handleChange} value={selectedValue()}>
        {props.items.map((item) => (
          <option value={item.value}>{item.name}</option>
        ))}
      </select>
    </div>
  );
};
