import { JsonPlaylist } from '@castmill/player';
import { ComboBox, useToast } from '@castmill/ui-common';
import { Component, createEffect, createSignal, on } from 'solid-js';

import { baseUrl } from '../../env';
import { store } from '../../store';

import styles from './default-playlist-combobox.module.scss';

import { ChannelsService, JsonChannel } from '../../services/channels.service';
import { useI18n } from '../../i18n';

export const DefaultPlaylistComboBox: Component<{
  channel: JsonChannel;
}> = (props) => {
  const { t } = useI18n();
  const toast = useToast();

  const [defaultPlaylist, setDefaultPlaylist] = createSignal<JsonPlaylist>();

  const channelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );

  let activeFetchId = 0;

  createEffect(
    on(
      () => [props.channel.id, props.channel.default_playlist_id],
      async ([, defaultPlaylistId]) => {
        const fetchId = ++activeFetchId;

        // Clear stale value immediately when channel changes or has no default playlist.
        if (!defaultPlaylistId) {
          setDefaultPlaylist(undefined);
          return;
        }

        try {
          const result = await channelsService.fetchPlaylist(defaultPlaylistId);
          // Ignore stale async results from previous channel selections.
          if (fetchId !== activeFetchId) {
            return;
          }
          setDefaultPlaylist(result.data);
        } catch {
          if (fetchId === activeFetchId) {
            setDefaultPlaylist(undefined);
          }
        }
      }
    )
  );

  return (
    <ComboBox<JsonPlaylist>
      id={123}
      label={t('channels.defaultPlaylist')}
      placeholder={t('channels.selectPlaylist')}
      value={defaultPlaylist()}
      clearable={true}
      clearLabel={t('channels.clearDefaultPlaylist')}
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
          toast.success(t('channels.success.updateDefaultPlaylist'));
        } catch (e) {
          toast.error(
            t('channels.errors.updateDefaultPlaylist', { error: String(e) })
          );
        }
      }}
      onClear={async () => {
        try {
          // Update the channel to remove default playlist
          await channelsService.updateChannel({
            id: props.channel.id,
            default_playlist_id: null,
          });
          setDefaultPlaylist(undefined);
          toast.success(t('channels.success.clearDefaultPlaylist'));
        } catch (e) {
          toast.error(
            t('channels.errors.clearDefaultPlaylist', { error: String(e) })
          );
        }
      }}
    />
  );
};
