/**
 * Dropdown Component.
 *
 * Items for the side panel.
 * @param items - The items to display.
 *
 */

import { Component, Show, createEffect, createSignal } from 'solid-js';
import { ImCancelCircle } from 'solid-icons/im';

import './dropdown.scss';

interface DropdownItem {
  value: string;
  name: string;
}

interface DropdownProps {
  label: string;
  items: Array<DropdownItem>;
  onSelectChange: (value: string | null, name?: string) => void; // Callback function for when selection changes
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  variant?: 'default' | 'inline'; // Inline variant for use in table cells
  id?: string; // Optional id for the select element (for forms and accessibility)
  name?: string; // Optional name for the select element (for forms)
}

// Generate a unique ID for the dropdown if not provided
let dropdownIdCounter = 0;
const generateDropdownId = () => `dropdown-${++dropdownIdCounter}`;

export const Dropdown: Component<DropdownProps> = (props) => {
  // Generate a unique ID for this instance if not provided
  const dropdownId = props.id || generateDropdownId();

  const computeFallbackValue = () => {
    if (props.defaultValue !== undefined) {
      return props.defaultValue;
    }

    if (props.placeholder) {
      return null;
    }

    return props.items[0]?.value ?? null;
  };

  const [selectedValue, setSelectedValue] = createSignal<string | null>(
    props.value !== undefined ? props.value : computeFallbackValue()
  );

  const getCurrentValue = () =>
    props.value !== undefined ? props.value : selectedValue();

  createEffect(() => {
    if (props.value !== undefined) {
      setSelectedValue(props.value);
      return;
    }

    const nextValue = computeFallbackValue();
    setSelectedValue((current) =>
      current !== nextValue ? nextValue : current
    );
  });

  // Handle dropdown changes
  const handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    const resolvedValue = value === '' ? null : value;
    const resolvedName =
      resolvedValue === null
        ? props.placeholder
        : props.items.find((item) => item.value === value)?.name;

    props.onSelectChange(resolvedValue, resolvedName);

    if (props.value === undefined) {
      setSelectedValue(resolvedValue);
    }
  };

  const handleClear = () => {
    props.onSelectChange(null, props.placeholder);
    props.onClear?.();

    if (props.value === undefined) {
      setSelectedValue(null);
    }
  };

  const shouldShowClear = () =>
    props.clearable &&
    getCurrentValue() !== null &&
    getCurrentValue() !== undefined;

  const isInlineVariant = () => props.variant === 'inline';

  return (
    <div
      class="castmill-dropdown"
      classList={{ 'castmill-dropdown--inline': isInlineVariant() }}
    >
      <Show when={props.label && !isInlineVariant()}>
        <span class="label">{props.label}</span>
      </Show>
      <div class="castmill-dropdown__control">
        <select
          id={dropdownId}
          name={props.name || dropdownId}
          onChange={handleChange}
          value={selectedValue() ?? ''}
          classList={{ 'is-placeholder': selectedValue() === null }}
          aria-label={props.label}
        >
          {props.placeholder && (
            <option value="" disabled hidden>
              {props.placeholder}
            </option>
          )}
          {props.items.map((item) => (
            <option value={item.value}>{item.name}</option>
          ))}
        </select>
        <Show when={shouldShowClear()}>
          <button
            type="button"
            class="clear-button"
            aria-label={props.clearLabel || 'Clear selection'}
            onClick={handleClear}
          >
            <ImCancelCircle class="clear-button__icon" />
          </button>
        </Show>
      </div>
    </div>
  );
};
