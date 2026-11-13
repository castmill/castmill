import { JsonPlaylist } from '@castmill/player';
import { Component, createEffect, createSignal, For, Show } from 'solid-js';
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
  /**
   * `panel` (default) is the vertical side panel of the wide layout; `strip`
   * is the wrapping strip shown above the calendar on tablets.
   */
  variant?: 'panel' | 'strip';
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
    <div classList={{ [style.strip]: props.variant === 'strip' }}>
      <Show
        when={props.variant === 'strip'}
        fallback={<h2>{t('channels.dragPlaylists')}</h2>}
      >
        <p class={style.hint}>{t('channels.dragPlaylists')}</p>
      </Show>
      <div class={style.playlistsList} data-testid="playlist-chooser-list">
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
