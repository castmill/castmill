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
  onCleanup,
  Show,
} from 'solid-js';
import { RiArrowsArrowUpSLine, RiArrowsArrowDownSLine } from 'solid-icons/ri';
import { AiOutlineSearch } from 'solid-icons/ai';

import styles from './combobox.module.scss';
import { IconWrapper } from '../icon-wrapper';
import { IconTypes } from 'solid-icons';

const SimpleIconButton = (props: { icon: IconTypes; onClick: () => void }) => {
  return (
    <button onClick={props.onClick} role="button" aria-label="Toggle Dropdown">
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
}

export const ComboBox = <T extends { id: string | number }>(
  props: ComboBoxProps<T>
): JSX.Element => {
  const [isOpen, setIsOpen] = createSignal(false);
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

  // Define ref for the ComboBox container
  let headerRef: HTMLDivElement | undefined;
  let dropdownRef: HTMLDivElement | undefined;
  const handleClick = (event: MouseEvent) => {
    if (headerRef?.contains(event.target as Node)) {
      setIsOpen(!isOpen());
    } else if (!dropdownRef?.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  // Add event listeners to handle clicks outside the ComboBox
  document.addEventListener('click', handleClick);

  onCleanup(() => {
    document.removeEventListener('click', handleClick);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  const handleSelect = (item: T) => {
    setSelectedItem(item as Exclude<T, Function>);
    props.onSelect(item);
    // Optionally close the dropdown or take other actions
    setIsOpen(false);
  };

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

  return (
    <div class={styles['combo-box']}>
      <div class={`${styles['base-box']} ${styles['header']}`} ref={headerRef}>
        <div class={styles['info']}>
          <div class={styles['label']}>{props.label}</div>

          <div class="selected-item">
            {selectedItem()
              ? props.renderItem(selectedItem()!)
              : props.placeholder || 'Select an item'}
          </div>
        </div>

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
      </div>

      <Show when={isOpen()}>
        <div
          class={`${styles['base-box']} ${styles['dropdown']}`}
          ref={dropdownRef}
        >
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

          <div class={styles['items-list']} onScroll={handleScroll}>
            <For each={items()}>
              {(item) => (
                <div class={styles['item']} onClick={() => handleSelect(item)}>
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
        </div>
      </Show>
    </div>
  );
};
