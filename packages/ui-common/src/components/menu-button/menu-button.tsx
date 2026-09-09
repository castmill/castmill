import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  createUniqueId,
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
  const menuId = `castmill-menu-button-${createUniqueId()}`;
  let rootRef: HTMLDivElement | undefined;
  let triggerRef: HTMLButtonElement | undefined;
  let menuRef: HTMLDivElement | undefined;

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

  createEffect(() => {
    if (!open()) {
      return;
    }

    const firstEnabledItem = menuRef?.querySelector(
      'button[role="menuitem"]:not(:disabled)'
    ) as HTMLButtonElement | null;

    firstEnabledItem?.focus();
  });

  const closeMenu = () => {
    setOpen(false);
    triggerRef?.focus();
  };

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
        ref={triggerRef}
        class="castmill-menu-button-trigger"
        label={`${mergedProps.label} ▾`}
        color="secondary"
        disabled={mergedProps.disabled}
        aria-haspopup="menu"
        aria-expanded={open()}
        aria-controls={menuId}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
        onClick={() => setOpen((value) => !value)}
      />

      <Show when={open()}>
        <div
          class="castmill-menu-button-items"
          id={menuId}
          role="menu"
          ref={menuRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeMenu();
            }
          }}
        >
          <For each={mergedProps.items}>
            {(item) => (
              <button
                id={`${menuId}-item-${item.key}`}
                data-key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  closeMenu();
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
