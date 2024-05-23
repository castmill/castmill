import { Component } from 'solid-js';
import styles from './styled-input.module.scss'; // Import the custom CSS styles

export const StyledInput: Component<{
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: string;
  id: string;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}> = (props) => {
  return (
    <input
      id={props.id}
      type={props.type || 'text'} // Default type is text if not specified
      class={styles['input-text']}
      value={props.value}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder={props.placeholder}
      disabled={props.disabled}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      autocomplete="off"
    />
  );
};
