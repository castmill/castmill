import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  on,
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
  TeamFilter,
  useToast,
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
import { useTeamFilter } from '../../hooks';
import { useI18n } from '../../i18n';
import { QuotaIndicator } from '../../components/quota-indicator';
import { QuotasService, ResourceQuota } from '../../services/quotas.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useLocation } from '@solidjs/router';

const ChannelsPage: Component = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const { registerShortcutAction, unregisterShortcutAction } =
    useKeyboardShortcuts();
  const location = useLocation();

  const toast = useToast();

  const itemsPerPage = 10; // Number of items to show per page

  const [data, setData] = createSignal<JsonChannel[]>([], {
    equals: false,
  });

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl,
    organizationId: store.organizations.selectedId!,
    params: [searchParams, setSearchParams], // Pass URL params for shareable filtered views
  });

  const [showAddChannelModal, setShowAddChannelModal] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);
  const [currentChannel, setCurrentChannel] = createSignal<JsonChannel>();
  const [selectedChannels, setSelectedChannels] = createSignal(
    new Set<number>()
  );

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(true);

  let channelsService: ChannelsService = new ChannelsService(
    baseUrl,
    store.organizations.selectedId!
  );

  const loadQuota = async () => {
    if (!store.organizations.selectedId) return;

    try {
      setQuotaLoading(true);
      const quotaData = await QuotasService.getResourceQuota(
        store.organizations.selectedId,
        'channels'
      );
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setQuotaLoading(false);
    }
  };

  onMount(() => {
    loadQuota();

    // Register keyboard shortcuts
    registerShortcutAction(
      'generic-create',
      () => {
        if (!isQuotaReached() && canPerformAction('channels', 'create')) {
          addChannel();
        }
      },
      () => location.pathname.includes('/channels')
    );

    registerShortcutAction(
      'generic-search',
      () => {
        if (tableViewRef) {
          tableViewRef.focusSearch();
        }
      },
      () => location.pathname.includes('/channels')
    );

    registerShortcutAction(
      'generic-delete',
      () => {
        if (
          selectedChannels().size > 0 &&
          canPerformAction('channels', 'delete')
        ) {
          setShowConfirmDialogMultiple(true);
        }
      },
      () => location.pathname.includes('/channels')
    );
  });

  createEffect(
    on(
      () => store.organizations.selectedId,
      (orgId, prevOrgId) => {
        if (orgId) {
          channelsService = new ChannelsService(baseUrl, orgId);
          loadQuota();
          // Only reload if organization actually changed and tableViewRef exists
          if (prevOrgId && orgId !== prevOrgId && tableViewRef) {
            tableViewRef.reloadData();
          }
        }
      }
    )
  );

  const isQuotaReached = () => {
    const q = quota();
    return q ? q.used >= q.total : false;
  };

  const columns = [
    { key: 'id', title: t('common.id'), sortable: true },
    { key: 'name', title: t('common.name'), sortable: true },
  ] as Column<JsonChannel>[];

  interface ChannelTableItem extends JsonChannel {}

  const actions: TableAction<JsonChannel>[] = [
    {
      icon: BsEye,
      handler: (item: ChannelTableItem) => {
        setCurrentChannel(item);
        setShowModal(true);
      },
      label: t('common.view'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: ChannelTableItem) => {
        if (!canPerformAction('channels', 'delete')) {
          toast.error(
            t('permissions.noDeleteChannels') ||
              "You don't have permission to delete channels"
          );
          return;
        }
        setCurrentChannel(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
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
      team_id: selectedTeamId(),
    });

    setData(result.data);
    return result;
  };

  onCleanup(() => {
    unregisterShortcutAction('generic-create');
    unregisterShortcutAction('generic-search');
    unregisterShortcutAction('generic-delete');
  });

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
    try {
      const result = await channelsService.removeChannel(channel.id);

      if (result.success) {
        refreshData();
        toast.success(`Channel ${channel.name} removed successfully`);
      } else {
        // Show error with device details
        const devices = result.error?.devices || [];
        setErrorMessage(
          `Cannot delete channel "${channel.name}" because it is assigned to the following device${devices.length > 1 ? 's' : ''}:`
        );
        setErrorDevices(devices);
        setShowErrorDialog(true);
      }
    } catch (error) {
      // Handle unexpected errors (network failures, server down, etc.)
      toast.error(
        t('channels.errors.removeChannel', {
          name: channel.name || '',
          error: String(error),
        })
      );
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleChannels = async () => {
    const results = await Promise.allSettled(
      Array.from(selectedChannels()).map((channelId) =>
        channelsService.removeChannel(channelId)
      )
    );

    const failedChannels: Array<{
      id: number;
      name: string;
      devices: string[];
    }> = [];
    const unexpectedErrors: Array<{ id: number; name: string; error: string }> =
      [];

    results.forEach((result, index) => {
      const channelId = Array.from(selectedChannels())[index];
      const channel = data().find((c) => c.id === channelId);

      if (result.status === 'fulfilled' && !result.value.success) {
        // Business logic error (channel assigned to devices)
        failedChannels.push({
          id: channelId,
          name: channel?.name || `Channel ${channelId}`,
          devices: result.value.error?.devices || [],
        });
      } else if (result.status === 'rejected') {
        // Unexpected error (network, server down, etc.)
        unexpectedErrors.push({
          id: channelId,
          name: channel?.name || `Channel ${channelId}`,
          error: String(result.reason),
        });
      }
    });

    if (failedChannels.length > 0 || unexpectedErrors.length > 0) {
      // Build a detailed error message
      const messages: string[] = [];

      if (failedChannels.length > 0) {
        messages.push(
          ...failedChannels.map((fc) => {
            if (fc.devices.length > 0) {
              return `- ${fc.name} (assigned to: ${fc.devices.join(', ')})`;
            }
            return `- ${fc.name}`;
          })
        );
      }

      if (unexpectedErrors.length > 0) {
        messages.push(
          ...unexpectedErrors.map(
            (err) => `- ${err.name} (error: ${err.error})`
          )
        );
      }

      setErrorMessage(
        `The following channel${failedChannels.length + unexpectedErrors.length > 1 ? 's' : ''} could not be deleted:`
      );
      setErrorDevices(messages);
      setShowErrorDialog(true);
    } else {
      toast.success('Channels removed successfully');
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

  const handleTeamChange = (teamId: number | null) => {
    setSelectedTeamId(teamId);
    refreshData();
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
      setTitle(
        t('channels.channelTitle', { name: currentChannel()?.name || '' })
      );
    } else {
      setTitle(t('channels.newChannel'));
    }
  });

  return (
    <Show when={store.organizations.selectedId}>
      <div class={`${styles.channelsPage}`}>
        <Show when={showAddChannelModal()}>
          <Modal
            title={title()}
            description={t('channels.description')}
            onClose={closeAddChannelModal}
          >
            <ChannelAddForm
              onClose={() => closeAddChannelModal()}
              teamId={selectedTeamId()}
              onSubmit={async (
                name: string,
                timezone: string,
                teamId?: number | null
              ) => {
                try {
                  const result = await channelsService.addChannel(
                    name,
                    timezone,
                    teamId
                  );

                  setShowAddChannelModal(false);
                  if (result?.data) {
                    setCurrentChannel(result.data);
                    setShowModal(true);
                    refreshData();
                  }
                  refreshData();
                  toast.success(`Channel ${name} added successfully`);
                } catch (error) {
                  toast.error(
                    t('channels.errors.addChannel', { error: String(error) })
                  );
                }
              }}
            />
          </Modal>
        </Show>

        <Show when={showModal()}>
          <Modal
            title={title()}
            description={t('channels.description')}
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
                    toast.success(
                      `Channel ${channel.name} created successfully`
                    );
                    return newChannel;
                  } else {
                    const updatedTeam =
                      await channelsService.updateChannel(channel);
                    updateItem(channel.id, channel);
                    toast.success(
                      `Channel ${channel.name} updated successfully`
                    );
                    return updatedTeam;
                  }
                } catch (error) {
                  toast.error(
                    t('channels.errors.saveChannel', { error: String(error) })
                  );
                }
              }}
            />
          </Modal>
        </Show>

        <ConfirmDialog
          show={showConfirmDialog()}
          title={t('channels.removeChannel')}
          message={t('channels.confirmRemoveChannel', {
            name: currentChannel()?.name || '',
          })}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={() => confirmRemoveChannel(currentChannel())}
        />

        <ConfirmDialog
          show={showConfirmDialogMultiple()}
          title={t('channels.removeChannels')}
          message={t('channels.confirmRemoveChannels')}
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
            title={t('channels.cannotDeleteChannel')}
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
          title={t('channels.title')}
          resource="channels"
          params={[searchParams, setSearchParams]}
          fetchData={fetchData}
          ref={setRef}
          toolbar={{
            filters: [],
            mainAction: (
              <div style="display: flex; align-items: center; gap: 1rem;">
                <Show when={quota() && !quotaLoading()}>
                  <QuotaIndicator
                    used={quota()!.used}
                    total={quota()!.total}
                    resourceName="Channels"
                    compact
                  />
                </Show>
                <Button
                  label={t('channels.addChannel')}
                  onClick={addChannel}
                  icon={BsCheckLg}
                  color="primary"
                  disabled={
                    isQuotaReached() || !canPerformAction('channels', 'create')
                  }
                  title={
                    isQuotaReached()
                      ? 'Quota limit reached for Channels. Cannot add more.'
                      : 'Add a new Channel'
                  }
                />
              </div>
            ),
            actions: (
              <div style="display: flex; gap: 1rem; align-items: center;">
                <TeamFilter
                  teams={teams()}
                  selectedTeamId={selectedTeamId()}
                  onTeamChange={handleTeamChange}
                  label={t('filters.teamLabel')}
                  placeholder={t('filters.teamPlaceholder')}
                  clearLabel={t('filters.teamClear')}
                />
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
              label: t('common.view'),
            },
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      </div>
    </Show>
  );
};

export default ChannelsPage;
