import { Component, mergeProps, Show } from 'solid-js';
import './icon-button.scss'; // Import your custom CSS for styles
import { IconWrapper } from '../icon-wrapper';
import { VsLoading } from 'solid-icons/vs';

export const IconButton: Component<{
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: Component; // This should be a component (icon)
  color?: 'primary' | 'secondary' | 'danger' | 'success' | 'info';
  title?: string;
}> = (props) => {
  const defaultProps = mergeProps(
    {
      disabled: false,
      loading: false,
      color: 'primary', // Default color
    },
    props
  );

  return (
    <button
      class={`icon-button icon-button-${defaultProps.color} ${defaultProps.disabled || defaultProps.loading ? 'icon-button-disabled' : ''} ${defaultProps.loading ? 'icon-button-loading' : ''}`}
      onClick={defaultProps.loading ? undefined : defaultProps.onClick}
      disabled={defaultProps.disabled || defaultProps.loading}
      title={props.title || props.icon.name}
    >
      <Show
        when={defaultProps.loading}
        fallback={<IconWrapper icon={props.icon!} />}
      >
        <span class="icon-button-spinner">
          <VsLoading />
        </span>
      </Show>
    </button>
  );
};
