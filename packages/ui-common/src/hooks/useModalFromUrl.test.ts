import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import {
  closeDetailUrl,
  detailUrlOptions,
  useModalFromUrl,
} from './useModalFromUrl';

describe('detail history helpers', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('marks a pushed list-to-detail navigation', () => {
    window.history.replaceState(null, '', '/org/org-1/channels');

    expect(detailUrlOptions()).toEqual({
      replace: false,
      scroll: false,
      state: { castmillDetail: true },
    });
  });

  it('replaces an already-marked detail when switching items', () => {
    window.history.replaceState({ castmillDetail: true }, '', '/');

    expect(detailUrlOptions()).toEqual({
      replace: true,
      scroll: false,
      state: { castmillDetail: true },
    });
  });

  it('replaces an unmarked deep-linked detail without marking it', () => {
    window.history.replaceState(null, '', '/org/org-1/channels?itemId=A');

    expect(detailUrlOptions()).toEqual({ replace: true, scroll: false });
  });

  it('replaces path-based details without marking them', () => {
    expect(detailUrlOptions(true)).toEqual({ replace: true, scroll: false });
  });

  it('goes back to the list entry that opened the details', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const removeItemFromUrl = vi.fn();
    window.history.replaceState({ castmillDetail: true }, '');

    closeDetailUrl(removeItemFromUrl);

    expect(back).toHaveBeenCalledOnce();
    expect(removeItemFromUrl).not.toHaveBeenCalled();
  });

  it('removes the item from deep-linked URLs instead of leaving the page', () => {
    const back = vi.spyOn(window.history, 'back');
    const removeItemFromUrl = vi.fn();

    closeDetailUrl(removeItemFromUrl);

    expect(removeItemFromUrl).toHaveBeenCalledOnce();
    expect(back).not.toHaveBeenCalled();
  });
});

describe('useModalFromUrl', () => {
  it('opens, switches and closes the modal as the URL itemId changes', () => {
    const [itemId, setItemId] = createSignal<string | undefined>('A');
    const [open, setOpen] = createSignal(false);
    const openModal = vi.fn(() => setOpen(true));
    const closeModal = vi.fn(() => setOpen(false));

    const dispose = createRoot((dispose) => {
      useModalFromUrl({
        getItemIdFromUrl: itemId,
        isModalOpen: open,
        closeModal,
        openModal,
      });
      return dispose;
    });

    expect(openModal).toHaveBeenLastCalledWith('A');

    setItemId('B');
    expect(openModal).toHaveBeenLastCalledWith('B');
    expect(openModal).toHaveBeenCalledTimes(2);

    setItemId(undefined);
    expect(closeModal).toHaveBeenCalledOnce();
    expect(open()).toBe(false);

    dispose();
  });
});
