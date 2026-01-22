import { Component, createSignal } from 'solid-js';
import {
  Button,
  ComboBox,
  TableView,
  TableViewRef,
  Column,
  TableAction,
  useToast,
} from '@castmill/ui-common';
import { Device } from '../interfaces/device.interface';
import { AiOutlineDelete } from 'solid-icons/ai';
import styles from './devices.module.scss';
import { DevicesService, JsonChannel } from '../services/devices.service';
import { AddonStore } from '../../common/interfaces/addon-store';

export const Channels: Component<{
  baseUrl: string;
  organizationId: string;
  device: Device;
  store?: AddonStore;
  t?: (key: string, params?: Record<string, any>) => string;
}> = (props) => {
  const t = props.t || ((key: string) => key);
  const toast = useToast();

  // Store channels in a local state
  const [channels, setChannels] = createSignal<JsonChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = createSignal(
    new Set<number>()
  );

  const itemsPerPage = 5; // Number of items to show per page

  // Setup table reference
  let tableViewRef: TableViewRef<number, JsonChannel>;

  const setRef = (ref: TableViewRef<number, JsonChannel>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  // Define table columns with i18n
  const columns = [
    { key: 'id', title: t('common.id'), sortable: false },
    { key: 'name', title: t('common.name'), sortable: false },
    { key: 'timezone', title: t('common.timezone'), sortable: false },
  ] as Column<JsonChannel>[];

  // Define table actions with i18n
  const actions: TableAction<JsonChannel>[] = [
    {
      icon: AiOutlineDelete,
      handler: async (item: JsonChannel) => {
        await removeChannel(item.id);
      },
      label: t('common.remove'),
      props: (item: JsonChannel) => ({
        // Disable the delete button if this is the only channel
        disabled: channels().length <= 1,
        title:
          channels().length <= 1
            ? t('devices.cannotDeleteLastChannel')
            : undefined,
      }),
    },
  ];

  // Handle row selection
  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedChannels(rowsSelected);
  };

  // Fetch channels data for the TableView
  const fetchChannelsData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: {
    page: { num: number; size: number };
    sortOptions: any;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => {
    try {
      // First fetch the device's assigned channels
      const deviceChannels = await DevicesService.fetchChannelByDeviceId(
        props.baseUrl,
        props.device.id
      );

      // Update the local channels state
      setChannels(deviceChannels.data);

      // Return in the format expected by TableView
      return {
        data: deviceChannels.data,
        count: deviceChannels.data.length,
      };
    } catch (error) {
      console.error('Failed to fetch device channels:', error);
      toast.error('Failed to fetch device channels');
      return { data: [], count: 0 };
    }
  };

  // Add a channel to the device
  const addChannel = async (selectedChannel: JsonChannel) => {
    try {
      // Check if this channel is already assigned
      const isAlreadyAssigned = channels().some(
        (ch) => ch.id === selectedChannel.id
      );
      if (isAlreadyAssigned) {
        toast.error('This channel is already assigned to the device.');
        return;
      }

      // Using the existing API function to add a channel
      await DevicesService.addChannelToDevice(
        props.baseUrl,
        props.device.id,
        selectedChannel.id
      );

      // Refresh the table to show the updated list
      refreshData();
      toast.success(`Channel "${selectedChannel.name}" added successfully`);

      // Complete the onboarding step for assigning a channel to a device
      props.store?.onboarding?.completeStep?.('assign_channel');
    } catch (e) {
      toast.error(`Failed to add channel: ${e}`);
    }
  };

  // Remove a channel from the device
  const removeChannel = async (channelId: number) => {
    // Only allow removal if there will still be at least one channel remaining
    if (channels().length <= 1) {
      toast.error('At least one channel must be assigned to the device.');
      return;
    }

    try {
      await DevicesService.removeChannelFromDevice(
        props.baseUrl,
        props.device.id,
        channelId
      );

      // Refresh the table to show the updated list
      refreshData();
      toast.success('Channel removed successfully');
    } catch (e) {
      toast.error(`Failed to remove channel: ${e}`);
    }
  };

  return (
    <div class={styles.deviceDetails}>
      {/* Channel table */}
      <h3>{t('devices.assignedChannels')}</h3>
      <TableView
        title={t('devices.assignedChannels')}
        resource="channels"
        fetchData={fetchChannelsData}
        ref={setRef}
        table={{
          columns,
          actions,
          onRowSelect,
        }}
        pagination={{ itemsPerPage }}
      />

      {/* Channel selector */}
      <div class={styles.addChannel}>
        <h3>{t('devices.addChannel')}</h3>
        <ComboBox<JsonChannel>
          id="channel-selector"
          label={t('devices.selectChannelToAdd')}
          placeholder={t('devices.selectChannel')}
          renderItem={(item: JsonChannel) => (
            <div class={styles.channelCombobox}>
              <div>{item.name}</div>
            </div>
          )}
          fetchItems={async (
            page: number,
            pageSize: number,
            search: string
          ) => {
            const channels = await DevicesService.fetchChannels(
              props.baseUrl,
              props.organizationId,
              {
                page: {
                  num: page,
                  size: pageSize,
                },
                sortOptions: {
                  key: 'name',
                  direction: 'ascending',
                },
                search,
              }
            );
            return channels;
          }}
          onSelect={async (selectedChannel: JsonChannel) => {
            await addChannel(selectedChannel);
          }}
        />
      </div>
    </div>
  );
};
