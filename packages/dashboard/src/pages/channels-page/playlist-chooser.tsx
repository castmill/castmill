import { JsonPlaylist } from '@castmill/player';
import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { PlaylistChooserItem } from './playlist-chooser-item';

import style from './playlist-chooser.module.scss';
import { CalendarEntry } from './calendar-entry.interface';
import { ChannelsService } from '../../services/channels.service';
import { baseUrl } from '../../env';
import { store } from '../../store';
import { useI18n } from '../../i18n';

const PLAYLIST_PAGE_SIZE = 100;

interface PlaylistChooserProps {
  onDragOverCell?: (
    entry: CalendarEntry,
    ghostPosition?: { x: number; y: number }
  ) => void;
  /** Called with the organization's playlists once they are loaded. */
  onPlaylistsLoaded?: (playlists: JsonPlaylist[]) => void;
}

export const PlaylistChooser: Component<PlaylistChooserProps> = (props) => {
  const { t } = useI18n();

  let channelsService: ChannelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );
  const [playlists, setPlaylists] = createSignal<JsonPlaylist[]>([]);
  const [loadedPages, setLoadedPages] = createSignal(
    new Map<number, JsonPlaylist[]>()
  );
  const [pageCount, setPageCount] = createSignal<number>();
  const [failedPages, setFailedPages] = createSignal<number[]>([]);
  const [loading, setLoading] = createSignal(false);

  const fetchPage = (num: number) =>
    channelsService.fetchPlaylists({
      page: {
        num,
        size: PLAYLIST_PAGE_SIZE,
      },
      sortOptions: {
        key: 'name',
        direction: 'ascending',
      },
    });

  const publishPlaylists = (pages: Map<number, JsonPlaylist[]>) => {
    const allPlaylists = Array.from(pages.entries())
      .sort(([first], [second]) => first - second)
      .flatMap(([, data]) => data);

    setPlaylists(allPlaylists);
    props.onPlaylistsLoaded?.(allPlaylists);
  };

  const fetchPages = async (pageNumbers: number[]) => {
    if (pageNumbers.length === 0) return;

    setLoading(true);
    const results = await Promise.all(
      pageNumbers.map(async (page) => {
        try {
          return { page, result: await fetchPage(page) };
        } catch {
          return { page, error: true };
        }
      })
    );
    const pages = new Map(loadedPages());
    const failed = new Set(failedPages());
    let updated = false;

    for (const response of results) {
      if (response.result) {
        pages.set(response.page, response.result.data);
        failed.delete(response.page);
        updated = true;
        if (response.page === 1) {
          setPageCount(Math.ceil(response.result.count / PLAYLIST_PAGE_SIZE));
        }
      } else {
        failed.add(response.page);
      }
    }

    setLoadedPages(pages);
    setFailedPages(Array.from(failed).sort((first, second) => first - second));
    if (updated) publishPlaylists(pages);
    setLoading(false);
  };

  const loadMissingPages = async () => {
    const count = pageCount();
    if (count === undefined) return;

    const loaded = loadedPages();
    const failed = new Set(failedPages());
    const missing = Array.from(
      { length: count },
      (_, index) => index + 1
    ).filter((page) => !loaded.has(page) && !failed.has(page));
    await fetchPages(missing);
  };

  const retryFailedPages = async () => {
    await fetchPages(failedPages());
    await loadMissingPages();
  };

  onMount(async () => {
    await fetchPages([1]);
    await loadMissingPages();
  });

  return (
    <div>
      <h2>{t('channels.dragPlaylists')}</h2>
      <Show when={failedPages().length > 0}>
        <div role="alert">
          <span>
            {t('channels.errors.loadPlaylists', {
              pages: failedPages().join(', '),
            })}
          </span>
          <button type="button" disabled={loading()} onClick={retryFailedPages}>
            {t('channels.retryPlaylists')}
          </button>
        </div>
      </Show>
      <div class={style.playlistsList}>
        <For each={playlists()}>
          {(playlist) => (
            <PlaylistChooserItem
              playlist={playlist}
              onDragOverCell={props.onDragOverCell}
            />
          )}
        </For>
      </div>
    </div>
  );
};
