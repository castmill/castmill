import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { useSearchParams, useNavigate } from '@solidjs/router';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';
import { SearchService, SearchResult } from '../../services/search.service';
import { IoImagesOutline, IoSearchOutline } from 'solid-icons/io';
import { RiMediaPlayList2Fill } from 'solid-icons/ri';
import { HiOutlineTv } from 'solid-icons/hi';
import { BsCalendarWeek } from 'solid-icons/bs';
import { AiOutlineTeam } from 'solid-icons/ai';
import { BiRegularChevronRight } from 'solid-icons/bi';
import './search-page.scss';

// Icon component for resource types
const ResourceIcon = (props: { type: string; size?: number }) => {
  const icons: Record<string, any> = {
    medias: IoImagesOutline,
    playlists: RiMediaPlayList2Fill,
    channels: BsCalendarWeek,
    devices: HiOutlineTv,
    teams: AiOutlineTeam,
  };

  const Icon = icons[props.type] || IoImagesOutline;
  return <Icon size={props.size || 24} />;
};

const SearchPage: Component = () => {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [results, setResults] = createSignal<SearchResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [query, setQuery] = createSignal<string>('');

  // Perform search when query param changes
  createEffect(async () => {
    const searchQuery = searchParams.s || '';
    setQuery(searchQuery);

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (!store.organizations.selectedId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await SearchService.search(
        store.organizations.selectedId,
        searchQuery,
        1,
        20
      );
      setResults(response.results);
    } catch (err) {
      console.error('Search error:', err);
      setError(t('search.error'));
    } finally {
      setLoading(false);
    }
  });

  const getResourceTypeLabel = (resourceType: string) => {
    const labels: Record<string, string> = {
      medias: t('sidebar.medias'),
      playlists: t('sidebar.playlists'),
      channels: t('sidebar.channels'),
      devices: t('sidebar.devices'),
      teams: t('sidebar.teams'),
    };
    return labels[resourceType] || resourceType;
  };

  const navigateToResource = (resourceType: string, resourceId: string) => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    // Navigate to the appropriate resource page with the item ID in the URL
    // This will allow the page to open the detail modal automatically
    const routes: Record<string, string> = {
      medias: `/org/${orgId}/content/medias?itemId=${resourceId}`,
      playlists: `/org/${orgId}/content/playlists?itemId=${resourceId}`,
      channels: `/org/${orgId}/channels?itemId=${resourceId}`,
      devices: `/org/${orgId}/devices?itemId=${resourceId}`,
      teams: `/org/${orgId}/teams?itemId=${resourceId}`,
    };

    const route = routes[resourceType];
    if (route) {
      navigate(route);
    }
  };

  const getItemName = (item: any) => {
    return item.name || item.title || item.id;
  };

  const getItemDescription = (item: any) => {
    if (item.description) return item.description;
    if (item.uri) return item.uri;
    if (item.mimetype) return `${item.mimetype}`;
    return null;
  };

  const getItemSecondaryInfo = (item: any) => {
    const parts: string[] = [];

    if (item.created_at) {
      parts.push(
        t('common.created') +
          ': ' +
          new Date(item.created_at).toLocaleDateString()
      );
    }
    if (item.updated_at && item.updated_at !== item.created_at) {
      parts.push(
        t('common.updated') +
          ': ' +
          new Date(item.updated_at).toLocaleDateString()
      );
    }

    return parts.length > 0 ? parts.join(' • ') : null;
  };

  return (
    <div class="search-page">
      <div class="search-page__header">
        <div class="search-page__header-icon">
          <IoSearchOutline size={32} />
        </div>
        <div class="search-page__header-content">
          <h1 class="search-page__title">{t('search.title')}</h1>
          <Show when={query()}>
            <p class="search-page__query">
              {t('search.resultsFor', { query: query() })}
              <Show when={!loading() && !error() && results().length > 0}>
                <span class="search-page__count">
                  {' • '}
                  {t('search.foundResults', {
                    count: results().reduce((sum, r) => sum + r.count, 0),
                  })}
                </span>
              </Show>
            </p>
          </Show>
        </div>
      </div>

      <Show when={!query()}>
        <div class="search-page__empty">
          <IoSearchOutline size={64} class="search-page__empty-icon" />
          <p class="search-page__empty-text">{t('search.enterQuery')}</p>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="search-page__loading">
          <div class="search-page__spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </Show>

      <Show when={error()}>
        <div class="search-page__error">
          <div class="search-page__error-icon">⚠️</div>
          <p>{error()}</p>
        </div>
      </Show>

      <Show when={!loading() && !error() && query() && results().length === 0}>
        <div class="search-page__no-results">
          <div class="search-page__no-results-icon">🔍</div>
          <h2>{t('search.noResultsTitle')}</h2>
          <p>{t('search.noResults', { query: query() })}</p>
        </div>
      </Show>

      <Show when={!loading() && !error() && results().length > 0}>
        <div class="search-page__results">
          <For each={results()}>
            {(result) => (
              <div class="search-result-group">
                <div class="search-result-group__header">
                  <div class="search-result-group__icon">
                    <ResourceIcon type={result.resource_type} size={24} />
                  </div>
                  <h2 class="search-result-group__title">
                    {getResourceTypeLabel(result.resource_type)}
                  </h2>
                  <span class="search-result-group__count">{result.count}</span>
                </div>

                <div class="search-result-group__items">
                  <For each={result.data}>
                    {(item: any) => (
                      <div
                        class="search-result-item"
                        onClick={() =>
                          navigateToResource(result.resource_type, item.id)
                        }
                        role="button"
                        tabindex={0}
                      >
                        <div class="search-result-item__icon">
                          <ResourceIcon type={result.resource_type} size={20} />
                        </div>

                        <div class="search-result-item__content">
                          <div class="search-result-item__name">
                            {getItemName(item)}
                          </div>

                          <Show when={getItemDescription(item)}>
                            <div class="search-result-item__description">
                              {getItemDescription(item)}
                            </div>
                          </Show>

                          <Show when={getItemSecondaryInfo(item)}>
                            <div class="search-result-item__meta">
                              {getItemSecondaryInfo(item)}
                            </div>
                          </Show>
                        </div>

                        <div class="search-result-item__arrow">
                          <BiRegularChevronRight size={20} />
                        </div>
                      </div>
                    )}
                  </For>
                </div>

                <Show when={result.total_pages > 1}>
                  <div class="search-result-group__pagination">
                    {t('search.showingPage', {
                      page: result.page,
                      total: result.total_pages,
                    })}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default SearchPage;
