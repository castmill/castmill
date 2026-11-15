import { afterEach, describe, expect, it } from 'vitest';
import { detailUrlOptions } from './useModalFromUrl';

describe('detailUrlOptions', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('marks a pushed list-to-detail navigation', () => {
    window.history.replaceState(null, '', '/org/org-1/channels');

    expect(detailUrlOptions()).toEqual({
      replace: false,
      scroll: false,
      state: { castmillDetail: true },
    });
  });

  it('replaces an unmarked deep-linked detail without marking it', () => {
    window.history.replaceState(null, '', '/org/org-1/channels?itemId=A');

    expect(detailUrlOptions()).toEqual({ replace: true, scroll: false });
  });

  it('replaces an already-marked detail', () => {
    window.history.replaceState({ castmillDetail: true }, '', '/');

    expect(detailUrlOptions()).toEqual({
      replace: true,
      scroll: false,
      state: { castmillDetail: true },
    });
  });
});
