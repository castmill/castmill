import {
  Component,
  For,
  Show,
  createSignal,
  mergeProps,
  onCleanup,
  onMount,
} from 'solid-js';
import { Button } from '../button/button';

import './menu-button.scss';

export interface MenuButtonItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export type MenuButtonSize = 'small' | 'medium' | 'large';

interface MenuButtonProps {
  label: string;
  items: MenuButtonItem[];
  disabled?: boolean;
  size?: MenuButtonSize;
}

export const MenuButton: Component<MenuButtonProps> = (props) => {
  const mergedProps = mergeProps({ size: 'medium' as MenuButtonSize }, props);
  const [open, setOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;

  const handleOutsideClick = (event: MouseEvent) => {
    if (!rootRef || rootRef.contains(event.target as Node)) {
      return;
    }

    setOpen(false);
  };

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
  });

  onCleanup(() => {
    document.removeEventListener('click', handleOutsideClick);
  });

  return (
    <div
      class="castmill-menu-button"
      classList={{
        'castmill-menu-button-size-small': mergedProps.size === 'small',
        'castmill-menu-button-size-medium': mergedProps.size === 'medium',
        'castmill-menu-button-size-large': mergedProps.size === 'large',
      }}
      ref={rootRef}
    >
      <Button
        class="castmill-menu-button-trigger"
        label={`${mergedProps.label} ▾`}
        color="secondary"
        disabled={mergedProps.disabled}
        onClick={() => setOpen((value) => !value)}
      />

      <Show when={open()}>
        <div class="castmill-menu-button-items" role="menu">
          <For each={props.items}>
            {(item) => (
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
