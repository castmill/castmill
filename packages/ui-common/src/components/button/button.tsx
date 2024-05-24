import { Component, mergeProps, Show } from 'solid-js';
import { IconTypes } from 'solid-icons';
import { IconWrapper } from '../icon-wrapper';

import styles from './button.module.scss';

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

  let buttonElement: HTMLButtonElement | null = null;

  const handleClick = () => {
    if (!buttonElement || defaultProps.disabled) return;

    // Add the "pressed" class to the current button
    buttonElement.classList.add(styles[`button-${defaultProps.color}-active`]);

    // Remove the "pressed" class after a short delay
    setTimeout(() => {
      buttonElement?.classList.remove(
        styles[`button-${defaultProps.color}-active`]
      );
    }, 200); // Adjust the delay as needed

    if (defaultProps.onClick) {
      defaultProps.onClick();
    }
  };

  const getClassNames = () => {
    return [
      styles.button,
      styles[`button-${defaultProps.color}`],
      defaultProps.disabled ? styles['button-disabled'] : '',
    ].join(' ');
  };

  return (
    <button
      ref={(el) => (buttonElement = el)} // Attach ref to the button
      type={defaultProps.type as 'button' | 'submit' | 'reset'}
      class={getClassNames()}
      onClick={handleClick}
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
