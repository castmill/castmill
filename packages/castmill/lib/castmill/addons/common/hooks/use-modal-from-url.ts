import { createEffect, onMount, onCleanup, untrack, Accessor } from 'solid-js';

export interface UseModalFromUrlOptions<T> {
  /**
   * Function to get the itemId from URL parameters
   */
  getItemIdFromUrl: () => string | undefined;

  /**
   * Function that checks if modal is currently open
   */
  isModalOpen: Accessor<boolean>;

  /**
   * Function to close the modal
   */
  closeModal: () => void;

  /**
   * Function to open modal with an item
   * Can be async if item needs to be fetched
   */
  openModal: (itemId: string) => void | Promise<void>;
}

/**
 * Hook to sync modal state with URL itemId parameter.
 * Handles initial page load, URL changes, and browser back/forward navigation.
 *
 * @example
 * ```tsx
 * useModalFromUrl({
 *   getItemIdFromUrl: () => props.params?.[0]?.itemId,
 *   isModalOpen: () => showModal(),
 *   closeModal: () => setShowModal(false),
 *   openModal: (itemId) => {
 *     const item = data().find(d => String(d.id) === itemId);
 *     if (item) {
 *       setCurrentItem(item);
 *       setShowModal(true);
 *     }
 *   }
 * });
 * ```
 */
export function useModalFromUrl<T>(options: UseModalFromUrlOptions<T>) {
  const { getItemIdFromUrl, isModalOpen, closeModal, openModal } = options;

  // Helper function to sync modal state with URL
  const syncModalWithUrl = () => {
    const itemId = getItemIdFromUrl();

    if (itemId && !untrack(isModalOpen)) {
      // URL has itemId but modal is closed - open it
      openModal(itemId);
    } else if (!itemId && untrack(isModalOpen)) {
      // URL has no itemId but modal is open - close it
      closeModal();
    }
  };

  // Sync modal with URL on initial load and when URL changes
  createEffect(() => {
    // Track itemId in the effect so it re-runs when URL changes
    getItemIdFromUrl();
    syncModalWithUrl();
  });

  // Listen to browser back/forward navigation (popstate doesn't trigger createEffect for addon props)
  onMount(() => {
    window.addEventListener('popstate', syncModalWithUrl);

    onCleanup(() => {
      window.removeEventListener('popstate', syncModalWithUrl);
    });
  });
}
