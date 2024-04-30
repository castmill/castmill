/**
 * Dropdown Component.
 *
 * Items for the side panel.
 * @param items - The items to display.
 *
 */

import { Component, onCleanup, children, JSX, For } from 'solid-js';
import './dropdown-menu.scss';

import { createSignal, onMount, Show } from 'solid-js';
import { FaSolidAngleDown, FaSolidAngleUp } from 'solid-icons/fa';

interface DropdownMenuProps {
  ButtonComponent: Component<{ onClick: () => void }>; // Define prop for custom button component
  children: JSX.Element;
}

const DropdownMenu: Component<DropdownMenuProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [positionStyle, setPositionStyle] = createSignal({});

  let buttonRef: HTMLDivElement;
  let menuRef: HTMLUListElement;

  const menuItems = children(() => props.children).toArray();

  const toggleDropdown = () => setIsOpen(!isOpen());

  const handleClickOutside = (event: MouseEvent) => {
    if (
      event.target &&
      isOpen() &&
      !buttonRef.contains(event.target as Node) &&
      !menuRef.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleClickOutside);

    const buttonRect = buttonRef.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    const menuHeight = 200; // Approximate height of your menu

    // Note: this logic does not work yet, but it's a good starting point
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      // Position above if there is not enough space below and more space above
      setPositionStyle({ bottom: `${buttonRect.height}px` });
    } else {
      // Position below by default
      setPositionStyle({ top: `${buttonRect.height}px` });
    }
  });

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  return (
    <div class="castmill-dropdown-menu">
      <div class="container">
        <div ref={buttonRef!} class="button-container" onClick={toggleDropdown}>
          <props.ButtonComponent onClick={toggleDropdown} />
          <Show when={isOpen()} fallback={<FaSolidAngleDown />}>
            <FaSolidAngleUp />
          </Show>
        </div>
        <ul
          ref={menuRef!}
          style={positionStyle()}
          class={`${isOpen() ? 'open' : 'close'} menu`}
        >
          <For each={menuItems}>{(item) => <li>{item}</li>}</For>
        </ul>
      </div>
    </div>
  );
};

export default DropdownMenu;
