import { createEffect, onCleanup, onMount, untrack } from 'solid-js';

/**
 * Custom hook to synchronize modal state with URL itemId parameter.
 *
 * This hook handles:
 * - Opening modal when itemId appears in URL (e.g., from search results or shareable links)
 * - Closing modal when itemId is removed from URL (e.g., browser back button)
 * - Browser back/forward navigation via popstate events
 *
 * @param options - Configuration object
 * @param options.getItemIdFromUrl - Function that returns the current itemId from URL params
 * @param options.isModalOpen - Function that returns whether the modal is currently open
 * @param options.closeModal - Function to close the modal
 * @param options.openModal - Function to open the modal for a given itemId
 *
 * @example
 * ```tsx
 * useModalFromUrl({
 *   getItemIdFromUrl: () => searchParams.itemId,
 *   isModalOpen: () => showModal(),
 *   closeModal: () => setShowModal(false),
 *   openModal: (itemId) => {
 *     const item = data().find(d => String(d.id) === String(itemId));
 *     if (item) {
 *       setCurrentItem(item);
 *       setShowModal(true);
 *     }
 *   }
 * });
 * ```
 */
export function useModalFromUrl(options: {
  getItemIdFromUrl: () => string | undefined;
  isModalOpen: () => boolean;
  closeModal: () => void;
  openModal: (itemId: string) => void;
}): void {
  const { getItemIdFromUrl, isModalOpen, closeModal, openModal } = options;
  let previousItemId: string | undefined;

  // Sync modal state with URL changes
  const syncModalWithUrl = () => {
    const itemId = getItemIdFromUrl();
    const modalOpen = untrack(isModalOpen);

    if (itemId) {
      // URL has itemId - open modal when closed OR when item selection changed
      const itemChanged = itemId !== previousItemId;
      if (!modalOpen || itemChanged) {
        openModal(itemId);
      }
      previousItemId = itemId;
    } else {
      // URL has no itemId - close modal if open
      previousItemId = undefined;
      if (modalOpen) {
        closeModal();
      }
    }
  };

  // React to URL parameter changes
  createEffect(() => {
    getItemIdFromUrl(); // Track the itemId
    syncModalWithUrl();
  });

  // Handle browser back/forward navigation
  onMount(() => {
    const handlePopState = () => {
      syncModalWithUrl();
    };

    window.addEventListener('popstate', handlePopState);

    onCleanup(() => {
      window.removeEventListener('popstate', handlePopState);
    });
  });
}

const DETAIL_ENTRY = 'castmillDetail';

const isDetailEntry = () => Boolean(window.history.state?.[DETAIL_ENTRY]);

/**
 * Router navigation options for showing an item's details. The first item
 * opened from a list gets its own marked history entry; switching items while
 * a detail is open replaces the current entry.
 */
export const detailUrlOptions = (
  detailAlreadyOpen = new URLSearchParams(window.location.search).has('itemId')
) => {
  const isMarkedDetail = isDetailEntry();
  return {
    replace: isMarkedDetail || detailAlreadyOpen,
    scroll: false,
    ...(isMarkedDetail || !detailAlreadyOpen
      ? { state: { [DETAIL_ENTRY]: true } }
      : {}),
  };
};

/**
 * Removes the item from the URL when its details are closed from the UI. Goes
 * back to the list entry that opened them, or calls `removeItemFromUrl` (which
 * should navigate with `replace: true`) for deep links.
 */
export const closeDetailUrl = (removeItemFromUrl: () => void) => {
  if (isDetailEntry()) {
    window.history.back();
  } else {
    removeItemFromUrl();
  }
};
