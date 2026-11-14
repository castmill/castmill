import { JsonPlaylist } from '@castmill/player';
import { Component, createEffect, createSignal, For } from 'solid-js';
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

  createEffect(async () => {
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
    const firstPage = await fetchPage(1);
    const remainingPages = await Promise.all(
      Array.from(
        {
          length: Math.max(
            0,
            Math.ceil(firstPage.count / PLAYLIST_PAGE_SIZE) - 1
          ),
        },
        (_, index) => fetchPage(index + 2)
      )
    );
    const allPlaylists = [
      ...firstPage.data,
      ...remainingPages.flatMap(({ data }) => data),
    ];
    setPlaylists(allPlaylists);
    props.onPlaylistsLoaded?.(allPlaylists);
  });

  return (
    <div>
      <h2>{t('channels.dragPlaylists')}</h2>
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
