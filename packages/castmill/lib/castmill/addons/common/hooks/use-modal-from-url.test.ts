import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeDetailUrl, detailUrlOptions } from './use-modal-from-url';

describe('detail history helpers', () => {
  afterEach(() => {
    window.history.replaceState(null, '');
    vi.restoreAllMocks();
  });

  it('pushes the first detail entry and replaces it when switching items', () => {
    expect(detailUrlOptions()).toEqual({
      replace: false,
      scroll: false,
      state: { castmillDetail: true },
    });

    window.history.replaceState(detailUrlOptions().state, '');
    expect(detailUrlOptions().replace).toBe(true);
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
