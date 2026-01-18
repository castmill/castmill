import { JsonPlaylist } from '@castmill/player';
import { ComboBox, useToast } from '@castmill/ui-common';
import { Component, createEffect, createSignal } from 'solid-js';

import { baseUrl } from '../../env';
import { store } from '../../store';

import styles from './default-playlist-combobox.module.scss';

import { ChannelsService, JsonChannel } from '../../services/channels.service';
import { useI18n } from '../../i18n';

export const DefaultPlaylistComboBox: Component<{
  channel: JsonChannel;
  onUpdate?: (channelUpdate: Partial<JsonChannel>) => Promise<JsonChannel | void>;
}> = (props) => {
  const { t } = useI18n();
  const toast = useToast();

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
    } else {
      setDefaultPlaylist(undefined);
    }
  });

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
          // Notify parent about the update (parent will make the API call)
          // or fallback to updating directly if no parent handler
          if (props.onUpdate) {
            await props.onUpdate({
              id: props.channel.id,
              default_playlist_id: playlist.id,
            });
          } else {
            await channelsService.updateChannel({
              id: props.channel.id,
              default_playlist_id: playlist.id,
            });
          }

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
          // Notify parent about the update (parent will make the API call)
          // or fallback to updating directly if no parent handler
          if (props.onUpdate) {
            await props.onUpdate({
              id: props.channel.id,
              default_playlist_id: null,
            });
          } else {
            await channelsService.updateChannel({
              id: props.channel.id,
              default_playlist_id: null,
            });
          }

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
