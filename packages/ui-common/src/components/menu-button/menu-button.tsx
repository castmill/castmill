import {
  Component,
  For,
  Show,
  createSignal,
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

interface MenuButtonProps {
  label: string;
  items: MenuButtonItem[];
  disabled?: boolean;
}

export const MenuButton: Component<MenuButtonProps> = (props) => {
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
    <div class="castmill-menu-button" ref={rootRef}>
      <Button
        label={`${props.label} ▾`}
        color="secondary"
        disabled={props.disabled}
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
