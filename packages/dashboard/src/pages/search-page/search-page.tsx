import { Component, createSignal, createEffect, Show, For } from 'solid-js';
import { useSearchParams, useNavigate } from '@solidjs/router';
import { useI18n } from '../../i18n';
import { store } from '../../store/store';
import { SearchService, SearchResult } from '../../services/search.service';
import './search-page.scss';

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

    // Navigate to the appropriate resource page
    const routes: Record<string, string> = {
      medias: `/org/${orgId}/content/medias`,
      playlists: `/org/${orgId}/content/playlists`,
      channels: `/org/${orgId}/channels`,
      devices: `/org/${orgId}/devices`,
      teams: `/org/${orgId}/teams`,
    };

    const route = routes[resourceType];
    if (route) {
      navigate(route);
    }
  };

  return (
    <div class="search-page">
      <h1 class="search-page__title">{t('search.title')}</h1>

      <Show when={!query()}>
        <p class="search-page__empty">{t('search.enterQuery')}</p>
      </Show>

      <Show when={loading()}>
        <div class="search-page__loading">{t('common.loading')}</div>
      </Show>

      <Show when={error()}>
        <div class="search-page__error">{error()}</div>
      </Show>

      <Show when={!loading() && !error() && query() && results().length === 0}>
        <div class="search-page__no-results">
          {t('search.noResults', { query: query() })}
        </div>
      </Show>

      <Show when={!loading() && !error() && results().length > 0}>
        <div class="search-page__results">
          <For each={results()}>
            {(result) => (
              <div class="search-result-group">
                <h2 class="search-result-group__title">
                  {getResourceTypeLabel(result.resource_type)}
                  <span class="search-result-group__count">
                    ({result.count})
                  </span>
                </h2>
                <div class="search-result-group__items">
                  <For each={result.data}>
                    {(item: any) => (
                      <div
                        class="search-result-item"
                        onClick={() =>
                          navigateToResource(result.resource_type, item.id)
                        }
                      >
                        <div class="search-result-item__name">
                          {item.name || item.title || item.id}
                        </div>
                        <Show when={item.description}>
                          <div class="search-result-item__description">
                            {item.description}
                          </div>
                        </Show>
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
