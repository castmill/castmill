import { Component } from 'solid-js';
import './icon-button.scss'; // Import your custom CSS for styles

export const IconButton: Component<{
  onClick?: () => void;
  disabled?: boolean;
  icon: Component; // This should be a component (icon)
  color?: 'primary' | 'secondary' | 'danger' | 'success' | 'info';
}> = (props) => {
  const defaultProps = {
    disabled: false,
    color: 'primary', // Default color
    ...props,
  };

  return (
    <button
      class={`icon-button icon-button-${defaultProps.color} ${defaultProps.disabled ? 'icon-button-disabled' : ''}`}
      onClick={defaultProps.disabled ? undefined : defaultProps.onClick}
      disabled={defaultProps.disabled}
      title={props.icon.name} // Optional: provide a tooltip (icon name or custom title)
    >
      <props.icon />
    </button>
  );
};
