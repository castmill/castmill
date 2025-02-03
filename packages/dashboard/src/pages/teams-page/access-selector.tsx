/** @jsxImportSource solid-js */
import { Component, For } from 'solid-js';

type AccessSelectorProps = {
  availableAccess: string[];
  selected: string[]; // currently selected accesses
  onChange: (newSelected: string[]) => void;
};

export const AccessSelector: Component<AccessSelectorProps> = (props) => {
  // Event handler to toggle a checkbox for a given accessType
  const toggle = (accessType: string) => {
    const isCurrentlySelected = props.selected.includes(accessType);

    if (isCurrentlySelected) {
      // It's checked. We only allow unchecking if there's more than 1.
      if (props.selected.length > 1) {
        props.onChange(props.selected.filter((a) => a !== accessType));
      }
      // else do nothing (prevent removing the last checked item)
    } else {
      // It's not checked, so let's check it
      props.onChange([...props.selected, accessType]);
    }
  };

  return (
    <div>
      <For each={props.availableAccess}>
        {(accessType) => {
          // Use *functions* or createMemos so they are reactive
          const isChecked = () => props.selected.includes(accessType);

          // If this item is checked AND it is the only one, disable it
          const isDisabled = () => isChecked() && props.selected.length === 1;

          return (
            <label style="display: block; margin-bottom: 0.4em;">
              <input
                type="checkbox"
                checked={isChecked()}
                disabled={isDisabled()}
                onClick={() => toggle(accessType)}
              />
              {accessType}
            </label>
          );
        }}
      </For>
    </div>
  );
};
