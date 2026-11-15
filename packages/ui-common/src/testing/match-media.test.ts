import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockMatchMedia, type MatchMediaMock } from './match-media';

describe('mockMatchMedia', () => {
  let mock: MatchMediaMock | undefined;
  const original = window.matchMedia;

  afterEach(() => {
    mock?.restore();
    mock = undefined;
  });

  it('matches every query for a boolean', () => {
    mock = mockMatchMedia(true);
    expect(window.matchMedia('(min-width: 1em)').matches).toBe(true);
    mock.set(false);
    expect(window.matchMedia('(min-width: 1em)').matches).toBe(false);
  });

  it('matches listed queries or a predicate', () => {
    mock = mockMatchMedia(['(pointer: coarse)']);
    expect(window.matchMedia('(pointer: coarse)').matches).toBe(true);
    expect(window.matchMedia('(hover: hover)').matches).toBe(false);
    mock.set((query) => query.startsWith('(max'));
    expect(window.matchMedia('(max-width: 3em)').matches).toBe(true);
    expect(mock.queries).toContain('(hover: hover)');
  });

  it('notifies listeners only when the result changes', () => {
    mock = mockMatchMedia(false);
    const list = window.matchMedia('(pointer: coarse)');
    const modern = vi.fn();
    const legacy = vi.fn();
    list.addEventListener('change', modern);
    list.addListener(legacy);

    mock.set(false);
    expect(modern).not.toHaveBeenCalled();

    mock.set(true);
    expect(modern).toHaveBeenCalledWith(
      expect.objectContaining({ matches: true, media: '(pointer: coarse)' })
    );
    expect(legacy).toHaveBeenCalledTimes(1);

    list.removeEventListener('change', modern);
    list.removeListener(legacy);
    mock.set(false);
    expect(modern).toHaveBeenCalledTimes(1);
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it('restores the original matchMedia', () => {
    mock = mockMatchMedia(true);
    mock.restore();
    expect(window.matchMedia).toBe(original);
  });
});
