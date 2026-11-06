/**
 * ComboBox Component.
 *
 * Allows to search and select items from a list.
 *
 */

import {
  createEffect,
  createSignal,
  For,
  JSX,
  onMount,
  onCleanup,
  Show,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { RiArrowsArrowUpSLine, RiArrowsArrowDownSLine } from 'solid-icons/ri';
import { AiOutlineSearch } from 'solid-icons/ai';
import { IoClose } from 'solid-icons/io';

import styles from './combobox.module.scss';
import { IconWrapper } from '../icon-wrapper';
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox';
import { IconTypes } from 'solid-icons';

const SimpleIconButton = (props: { icon: IconTypes; onClick: () => void }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      aria-label="Toggle Dropdown"
    >
      <IconWrapper icon={props.icon} />
    </button>
  );
};

interface ComboBoxProps<T extends { id: string | number }> {
  id: string | number;
  label: string;
  placeholder?: string;
  value?: T;
  fetchItems: (
    page: number,
    pageSize: number,
    searchQuery: string
  ) => Promise<{ count: number; data: T[] }>;
  renderItem: (item: T) => JSX.Element;
  onSelect: (item: T) => void; // Callback function for when selection changes
  clearable?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  /** Accessible name of the close button in the mobile sheet. */
  closeLabel?: string;
}

/** Touch and small screens pick from a bottom sheet instead of a dropdown. */
export const COMBOBOX_SHEET_QUERY =
  '(max-width: 36em), (pointer: coarse) and (max-width: 64em)';

type Placement = 'down' | 'up' | 'sheet';

const prefersSheet = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(COMBOBOX_SHEET_QUERY).matches;

const isClipping = (element: Element) =>
  /(auto|scroll|hidden)/.test(getComputedStyle(element).overflowY);

export const ComboBox = <T extends { id: string | number }>(
  props: ComboBoxProps<T>
): JSX.Element => {
  const viewportBox = useVisualViewportBox();
  let comboBoxRef: HTMLDivElement | undefined;
  let triggerRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  let sheetRootRef: HTMLDivElement | undefined;
  let sheetRef: HTMLDivElement | undefined;
  const triggerId = `${props.id.toString()}-trigger`;
  const dropdownId = `${props.id.toString()}-dropdown`;
  const sheetTitleId = `${props.id.toString()}-sheet-title`;
  const [isOpen, setIsOpenSignal] = createSignal(false);
  const [placement, setPlacement] = createSignal<Placement>('down');
  const [listMaxHeight, setListMaxHeight] = createSignal<string>();
  const [items, setItems] = createSignal<T[]>([]);
  const [selectedItem, setSelectedItem] = createSignal<T | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = createSignal('');
  const [page, setPage] = createSignal(1);
  const [totalItems, setTotalItems] = createSignal(0);
  const [loading, setLoading] = createSignal(false);

  const pageSize = 10; // Set page size as needed
  const scrollThreshold = 100;
  let debounceTimer: number | undefined;

  const reset = () => {
    setPage(1);
    setItems([]);
  };

  const fetchMoreItems = async () => {
    if (loading()) return;
    setLoading(true);

    // Fetch data only when necessary
    const result = await props.fetchItems(page(), pageSize, searchQuery());

    setTotalItems(result.count);
    setItems((currentItems: T[]) =>
      page() === 1 ? result.data : [...currentItems, ...result.data]
    );
    setPage((currentPage) => currentPage + 1);

    setLoading(false);
  };

  createEffect(() => {
    reset();
  }, [searchQuery()]);

  createEffect(() => {
    if (page() === 1) {
      fetchMoreItems();
    }

    setSelectedItem(props.value as Exclude<T, Function>);
  }, [page(), props.value]);

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLDivElement;

    // Not sure this is the best way to determine if we are at the bottom of the list
    if (
      target.scrollTop + target.clientHeight >=
        target.scrollHeight - scrollThreshold &&
      items().length < totalItems()
    ) {
      fetchMoreItems();
    }
  };

  // Opens towards the side with more room inside the clipping ancestors and
  // the viewport, and caps the list so the dropdown stays visible.
  const updatePlacement = () => {
    if (prefersSheet()) {
      setPlacement('sheet');
      setListMaxHeight(undefined);
      return;
    }

    const comboBox = comboBoxRef;
    if (!comboBox) {
      setPlacement('down');
      setListMaxHeight(undefined);
      return;
    }

    const rect = comboBox.getBoundingClientRect();
    if (rect.height === 0) {
      setPlacement('down');
      setListMaxHeight(undefined);
      return;
    }

    let top = 0;
    let bottom = window.innerHeight;
    for (
      let parent = comboBox.parentElement;
      parent && parent !== document.body;
      parent = parent.parentElement
    ) {
      if (isClipping(parent)) {
        const bounds = parent.getBoundingClientRect();
        top = Math.max(top, bounds.top);
        bottom = Math.min(bottom, bounds.bottom);
      }
    }

    const em = parseFloat(getComputedStyle(comboBox).fontSize) || 16;
    const below = bottom - rect.bottom;
    const above = rect.top - top;
    const opensUp = below < 22 * em && above > below;
    // Room left for the list after the search box, footer and gap.
    const room = (opensUp ? above : below) - 6.5 * em;

    setPlacement(opensUp ? 'up' : 'down');
    setListMaxHeight(`${Math.max(8 * em, Math.min(18 * em, room))}px`);
  };

  const setIsOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(isOpen()) : value;
    if (next && !isOpen()) {
      updatePlacement();
    }
    setIsOpenSignal(next);
  };

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      triggerRef?.focus();
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target as Node;

    if (!comboBoxRef?.contains(target) && !sheetRootRef?.contains(target)) {
      setIsOpen(false);
    }
  };

  // Window capture runs before the document listeners of modals and drawers,
  // so Escape closes only the open list.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab' && isOpen() && placement() === 'sheet') {
      const focusable = sheetRef?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable?.[0];
      const last = focusable?.[focusable.length - 1];
      const active = document.activeElement;

      if (!first || !last) {
        event.preventDefault();
        sheetRef?.focus();
      } else if (!sheetRef?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === sheetRef)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  onMount(() => {
    // Use capture phase so outside detection is consistent regardless of bubbling handlers.
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
  });

  onCleanup(() => {
    document.removeEventListener('pointerdown', handlePointerDown, true);
    window.removeEventListener('keydown', handleKeyDown, true);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  createEffect(() => {
    if (!isOpen()) {
      return;
    }

    if (placement() === 'sheet') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Focus the sheet rather than the search box so the keyboard stays
      // closed until the user asks for it.
      queueMicrotask(() => sheetRef?.focus());
      onCleanup(() => {
        document.body.style.overflow = originalOverflow;
      });
      return;
    }

    requestAnimationFrame(() =>
      dropdownRef?.scrollIntoView?.({ block: 'nearest' })
    );
  });

  const handleSelect = (item: T) => {
    setSelectedItem(item as Exclude<T, Function>);
    props.onSelect(item);
    // Optionally close the dropdown or take other actions
    close(true);
  };

  const handleClear = () => {
    setSelectedItem(undefined);
    props.onClear?.();
    close(true);
  };

  const shouldShowClear = () =>
    props.clearable && selectedItem() !== null && selectedItem() !== undefined;

  const search = (query: string) => {
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer to delay search
    debounceTimer = setTimeout(() => {
      setSearchQuery(query);
      setPage(1);
      fetchMoreItems();
    }, 300) as unknown as number; // 300ms debounce delay
  };

  const handleHeaderKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  const listContent = () => (
    <>
      <div class={styles['search-box']}>
        <div class={styles['search-icon']}>
          <IconWrapper icon={AiOutlineSearch} />
        </div>
        <input
          id={typeof props.id == 'string' ? props.id : props.id.toString()}
          type="text"
          placeholder={props.placeholder || 'Search...'}
          onInput={(e) => search(e.currentTarget.value)}
          value={searchQuery()}
        />
      </div>

      <div
        class={styles['items-list']}
        style={listMaxHeight() ? { 'max-height': listMaxHeight() } : undefined}
        onScroll={handleScroll}
      >
        <For each={items()}>
          {(item) => (
            <div
              class={`${styles['item']} ${
                selectedItem()?.id === item.id ? styles['selected'] : ''
              }`}
              onClick={() => handleSelect(item)}
            >
              {props.renderItem(item)}
            </div>
          )}
        </For>
      </div>
      <div class={styles['footer']}>
        <Show
          when={loading()}
          fallback={
            <span>
              Showing {items().length} of {totalItems()} items
            </span>
          }
        >
          <div>Loading...</div>
        </Show>
      </div>
    </>
  );

  return (
    <div class={styles['combo-box']} ref={comboBoxRef}>
      <div
        ref={triggerRef}
        id={triggerId}
        class={`${styles['base-box']} ${styles['header']}`}
        role="button"
        tabindex={0}
        aria-expanded={isOpen()}
        aria-controls={dropdownId}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleHeaderKeyDown}
      >
        <div class={styles['info']}>
          <div class={styles['label']}>{props.label}</div>

          <div class="selected-item">
            {selectedItem()
              ? props.renderItem(selectedItem()!)
              : props.placeholder || 'Select an item'}
          </div>
        </div>

        <div class={styles['actions']}>
          <Show
            when={shouldShowClear()}
            fallback={
              <Show
                when={isOpen()}
                fallback={
                  <SimpleIconButton
                    icon={RiArrowsArrowDownSLine}
                    onClick={() => setIsOpen(true)}
                  />
                }
              >
                <SimpleIconButton
                  icon={RiArrowsArrowUpSLine}
                  onClick={() => setIsOpen(false)}
                />
              </Show>
            }
          >
            <button
              type="button"
              class={styles['clear-button']}
              aria-label={props.clearLabel || 'Clear selection'}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <IconWrapper icon={IoClose} />
            </button>
          </Show>
        </div>
      </div>

      <Show when={isOpen() && placement() !== 'sheet'}>
        <div
          ref={dropdownRef}
          id={dropdownId}
          class={`${styles['base-box']} ${styles['dropdown']} ${
            placement() === 'up' ? styles['dropdown-up'] : ''
          }`}
          role="listbox"
          aria-labelledby={triggerId}
        >
          {listContent()}
        </div>
      </Show>

      <Show when={isOpen() && placement() === 'sheet'}>
        <Portal>
          <div
            ref={sheetRootRef}
            class={styles['sheet-backdrop']}
            style={viewportBox()}
            data-combobox-sheet
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                close(true);
              }
            }}
          >
            <div
              ref={sheetRef}
              id={dropdownId}
              class={styles['sheet']}
              role="dialog"
              aria-modal="true"
              aria-labelledby={sheetTitleId}
              tabindex={-1}
            >
              <div class={styles['sheet-handle']} aria-hidden="true" />
              <header class={styles['sheet-header']}>
                <h2 id={sheetTitleId}>{props.label || props.placeholder}</h2>
                <button
                  type="button"
                  class={styles['sheet-close']}
                  aria-label={props.closeLabel || 'Close'}
                  onClick={() => close(true)}
                >
                  <IconWrapper icon={IoClose} />
                </button>
              </header>
              {listContent()}
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};
