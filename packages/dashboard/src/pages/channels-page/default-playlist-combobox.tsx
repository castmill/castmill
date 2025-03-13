import { JsonPlaylist } from '@castmill/player';
import { ComboBox } from '@castmill/ui-common';
import { Component, createEffect, createSignal } from 'solid-js';

import { baseUrl } from '../../env';
import { store } from '../../store';

import styles from './default-playlist-combobox.module.scss';

import { ChannelsService, JsonChannel } from '../../services/channels.service';

export const DefaultPlaylistComboBox: Component<{
  channel: JsonChannel;
}> = (props) => {
  const [defaultPlaylist, setDefaultPlaylist] = createSignal<JsonPlaylist>();

  const channelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );

  createEffect(async () => {
    if (props.channel.default_playlist_id) {
      const result = await channelsService.fetchPlaylist(
        props.channel.default_playlist_id
      );
      setDefaultPlaylist(result.data);
    }
  });

  return (
    <ComboBox<JsonPlaylist>
      id={123}
      label={'Default playlist'}
      placeholder={'Select Playlist'}
      value={defaultPlaylist()}
      renderItem={(item: JsonPlaylist) => {
        return (
          <div class={styles['playlist-combobox']}>
            {/* TODO: Add Thumbnail support */}
            <div>{item.name}</div>
          </div>
        );
      }}
      fetchItems={async (page: number, pageSize: number, search: string) => {
        return channelsService.fetchPlaylists({
          page: {
            num: page,
            size: pageSize,
          },
          sortOptions: {
            key: 'name',
            direction: 'ascending',
          },
          search,
        });
      }}
      onSelect={async (playlist: JsonPlaylist) => {
        try {
          // Update the channel
          await channelsService.updateChannel({
            id: props.channel.id,
            default_playlist_id: playlist.id,
          });
          setDefaultPlaylist(playlist);
        } catch (e) {
          alert(`Failed to update channel default playlist ${e}`);
        }
      }}
    />
  );
};
