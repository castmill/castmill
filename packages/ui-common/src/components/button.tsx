import { Component, mergeProps, Show } from 'solid-js';
import { IconTypes } from 'solid-icons';
import IconWrapper from './icon-wrapper';
import './button.scss'; // Import your custom CSS for styles

export const Button: Component<{
  onClick?: () => void;
  disabled?: boolean;
  icon?: IconTypes; // This can be any SVG component from solid-icons or other libraries
  iconProps?: Record<string, any>;
  type?: 'button' | 'submit' | 'reset';
  label?: string;
  color?: 'primary' | 'secondary' | 'danger' | 'success' | 'info';
}> = (props) => {
  const defaultProps = mergeProps(
    {
      type: 'button',
      disabled: false,
      color: 'primary', // Default color
    },
    props
  );

  return (
    <button
      type={defaultProps.type as 'button' | 'submit' | 'reset'}
      class={`button button-${defaultProps.color} ${defaultProps.disabled ? 'button-disabled' : ''}`}
      onClick={defaultProps.disabled ? undefined : defaultProps.onClick}
      disabled={defaultProps.disabled}
      aria-label={`${defaultProps.label}`}
    >
      <Show when={defaultProps.icon}>
        <IconWrapper icon={defaultProps.icon!} />
      </Show>

      {defaultProps.label ? <span>{defaultProps.label}</span> : null}
    </button>
  );
};
