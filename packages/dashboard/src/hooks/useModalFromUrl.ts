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

  // Sync modal state with URL changes
  const syncModalWithUrl = () => {
    const itemId = getItemIdFromUrl();

    if (itemId) {
      // URL has itemId - open modal if not already open
      if (!untrack(isModalOpen)) {
        openModal(itemId);
      }
    } else {
      // URL has no itemId - close modal if open
      if (untrack(isModalOpen)) {
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
