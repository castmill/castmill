import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { ComboBox, useToast } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import {
  BsBoxArrowUpRight,
  BsCollectionPlay,
  BsGlobe2,
  BsTrash3,
} from 'solid-icons/bs';
import { DevicesService, JsonChannel } from '../services/devices.service';
import { AddonStore } from '../../common/interfaces/addon-store';
import { DeviceCardHeader, DeviceIconButton } from './device-section';
import './channels.scss';

export const Channels: Component<{
  baseUrl: string;
  organizationId: string;
  device: Device;
  store?: AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  const [channels, setChannels] = createSignal<JsonChannel[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [busyId, setBusyId] = createSignal<number | null>(null);

  const canRemove = () => channels().length > 1;

  const loadChannels = async () => {
    try {
      const deviceChannels = await DevicesService.fetchChannelByDeviceId(
        props.baseUrl,
        props.device.id
      );
      setChannels(deviceChannels.data || []);
    } catch (error) {
      console.error('Failed to fetch device channels:', error);
      toast.error(t('devices.channelList.loadError'));
    } finally {
      setLoading(false);
    }
  };

  onMount(loadChannels);

  const viewChannel = (channel: JsonChannel) =>
    props.store?.router?.navigate(
      `/org/${props.organizationId}/channels?itemId=${channel.id}`
    );

  const addChannel = async (selectedChannel: JsonChannel) => {
    if (channels().some((ch) => ch.id === selectedChannel.id)) {
      toast.error(t('devices.channelList.alreadyAssigned'));
      return;
    }

    try {
      await DevicesService.addChannelToDevice(
        props.baseUrl,
        props.device.id,
        selectedChannel.id
      );
      await loadChannels();
      toast.success(
        t('devices.channelList.added', { name: selectedChannel.name })
      );
      props.store?.onboarding?.completeStep?.('assign_channel');
    } catch (e) {
      toast.error(t('devices.channelList.addError', { error: String(e) }));
    }
  };

  const removeChannel = async (channel: JsonChannel) => {
    if (!canRemove()) {
      toast.error(t('devices.cannotDeleteLastChannel'));
      return;
    }

    setBusyId(channel.id);
    try {
      await DevicesService.removeChannelFromDevice(
        props.baseUrl,
        props.device.id,
        channel.id
      );
      await loadChannels();
      toast.success(t('devices.channelList.removed', { name: channel.name }));
    } catch (e) {
      toast.error(t('devices.channelList.removeError', { error: String(e) }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section class="device-card device-channels">
      <DeviceCardHeader
        icon={BsCollectionPlay}
        title={t('devices.assignedChannels')}
        count={loading() ? undefined : channels().length}
        description={t('devices.channelList.description')}
      />

      <Show
        when={!loading()}
        fallback={<p class="device-empty">{t('common.loading')}</p>}
      >
        <Show
          when={channels().length > 0}
          fallback={
            <p class="device-empty">{t('devices.channelList.empty')}</p>
          }
        >
          <ul class="device-channel-list">
            <For each={channels()}>
              {(channel) => (
                <li class="device-channel-item">
                  <span class="device-channel-icon" aria-hidden="true">
                    <BsCollectionPlay />
                  </span>
                  <div class="device-channel-text">
                    <span class="device-channel-name">{channel.name}</span>
                    <span class="device-channel-meta">
                      <BsGlobe2 aria-hidden="true" />
                      {channel.timezone || t('common.notAvailable')}
                    </span>
                  </div>
                  <div class="device-channel-actions">
                    <DeviceIconButton
                      icon={BsBoxArrowUpRight}
                      label={t('common.view')}
                      onClick={() => viewChannel(channel)}
                    />
                    <DeviceIconButton
                      icon={BsTrash3}
                      tone="danger"
                      label={t('common.remove')}
                      title={
                        canRemove()
                          ? t('common.remove')
                          : t('devices.cannotDeleteLastChannel')
                      }
                      disabled={!canRemove() || busyId() === channel.id}
                      onClick={() => removeChannel(channel)}
                    />
                  </div>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>

      <div class="device-card-footer device-channel-add">
        <ComboBox<JsonChannel>
          id="channel-selector"
          label={t('devices.addChannel')}
          placeholder={t('devices.selectChannelToAdd')}
          renderItem={(item: JsonChannel) => (
            <div class="device-channel-option">{item.name}</div>
          )}
          fetchItems={async (page: number, pageSize: number, search: string) =>
            DevicesService.fetchChannels(props.baseUrl, props.organizationId, {
              page: { num: page, size: pageSize },
              sortOptions: { key: 'name', direction: 'ascending' },
              search,
            })
          }
          onSelect={async (selectedChannel: JsonChannel) => {
            await addChannel(selectedChannel);
          }}
        />
      </div>
    </section>
  );
};
