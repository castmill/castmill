import { JsonPlaylist } from '@castmill/player';
import { Component, createEffect, createSignal, For } from 'solid-js';
import { PlaylistChooserItem } from './playlist-chooser-item';

import style from './playlist-chooser.module.scss';
import { CalendarEntry } from './calendar-entry.interface';
import { ChannelsService } from '../../services/channels.service';
import { baseUrl } from '../../env';
import { store } from '../../store';
import { useI18n } from '../../i18n';

interface PlaylistChooserProps {
  onDragOverCell?: (
    entry: CalendarEntry,
    ghostPosition?: { x: number; y: number }
  ) => void;
}

export const PlaylistChooser: Component<PlaylistChooserProps> = (props) => {
  const { t } = useI18n();
  
  let channelsService: ChannelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );
  const [playlists, setPlaylists] = createSignal<JsonPlaylist[]>([]);

  createEffect(async () => {
    // TODO: we should support pagination here.
    const { data } = await channelsService.fetchPlaylists({
      page: {
        num: 1,
        size: 100,
      },
      sortOptions: {
        key: 'name',
        direction: 'ascending',
      },
    });
    setPlaylists(data);
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
