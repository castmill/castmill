import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import {
  Button,
  IconButton,
  Column,
  TableView,
  TableViewRef,
  TableAction,
  Modal,
  ConfirmDialog,
  FetchDataOptions,
} from '@castmill/ui-common';

import { store } from '../../store/store';

import { BsCheckLg, BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import styles from './channels-page.module.scss';
import { useSearchParams } from '@solidjs/router';
import { ChannelsService, JsonChannel } from '../../services/channels.service';
import { ChannelView } from './channel-view';

import { baseUrl } from '../../env';
import { ChannelAddForm } from './channel-add-form';

const ChannelsPage: Component = () => {
  const params = useSearchParams();

  const itemsPerPage = 10; // Number of items to show per page

  const [data, setData] = createSignal<JsonChannel[]>([], {
    equals: false,
  });

  const [showAddChannelModal, setShowAddChannelModal] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);
  const [currentChannel, setCurrentChannel] = createSignal<JsonChannel>();
  const [selectedChannels, setSelectedChannels] = createSignal(
    new Set<number>()
  );

  let channelsService: ChannelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );

  createEffect(() => {
    channelsService = new ChannelsService(
      baseUrl,
      store.organizations.selectedId!
    );
  });

  const columns = [
    { key: 'id', title: 'ID', sortable: true },
    { key: 'name', title: 'Name', sortable: true },
  ] as Column<JsonChannel>[];

  interface ChannelTableItem extends JsonChannel {}

  const actions: TableAction<JsonChannel>[] = [
    {
      icon: BsEye,
      handler: (item: ChannelTableItem) => {
        setCurrentChannel(item);
        setShowModal(true);
      },
      label: 'View',
    },
    {
      icon: AiOutlineDelete,
      handler: (item: ChannelTableItem) => {
        setCurrentChannel(item);
        setShowConfirmDialog(true);
      },
      label: 'Remove',
    },
  ];

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await channelsService.fetchChannels({
      page,
      sortOptions,
      search,
      filters,
    });

    setData(result.data);
    return result;
  };

  onCleanup(() => {});

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);
  const [showErrorDialog, setShowErrorDialog] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal('');
  const [errorDevices, setErrorDevices] = createSignal<string[]>([]);

  const confirmRemoveChannel = async (channel: JsonChannel | undefined) => {
    if (!channel) {
      return;
    }
    const result = await channelsService.removeChannel(channel.id);
    
    if (result.success) {
      refreshData();
    } else {
      // Show error with device details
      const devices = result.error?.devices || [];
      setErrorMessage(
        `Cannot delete channel "${channel.name}" because it is assigned to the following device${devices.length > 1 ? 's' : ''}:`
      );
      setErrorDevices(devices);
      setShowErrorDialog(true);
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleChannels = async () => {
    const results = await Promise.allSettled(
      Array.from(selectedChannels()).map((channelId) =>
        channelsService.removeChannel(channelId)
      )
    );

    const failedChannels: Array<{ id: number; name: string; devices: string[] }> = [];
    
    results.forEach((result, index) => {
      const channelId = Array.from(selectedChannels())[index];
      const channel = data().find((c) => c.id === channelId);
      
      if (result.status === 'fulfilled' && !result.value.success) {
        failedChannels.push({
          id: channelId,
          name: channel?.name || `Channel ${channelId}`,
          devices: result.value.error?.devices || []
        });
      } else if (result.status === 'rejected') {
        failedChannels.push({
          id: channelId,
          name: channel?.name || `Channel ${channelId}`,
          devices: []
        });
      }
    });

    if (failedChannels.length > 0) {
      // Build a detailed error message
      const messages = failedChannels.map((fc) => {
        if (fc.devices.length > 0) {
          return `- ${fc.name} (assigned to: ${fc.devices.join(', ')})`;
        }
        return `- ${fc.name}`;
      });
      
      setErrorMessage(
        `The following channel${failedChannels.length > 1 ? 's' : ''} could not be deleted because ${failedChannels.length > 1 ? 'they are' : 'it is'} assigned to devices:`
      );
      setErrorDevices(messages);
      setShowErrorDialog(true);
    }

    refreshData();
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedChannels(rowsSelected);
  };

  let tableViewRef: TableViewRef<number, JsonChannel>;

  const setRef = (ref: TableViewRef<number, JsonChannel>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const updateItem = (itemId: number, item: JsonChannel) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };
  // Function to close the modal and remove blur
  const closeModal = () => {
    setShowModal(false);
  };

  const addChannel = () => {
    setCurrentChannel();
    setShowAddChannelModal(true);
  };

  const closeAddChannelModal = () => {
    setShowAddChannelModal(false);
  };

  const [title, setTitle] = createSignal('');

  createEffect(() => {
    if (currentChannel()?.id) {
      setTitle(`Channel "${currentChannel()?.name}"`);
    } else {
      setTitle('New Channel');
    }
  });

  return (
    <Show when={store.organizations.selectedId}>
      <div class={`${styles.channelsPage}`}>
        <Show when={showAddChannelModal()}>
          <Modal
            title={title()}
            description="Details of your channel"
            onClose={closeAddChannelModal}
          >
            <ChannelAddForm
              onClose={() => closeAddChannelModal()}
              onSubmit={async (name: string, timezone: string) => {
                try {
                  const result = await channelsService.addChannel(
                    name,
                    timezone
                  );

                  setShowAddChannelModal(false);
                  if (result?.data) {
                    setCurrentChannel(result.data);
                    setShowModal(true);
                    refreshData();
                  }
                  refreshData();
                } catch (error) {
                  alert(`Error adding channel: ${error}`);
                }
              }}
            />
          </Modal>
        </Show>

        <Show when={showModal()}>
          <Modal
            title={title()}
            description="Details of your channel"
            onClose={closeModal}
          >
            <ChannelView
              organizationId={store.organizations.selectedId!}
              channel={currentChannel() || { name: '' }}
              onSubmit={async (channel: JsonChannel) => {
                try {
                  const browserTimezone =
                    Intl.DateTimeFormat().resolvedOptions().timeZone;
                  if (!channel.id) {
                    const result = await channelsService.addChannel(
                      channel.name!,
                      browserTimezone
                    );
                    const newChannel = result.data;
                    setCurrentChannel(newChannel);
                    refreshData();
                    return newChannel;
                  } else {
                    const updatedTeam =
                      await channelsService.updateChannel(channel);
                    updateItem(channel.id, channel);
                    return updatedTeam;
                  }
                } catch (error) {
                  alert(`Error saving channel: ${error}`);
                }
              }}
            />
          </Modal>
        </Show>

        <ConfirmDialog
          show={showConfirmDialog()}
          title="Remove Channel"
          message={`Are you sure you want to remove device "${currentChannel()?.name}"?`}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={() => confirmRemoveChannel(currentChannel())}
        />

        <ConfirmDialog
          show={showConfirmDialogMultiple()}
          title="Remove Channels"
          message={'Are you sure you want to remove the following channels?'}
          onClose={() => setShowConfirmDialogMultiple(false)}
          onConfirm={() => confirmRemoveMultipleChannels()}
        >
          <div style="margin: 1.5em; line-height: 1.5em;">
            {Array.from(selectedChannels()).map((deviceId) => {
              const device = data().find((d) => d.id === deviceId);
              return <div>{`- ${device?.name}`}</div>;
            })}
          </div>
        </ConfirmDialog>

        <Show when={showErrorDialog()}>
          <Modal
            title="Cannot Delete Channel"
            description={errorMessage()}
            onClose={() => setShowErrorDialog(false)}
          >
            <div style="margin: 1.5em; line-height: 1.5em;">
              {errorDevices().map((device) => (
                <div>{device}</div>
              ))}
            </div>
            <div style="margin-top: 1.5em; display: flex; justify-content: flex-end;">
              <Button 
                label="OK" 
                color="primary" 
                onClick={() => setShowErrorDialog(false)} 
              />
            </div>
          </Modal>
        </Show>

        <TableView
          title="Channels"
          resource="channels"
          params={params}
          fetchData={fetchData}
          ref={setRef}
          toolbar={{
            filters: [],
            mainAction: (
              <Button
                label="Add Channel"
                onClick={addChannel}
                icon={BsCheckLg}
                color="primary"
              />
            ),
            actions: (
              <div>
                <IconButton
                  onClick={() => setShowConfirmDialogMultiple(true)}
                  icon={AiOutlineDelete}
                  color="primary"
                  disabled={selectedChannels().size === 0}
                />
              </div>
            ),
          }}
          table={{
            columns,
            actions,
            onRowSelect,
            defaultRowAction: {
              icon: BsEye,
              handler: (item: ChannelTableItem) => {
                setCurrentChannel(item);
                setShowModal(true);
              },
              label: 'View',
            },
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      </div>
    </Show>
  );
};

export default ChannelsPage;
