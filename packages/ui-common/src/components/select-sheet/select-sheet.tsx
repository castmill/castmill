import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { IoClose } from 'solid-icons/io';
import { IconWrapper } from '../icon-wrapper';
import { prefersPickerSheet } from '../combobox/combobox';
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox';
import styles from './select-sheet.module.scss';

export interface SelectSheetHostProps {
  /** Accessible name of the sheet's close button. */
  closeLabel?: string;
  /** Sheet title used when the select has no label. */
  fallbackTitle?: string;
}

interface SheetOption {
  index: number;
  label: string;
  disabled: boolean;
  group?: string;
}

interface SheetState {
  select: HTMLSelectElement;
  title: string;
  options: SheetOption[];
  selectedIndex: number;
  restoreFocus: boolean;
}

/** Selects with this attribute keep the native picker on every screen. */
export const NATIVE_SELECT_ATTRIBUTE = 'data-native-select';

const TAP_SLOP_PX = 10;

const findSelect = (target: EventTarget | null) => {
  const element =
    target instanceof Element
      ? target.closest('select')
      : target instanceof Node
        ? target.parentElement?.closest('select')
        : null;

  if (
    !element ||
    element.multiple ||
    element.size > 1 ||
    element.disabled ||
    element.hasAttribute(NATIVE_SELECT_ATTRIBUTE)
  ) {
    return undefined;
  }

  return element;
};

const textOf = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim() || '';

const titleFor = (select: HTMLSelectElement) => {
  const labelledBy = select.getAttribute('aria-labelledby');
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => textOf(document.getElementById(id)))
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  return (
    select.getAttribute('aria-label')?.trim() ||
    textOf(select.labels?.[0]) ||
    select.title.trim()
  );
};

const readOptions = (select: HTMLSelectElement): SheetOption[] =>
  Array.from(select.options)
    .filter((option) => !option.hidden)
    .map((option) => {
      const group =
        option.parentElement instanceof HTMLOptGroupElement
          ? option.parentElement
          : undefined;
      return {
        index: option.index,
        label: option.label || textOf(option),
        disabled: option.disabled || !!group?.disabled,
        group: group?.label,
      };
    });

let sheetCount = 0;

/**
 * Replaces native `<select>` popups with a bottom sheet on phones and touch
 * tablets. Mobile browsers (and device emulation) can draw the native popup
 * detached from its control inside drawers and dialogs, so one document-level
 * host handles every single-choice select, including those rendered by addon
 * bundles. Picking an option updates the select and fires native `input` and
 * `change` events, so existing handlers keep working. Desktop keeps the native
 * dropdown.
 */
export const SelectSheetHost: Component<SelectSheetHostProps> = (props) => {
  const viewportBox = useVisualViewportBox();
  const titleId = `select-sheet-title-${++sheetCount}`;
  const [state, setState] = createSignal<SheetState>();
  let sheetRef: HTMLDivElement | undefined;
  let touchStart: { x: number; y: number; select: HTMLSelectElement } | null =
    null;
  let suppressMouseUntil = 0;

  const open = (select: HTMLSelectElement, restoreFocus: boolean) => {
    if (state()) return;
    setState({
      select,
      title: titleFor(select) || props.fallbackTitle || '',
      options: readOptions(select),
      selectedIndex: select.selectedIndex,
      restoreFocus,
    });
  };

  const close = () => {
    const current = state();
    if (!current) return;
    setState(undefined);
    // Refocusing after a tap would make iOS open its own picker.
    if (current.restoreFocus && current.select.isConnected) {
      current.select.focus({ preventScroll: true });
    }
  };

  const choose = (option: SheetOption) => {
    const current = state();
    if (!current || option.disabled) return;
    const { select } = current;

    if (select.isConnected && select.selectedIndex !== option.index) {
      select.selectedIndex = option.index;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    close();
  };

  const handleTouchStart = (event: TouchEvent) => {
    const select = prefersPickerSheet() ? findSelect(event.target) : undefined;
    const touch = event.touches[0];
    touchStart =
      select && touch && event.touches.length === 1
        ? { x: touch.clientX, y: touch.clientY, select }
        : null;
  };

  // Cancelling the tap's touchend stops the browser from focusing the select
  // and opening its own picker (iOS opens it on focus).
  const handleTouchEnd = (event: TouchEvent) => {
    const start = touchStart;
    touchStart = null;
    if (!start || !prefersPickerSheet()) return;

    const touch = event.changedTouches[0];
    const moved =
      !touch ||
      Math.abs(touch.clientX - start.x) > TAP_SLOP_PX ||
      Math.abs(touch.clientY - start.y) > TAP_SLOP_PX;
    if (moved || findSelect(event.target) !== start.select) return;

    event.preventDefault();
    suppressMouseUntil = Date.now() + 800;
    open(start.select, false);
  };

  const handleMouseDown = (event: MouseEvent) => {
    if (!prefersPickerSheet()) return;
    const select = findSelect(event.target);
    if (!select) return;

    event.preventDefault();
    if (Date.now() < suppressMouseUntil || event.button !== 0) return;
    open(select, true);
  };

  const focusables = () =>
    Array.from(
      sheetRef?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
        []
    );

  const trapFocus = (backwards: boolean) => {
    const items = focusables();
    if (items.length === 0) {
      sheetRef?.focus();
      return;
    }
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = backwards
      ? index <= 0
        ? items.length - 1
        : index - 1
      : index < 0 || index === items.length - 1
        ? 0
        : index + 1;
    items[next].focus();
  };

  // Window capture runs before modal and drawer handlers, so Escape and Tab
  // stay inside the sheet.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (state()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        trapFocus(event.shiftKey);
      }
      return;
    }

    if (!prefersPickerSheet()) return;
    const select = findSelect(event.target);
    if (!select) return;

    const opensPicker =
      event.key === ' ' ||
      event.key === 'Enter' ||
      event.key === 'F4' ||
      (event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'));
    if (opensPicker) {
      event.preventDefault();
      event.stopPropagation();
      open(select, true);
    }
  };

  const handleListKeyDown = (event: KeyboardEvent) => {
    const options = Array.from(
      (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        '[role="option"]:not(:disabled)'
      )
    );
    if (options.length === 0) return;
    const index = options.indexOf(document.activeElement as HTMLElement);
    let next: number;

    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(index + 1, options.length - 1);
        break;
      case 'ArrowUp':
        next = index < 0 ? options.length - 1 : Math.max(index - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    options[next].focus();
  };

  // The sheet is portalled outside its select, so keep its taps from reaching
  // outside-click handlers of the popover or menu that owns the select.
  const isolateEvents = (element: HTMLDivElement) => {
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
      element.addEventListener(type, (event) => event.stopPropagation());
    }
  };

  onMount(() => {
    document.addEventListener('touchstart', handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener('touchend', handleTouchEnd, {
      capture: true,
      passive: false,
    });
    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown, true);

    onCleanup(() => {
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    });
  });

  createEffect(() => {
    const current = state();
    if (!current) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Close when the select goes away, e.g. its drawer was dismissed.
    const watcher = window.setInterval(() => {
      if (!current.select.isConnected) setState(undefined);
    }, 500);

    queueMicrotask(() => {
      const selected = sheetRef?.querySelector<HTMLElement>(
        '[role="option"][aria-selected="true"]'
      );
      selected?.scrollIntoView?.({ block: 'nearest' });
      (current.restoreFocus && selected ? selected : sheetRef)?.focus({
        preventScroll: true,
      });
    });

    onCleanup(() => {
      window.clearInterval(watcher);
      document.body.style.overflow = originalOverflow;
    });
  });

  return (
    <Show when={state()}>
      {(current) => (
        <Portal>
          <div
            class={styles.backdrop}
            style={viewportBox()}
            data-select-sheet
            data-combobox-sheet
            ref={isolateEvents}
            on:click={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div
              ref={sheetRef}
              class={styles.sheet}
              role="dialog"
              aria-modal="true"
              aria-labelledby={current().title ? titleId : undefined}
              aria-label={current().title ? undefined : props.fallbackTitle}
              tabindex={-1}
            >
              <div class={styles.handle} aria-hidden="true" />
              <header class={styles.header}>
                <h2 id={titleId}>{current().title}</h2>
                <button
                  type="button"
                  class={styles.close}
                  aria-label={props.closeLabel || 'Close'}
                  on:click={close}
                >
                  <IconWrapper icon={IoClose} />
                </button>
              </header>
              <div
                class={styles.list}
                role="listbox"
                aria-labelledby={current().title ? titleId : undefined}
                aria-label={current().title ? undefined : props.fallbackTitle}
                onKeyDown={handleListKeyDown}
              >
                <For each={current().options}>
                  {(option, i) => (
                    <>
                      <Show
                        when={
                          option.group &&
                          option.group !== current().options[i() - 1]?.group
                        }
                      >
                        <div class={styles.group} role="presentation">
                          {option.group}
                        </div>
                      </Show>
                      <button
                        type="button"
                        role="option"
                        class={styles.option}
                        classList={{
                          [styles.selected]:
                            option.index === current().selectedIndex,
                        }}
                        aria-selected={option.index === current().selectedIndex}
                        disabled={option.disabled}
                        on:click={() => choose(option)}
                      >
                        {option.label}
                      </button>
                    </>
                  )}
                </For>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </Show>
  );
};
