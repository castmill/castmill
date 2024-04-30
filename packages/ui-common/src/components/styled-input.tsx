import { Component } from 'solid-js';
import './styled-input.scss'; // Import the custom CSS styles

export const StyledInput: Component<{
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: string;
  id: string;
  disabled?: boolean;
}> = (props) => {
  return (
    <input
      id={props.id}
      type={props.type || 'text'} // Default type is text if not specified
      class="input-text"
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
    />
  );
};
