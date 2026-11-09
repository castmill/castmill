import {
  Component,
  For,
  Index,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { Button, useToast } from '@castmill/ui-common';
import { BsSearch, BsShieldLock } from 'solid-icons/bs';
import {
  NetworkService,
  NetworkWidgetAccess,
  NetworkWidgetAccessList,
  WidgetAccessMode,
  WidgetKind,
} from '../../services/network.service';
import { useI18n } from '../../i18n';
import { createPagedList, onScrollNearEnd } from './widget-access/paged-list';
import { AccessStatus } from './widget-access/access-ui';
import { WidgetIcon, widgetName } from './widget-access/widget-icon';
import { WidgetDetail } from './widget-access/widget-detail';
import networkStyles from './network.module.scss';
import styles from './widget-access/widget-access.module.scss';

const PAGE_SIZE = 50;

type Summary = NetworkWidgetAccessList['summary'];
type AccessFilter = WidgetAccessMode | 'any';
type KindFilter = WidgetKind | 'any';

const NetworkWidgets: Component = () => {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [searchInput, setSearchInput] = createSignal('');
  const [search, setSearch] = createSignal('');
  const [access, setAccess] = createSignal<AccessFilter>('any');
  const [kind, setKind] = createSignal<KindFilter>('any');
  const [selected, setSelected] = createSignal<NetworkWidgetAccess | null>(
    null
  );
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let listElement: HTMLDivElement | undefined;

  onCleanup(() => clearTimeout(debounce));

  const widgets = createPagedList<NetworkWidgetAccess, Summary>(
    async (page) => {
      const result = await NetworkService.listWidgetAccess({
        page,
        pageSize: PAGE_SIZE,
        search: search() || undefined,
        kind: kind() === 'any' ? undefined : (kind() as WidgetKind),
        access: access() === 'any' ? undefined : (access() as WidgetAccessMode),
      });
      return {
        items: result.data,
        total: result.pagination.total_count,
        totalPages: result.pagination.total_pages,
        extra: result.summary,
      };
    }
  );

  createEffect(on([search, access, kind], () => void widgets.reload()));

  createEffect(() => {
    if (widgets.error()) toast.error(t('network.widgets.errors.load'));
  });

  // Select the first widget once results arrive, unless one is already selected.
  createEffect(() => {
    const first = widgets.items()[0];
    if (!selected() && first) setSelected(first);
  });

  const onSearchInput = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounce);
    debounce = setTimeout(() => setSearch(value.trim()), 250);
  };

  const clearFilters = () => {
    clearTimeout(debounce);
    setSearchInput('');
    setSearch('');
    setAccess('any');
    setKind('any');
  };

  const hasFilters = () =>
    search() !== '' || access() !== 'any' || kind() !== 'any';

  const onWidgetChange = (updated: NetworkWidgetAccess) => {
    const previous =
      widgets.items().find((widget) => widget.id === updated.id) ??
      (selected()?.id === updated.id ? selected() : undefined);

    if (previous && previous.access !== updated.access) {
      widgets.setExtra((summary) =>
        summary
          ? {
              ...summary,
              [previous.access]: Math.max(summary[previous.access] - 1, 0),
              [updated.access]: summary[updated.access] + 1,
            }
          : summary
      );
    }

    widgets.setItems((items) =>
      items.map((widget) => (widget.id === updated.id ? updated : widget))
    );
    if (selected()?.id === updated.id) setSelected(updated);

    // Restart pagination so rows, totals and page offsets match the server again
    // when the widget may have left (or joined) the access filter, or when a
    // pending catalog response was requested before this save and would revert it.
    const requestPending = widgets.loading() || widgets.loadingMore();
    if (
      requestPending ||
      (access() !== 'any' && previous?.access !== updated.access)
    ) {
      void widgets.reload();
    }
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const items = widgets.items();
    const index = items.findIndex((widget) => widget.id === selected()?.id);
    const next =
      event.key === 'ArrowDown'
        ? Math.min(index + 1, items.length - 1)
        : Math.max(index - 1, 0);

    if (items[next]) {
      setSelected(items[next]);
      listElement
        ?.querySelector<HTMLElement>(`[data-widget-id="${items[next].id}"]`)
        ?.focus();
      if (next >= items.length - 5) void widgets.loadMore();
    }
  };

  const accessOptions = (): { value: AccessFilter; label: string }[] => [
    { value: 'any', label: t('network.widgets.filters.any') },
    { value: 'all', label: t('network.widgets.filters.all') },
    { value: 'except', label: t('network.widgets.filters.except') },
    { value: 'selected', label: t('network.widgets.filters.selected') },
    { value: 'hidden', label: t('network.widgets.filters.hidden') },
  ];

  const accessCount = (value: AccessFilter) => {
    const summary = widgets.extra();
    if (!summary) return undefined;
    return value === 'any' ? summary.total : summary[value];
  };

  const isFocusable = (widget: NetworkWidgetAccess) =>
    widgets.items().some((item) => item.id === selected()?.id)
      ? selected()!.id === widget.id
      : widgets.items()[0]?.id === widget.id;

  return (
    <div class={`${networkStyles['network-page']} ${styles['page']}`}>
      <header class={styles['page-header']}>
        <h1>{t('network.widgets.title')}</h1>
        <p>{t('network.widgets.description')}</p>
      </header>

      <div class={styles['toolbar']}>
        <label class={`${styles['search-field']} ${styles['search-wide']}`}>
          <BsSearch aria-hidden="true" />
          <input
            type="search"
            value={searchInput()}
            onInput={(event) => onSearchInput(event.currentTarget.value)}
            placeholder={t('network.widgets.searchWidgets')}
            aria-label={t('network.widgets.searchWidgets')}
          />
        </label>

        <div
          class={styles['segmented']}
          role="group"
          aria-label={t('network.widgets.filters.accessLabel')}
        >
          <For each={accessOptions()}>
            {(option) => (
              <button
                type="button"
                class={styles['segment']}
                aria-pressed={access() === option.value}
                onClick={() => setAccess(option.value)}
              >
                {option.label}
                <Show when={accessCount(option.value) !== undefined}>
                  <span class={styles['segment-count']}>
                    {accessCount(option.value)}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>

        <label class={styles['select-field']}>
          <select
            value={kind()}
            onChange={(event) =>
              setKind(event.currentTarget.value as KindFilter)
            }
            aria-label={t('network.widgets.filters.kindLabel')}
          >
            <option value="any">{t('network.widgets.filters.anyKind')}</option>
            <option value="system">{t('network.widgets.kind.system')}</option>
            <option value="network">{t('network.widgets.kind.network')}</option>
          </select>
        </label>
      </div>

      <div class={styles['layout']}>
        <aside class={styles['master']}>
          <div
            ref={listElement}
            class={styles['widget-list']}
            role="listbox"
            aria-label={t('network.widgets.title')}
            aria-busy={widgets.loading()}
            onScroll={onScrollNearEnd(() => void widgets.loadMore())}
            onKeyDown={onListKeyDown}
          >
            <Show
              when={!widgets.loading() || widgets.items().length > 0}
              fallback={
                <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>
                  {() => <div class={styles['skeleton-widget']} />}
                </For>
              }
            >
              <Show
                when={widgets.items().length > 0}
                fallback={
                  <div class={styles['empty']}>
                    <p>{t('network.widgets.noWidgets')}</p>
                    <Show when={hasFilters()}>
                      <Button
                        label={t('network.widgets.clearFilters')}
                        color="secondary"
                        onClick={clearFilters}
                      />
                    </Show>
                  </div>
                }
              >
                <Index each={widgets.items()}>
                  {(widget) => {
                    const isSelected = () => selected()?.id === widget().id;
                    return (
                      <div
                        role="option"
                        data-widget-id={widget().id}
                        aria-selected={isSelected()}
                        tabIndex={isFocusable(widget()) ? 0 : -1}
                        class={styles['widget-row']}
                        classList={{
                          [styles['widget-row-selected']]: isSelected(),
                        }}
                        onClick={() => setSelected(widget())}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelected(widget());
                          }
                        }}
                      >
                        <WidgetIcon icon={widget().icon} />
                        <span class={styles['widget-row-text']}>
                          <span class={styles['widget-row-name']}>
                            <span class={styles['ellipsis']}>
                              {widgetName(widget(), locale())}
                            </span>
                            <Show when={widget().core}>
                              <BsShieldLock
                                class={styles['widget-row-core']}
                                aria-label={t('network.widgets.core')}
                              />
                            </Show>
                          </span>
                          <AccessStatus widget={widget()} t={t} />
                        </span>
                        <span class={styles['tag']}>
                          {t(`network.widgets.kind.${widget().kind}`)}
                        </span>
                      </div>
                    );
                  }}
                </Index>

                <Show when={widgets.hasMore()}>
                  <div class={styles['load-more']}>
                    <Button
                      label={t('network.widgets.loadMore')}
                      color="secondary"
                      loading={widgets.loadingMore()}
                      onClick={() => void widgets.loadMore()}
                    />
                  </div>
                </Show>
              </Show>
            </Show>
          </div>
          <Show when={widgets.items().length > 0}>
            <p class={styles['list-footer']}>
              {t('network.widgets.showing', {
                shown: widgets.items().length,
                total: widgets.total(),
              })}
            </p>
          </Show>
        </aside>

        <section class={styles['detail-pane']}>
          <Show
            when={selected()?.id}
            keyed
            fallback={
              <div class={styles['empty']}>
                <p>{t('network.widgets.selectWidget')}</p>
              </div>
            }
          >
            {(_id) => (
              <WidgetDetail
                widget={selected()!}
                onWidgetChange={onWidgetChange}
              />
            )}
          </Show>
        </section>
      </div>
    </div>
  );
};

export default NetworkWidgets;
