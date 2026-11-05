import { createSignal } from 'solid-js';

export interface PageResult<T, Extra> {
  items: T[];
  total: number;
  totalPages: number;
  extra: Extra;
}

/**
 * Incrementally loaded list. `reload` restarts from the first page; responses of
 * superseded requests are ignored, so fast filter changes never show stale results.
 */
export function createPagedList<T, Extra>(
  fetchPage: (page: number) => Promise<PageResult<T, Extra>>
) {
  const [items, setItems] = createSignal<T[]>([]);
  const [total, setTotal] = createSignal(0);
  const [extra, setExtra] = createSignal<Extra | undefined>();
  const [page, setPage] = createSignal(0);
  const [totalPages, setTotalPages] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);
  const [error, setError] = createSignal<unknown>(null);
  let generation = 0;

  const apply = (result: PageResult<T, Extra>, nextPage: number) => {
    setPage(nextPage);
    setTotalPages(result.totalPages);
    setTotal(result.total);
    setExtra(() => result.extra);
  };

  const reload = async () => {
    const current = ++generation;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const result = await fetchPage(1);
      if (current !== generation) return;
      apply(result, 1);
      setItems(result.items);
    } catch (err) {
      if (current === generation) setError(err);
    } finally {
      if (current === generation) setLoading(false);
    }
  };

  const hasMore = () => page() < totalPages();

  const loadMore = async () => {
    if (loading() || loadingMore() || !hasMore()) return;
    const current = generation;
    setLoadingMore(true);
    try {
      const result = await fetchPage(page() + 1);
      if (current !== generation) return;
      apply(result, page() + 1);
      setItems((previous) => [...previous, ...result.items]);
    } catch (err) {
      if (current === generation) setError(err);
    } finally {
      if (current === generation) setLoadingMore(false);
    }
  };

  return {
    items,
    setItems,
    total,
    extra,
    setExtra,
    loading,
    loadingMore,
    error,
    hasMore,
    reload,
    loadMore,
  };
}

/** Calls `onNearEnd` when a scroll container is close to its bottom. */
export const onScrollNearEnd =
  (onNearEnd: () => void) =>
  (event: Event & { currentTarget: HTMLElement }) => {
    const element = event.currentTarget;
    if (
      element.scrollTop + element.clientHeight >=
      element.scrollHeight - 160
    ) {
      onNearEnd();
    }
  };
