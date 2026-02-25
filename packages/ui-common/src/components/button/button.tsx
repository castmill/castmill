import { Component, mergeProps, Show, splitProps, JSX } from 'solid-js';
import { IconTypes } from 'solid-icons';
import { IconWrapper } from '../icon-wrapper';
import { VsLoading } from 'solid-icons/vs';

import styles from './button.module.scss';

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconTypes; // This can be any SVG component from solid-icons or other libraries
  iconProps?: Record<string, any>;
  type?: 'button' | 'submit' | 'reset';
  label?: string | (() => string);
  color?: 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'warning';
  title?: string;
};

export const Button: Component<ButtonProps> = (props) => {
  const mergedProps = mergeProps(
    {
      type: 'button',
      disabled: false,
      loading: false,
      color: 'primary', // Default color
      title: undefined as string | undefined,
    },
    props
  );

  const [local, others] = splitProps(mergedProps, [
    'onClick',
    'disabled',
    'loading',
    'icon',
    'iconProps',
    'type',
    'label',
    'color',
    'title',
    'class',
    'classList',
  ]);

  let buttonElement: HTMLButtonElement | null = null;

  const handleClick = () => {
    if (!buttonElement || local.disabled || local.loading) return;

    // Add the "pressed" class to the current button
    buttonElement.classList.add(styles[`button-${local.color}-active`]);

    // Remove the "pressed" class after a short delay
    setTimeout(() => {
      buttonElement?.classList.remove(styles[`button-${local.color}-active`]);
    }, 200); // Adjust the delay as needed

    if (local.onClick) {
      local.onClick();
    }
  };

  const getClassNames = () => {
    return [
      styles.button,
      styles[`button-${local.color}`],
      local.disabled || local.loading ? styles['button-disabled'] : '',
      local.loading ? styles['button-loading'] : '',
      local.class || '',
    ].join(' ');
  };

  const getLabel = () =>
    typeof local.label === 'function' ? local.label() : local.label;

  const ariaLabel = () => getLabel() || local.title;

  return (
    <button
      ref={(el) => (buttonElement = el)} // Attach ref to the button
      type={local.type as 'button' | 'submit' | 'reset'}
      class={getClassNames()}
      onClick={handleClick}
      disabled={local.disabled || local.loading}
      title={local.title}
      aria-label={ariaLabel()}
      classList={local.classList}
      {...others}
    >
      <Show
        when={local.loading}
        fallback={
          <>
            <Show when={local.icon}>
              <IconWrapper icon={local.icon!} />
            </Show>
            {getLabel() ? <span>{getLabel()}</span> : null}
          </>
        }
      >
        <span class={styles.spinner}>
          <VsLoading />
        </span>
        {getLabel() ? <span>{getLabel()}</span> : null}
      </Show>
    </button>
  );
};
