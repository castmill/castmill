import { Component, createSignal, createEffect, Show } from 'solid-js';
import { Button, ComboBox } from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import styles from './devices.module.scss';
import { DevicesService, JsonChannel } from '../services/devices.service';

// Initialize channel to undefined by default
const [channel, setChannel] = createSignal<JsonChannel | undefined>(undefined);

export const Channels: Component<{ 
  baseUrl: string; 
  organizationId: string; 
  device: Device;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  // Add a createEffect to initialize the default channel
  createEffect(async () => {
    try {
      const deviceChannels = await DevicesService.fetchChannelByDeviceId(
        props.baseUrl,
        props.device.id
      );
      if (deviceChannels.data.length > 0) {
        setChannel(deviceChannels.data[0]); // Only support one channel for now
      }
    } catch (error) {
      console.error('Failed to fetch the current channel:', error);
    }
  });

  return (
    <div class="channels">
      <h2>{t('common.channels')}</h2>
      <ComboBox<JsonChannel>
        id={123}
        label={t('devices.setDeviceChannel')}
        placeholder={t('devices.selectChannel')}
        value={channel()}
        renderItem={(item: JsonChannel) => {
          return (
            <div class={styles['channelCombobox']}>
              <div>{item.name}</div>
            </div>
          );
        }}
        fetchItems={async (page: number, pageSize: number, search: string) => {
          const channels = await DevicesService.fetchChannels(props.baseUrl, props.organizationId, {
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
          return channels;
        }}
        onSelect={async (selectedChannel: JsonChannel) => {
          try {
            await DevicesService.setChannelByDeviceId(
              props.baseUrl,
              props.organizationId,
              props.device.id,
              selectedChannel.id
            );
            setChannel(selectedChannel);
          } catch (e) {
            alert(t('devices.errors.setChannelFailed', { error: e }));
          }
        }}
      />
    </div>
  );
};
