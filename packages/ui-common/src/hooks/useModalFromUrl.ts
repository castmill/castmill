import { createEffect, onCleanup, onMount, untrack } from 'solid-js';

/**
 * History state key marking an entry that was pushed when a list item's
 * details were opened. Shared by every list page and TableView so Back closes
 * the details instead of leaving the list.
 */
export const DETAIL_HISTORY_KEY = 'castmillDetail';

export const isDetailHistoryEntry = () =>
  Boolean(window.history.state?.[DETAIL_HISTORY_KEY]);

export interface UseModalFromUrlOptions {
  /** Returns the current itemId from the URL. */
  getItemIdFromUrl: () => string | undefined;
  /** Returns whether the modal/drawer is currently open. */
  isModalOpen: () => boolean;
  closeModal: () => void;
  /** Opens the modal for an item; may fetch the item asynchronously. */
  openModal: (itemId: string) => void | Promise<void>;
}

/**
 * Synchronizes modal/drawer state with the URL `itemId` parameter: opens it
 * for deep links, switches item when `itemId` changes, and closes it when the
 * parameter is removed (including browser back/forward via popstate, which
 * addon props do not track reactively).
 *
 * @example
 * ```tsx
 * useModalFromUrl({
 *   getItemIdFromUrl: () => searchParams.itemId,
 *   isModalOpen: () => showModal(),
 *   closeModal: () => setShowModal(false),
 *   openModal: (itemId) => {
 *     const item = data().find((d) => String(d.id) === String(itemId));
 *     if (item) {
 *       setCurrentItem(item);
 *       setShowModal(true);
 *     }
 *   },
 * });
 * ```
 */
export function useModalFromUrl(options: UseModalFromUrlOptions): void {
  const { getItemIdFromUrl, isModalOpen, closeModal, openModal } = options;
  let previousItemId: string | undefined;

  const syncModalWithUrl = () => {
    const itemId = getItemIdFromUrl();
    const modalOpen = untrack(isModalOpen);

    if (itemId) {
      if (!modalOpen || itemId !== previousItemId) {
        openModal(itemId);
      }
      previousItemId = itemId;
    } else {
      previousItemId = undefined;
      if (modalOpen) {
        closeModal();
      }
    }
  };

  createEffect(() => {
    getItemIdFromUrl();
    syncModalWithUrl();
  });

  onMount(() => {
    window.addEventListener('popstate', syncModalWithUrl);
    onCleanup(() => window.removeEventListener('popstate', syncModalWithUrl));
  });
}

/**
 * Router navigation options for showing an item's details. The first item
 * opened from a list gets its own marked history entry; switching items while
 * a detail is open replaces the current entry.
 */
export const detailUrlOptions = (
  detailAlreadyOpen = new URLSearchParams(window.location.search).has('itemId')
) => {
  const isMarkedDetail = isDetailHistoryEntry();
  return {
    replace: isMarkedDetail || detailAlreadyOpen,
    scroll: false,
    ...(isMarkedDetail || !detailAlreadyOpen
      ? { state: { [DETAIL_HISTORY_KEY]: true } }
      : {}),
  };
};

/**
 * Removes the item from the URL when its details are closed from the UI. Goes
 * back to the list entry that opened them, or calls `removeItemFromUrl` (which
 * should navigate with `replace: true`) for deep links.
 */
export const closeDetailUrl = (removeItemFromUrl: () => void) => {
  if (isDetailHistoryEntry()) {
    window.history.back();
  } else {
    removeItemFromUrl();
  }
};
