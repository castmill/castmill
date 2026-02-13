import {
  Component,
  For,
  batch,
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
  TagFilter,
  useTagFilter,
  useToast,
  ViewModeToggle,
  ResourceTreeView,
  TreeResourceItem,
  ToolBar,
  TagsService,
  Tag,
  TagGroup,
  TagBadge,
  TagPopover,
} from '@castmill/ui-common';

import { store } from '../../store/store';
import { OnboardingStep } from '../../interfaces/onboarding-progress.interface';

import { BsCheckLg, BsEye, BsTagFill } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import styles from './channels-page.module.scss';
import './channels-page.scss';
import { useSearchParams } from '@solidjs/router';
import { ChannelsService, JsonChannel } from '../../services/channels.service';
import { ChannelView } from './channel-view';

import { baseUrl } from '../../env';
import { ChannelAddForm } from './channel-add-form';
import { useTeamFilter, useModalFromUrl, useViewMode } from '../../hooks';
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

  // Tag filtering for organization
  const {
    tags,
    selectedTagIds,
    setSelectedTagIds,
    filterMode: tagFilterMode,
    setFilterMode: setTagFilterMode,
  } = useTagFilter({
    baseUrl,
    organizationId: store.organizations.selectedId!,
    params: [searchParams, setSearchParams],
  });

  // View mode: list (table) or tree – persisted in localStorage
  const [viewMode, setViewMode] = useViewMode('channels');
  const [treeVersion, setTreeVersion] = createSignal(0);
  const bumpTree = () => setTreeVersion((v) => v + 1);

  const [showAddChannelModal, setShowAddChannelModal] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);
  const [currentChannel, setCurrentChannel] = createSignal<JsonChannel>();
  const [selectedChannels, setSelectedChannels] = createSignal(
    new Set<number>()
  );

  // ---------------------------------------------------------------------------
  // Tag support
  // ---------------------------------------------------------------------------
  const [tagGroups, setTagGroups] = createSignal<TagGroup[]>([]);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [resourceTagsMap, setResourceTagsMap] = createSignal<
    Map<number, Tag[]>
  >(new Map());
  const [tagPopoverTarget, setTagPopoverTarget] = createSignal<{
    item: JsonChannel;
    anchorEl: HTMLElement;
  } | null>(null);
  const [bulkTagAnchorEl, setBulkTagAnchorEl] =
    createSignal<HTMLElement | null>(null);

  const canManageTags = () => {
    return (
      canPerformAction('tags', 'manage') || canPerformAction('tags', 'create')
    );
  };

  const tagsService = new TagsService(baseUrl);

  const loadTagGroups = async () => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;
    try {
      const [groups, allTagsList] = await Promise.all([
        tagsService.listTagGroups(orgId, { preloadTags: true }),
        tagsService.listTags(orgId),
      ]);
      batch(() => {
        setTagGroups(groups);
        setAllTags(allTagsList);
      });
    } catch (error) {
      console.error('Failed to load tag groups:', error);
    }
  };

  createEffect(
    on(
      () => store.organizations.selectedId,
      () => loadTagGroups()
    )
  );

  const loadResourceTags = async (items: JsonChannel[]) => {
    const orgId = store.organizations.selectedId;
    if (!items.length || !orgId) {
      setResourceTagsMap(new Map());
      return;
    }
    const tagMap = new Map<number, Tag[]>();
    await Promise.all(
      items.map(async (item) => {
        try {
          const itemTags = await tagsService.getResourceTags(
            orgId,
            'channel',
            item.id
          );
          tagMap.set(item.id, itemTags);
        } catch {
          tagMap.set(item.id, []);
        }
      })
    );
    setResourceTagsMap(tagMap);
  };

  createEffect(on(data, (items) => loadResourceTags(items)));

  const handleTagToggle = async (
    item: JsonChannel,
    tagId: number,
    selected: boolean
  ) => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    setResourceTagsMap((prev) => {
      const next = new Map(prev);
      const current = next.get(item.id) || [];
      if (selected) {
        const tag = allTags().find((t) => t.id === tagId);
        if (tag) next.set(item.id, [...current, tag]);
      } else {
        next.set(
          item.id,
          current.filter((t) => t.id !== tagId)
        );
      }
      return next;
    });

    try {
      if (selected) {
        await tagsService.tagResource(orgId, 'channel', item.id, tagId);
      } else {
        await tagsService.untagResource(orgId, 'channel', item.id, tagId);
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
      try {
        const freshTags = await tagsService.getResourceTags(
          orgId,
          'channel',
          item.id
        );
        setResourceTagsMap((prev) => {
          const next = new Map(prev);
          next.set(item.id, freshTags);
          return next;
        });
      } catch {
        /* ignore */
      }
    }
  };

  const handleBulkTagToggle = async (tagId: number, selected: boolean) => {
    const orgId = store.organizations.selectedId;
    if (!orgId) return;

    const resourceIds = Array.from(selectedChannels());
    try {
      if (selected) {
        await tagsService.bulkTagResources(
          orgId,
          tagId,
          'channel',
          resourceIds
        );
      } else {
        await tagsService.bulkUntagResources(
          orgId,
          tagId,
          'channel',
          resourceIds
        );
      }

      const tagMap = new Map(resourceTagsMap());
      await Promise.all(
        resourceIds.map(async (id) => {
          try {
            const freshTags = await tagsService.getResourceTags(
              orgId,
              'channel',
              id
            );
            tagMap.set(id, freshTags);
          } catch {
            /* ignore */
          }
        })
      );
      setResourceTagsMap(tagMap);
    } catch (error) {
      console.error('Failed to bulk toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
    }
  };

  const bulkSelectedTagIds = () => {
    const ids = Array.from(selectedChannels());
    if (ids.length === 0) return [];
    const allItemTags = ids.map((id) => resourceTagsMap().get(id) || []);
    if (allItemTags.length === 0) return [];
    const firstItemTagIds = new Set(allItemTags[0].map((t) => t.id));
    return [...firstItemTagIds].filter((tagId) =>
      allItemTags.every((tags) => tags.some((t) => t.id === tagId))
    );
  };

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const orgId = store.organizations.selectedId!;
    const newTag = await tagsService.createTag(orgId, { name });
    setAllTags((prev) => [...prev, newTag]);
    return newTag;
  };

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

  // Sync modal state with URL itemId parameter
  useModalFromUrl({
    getItemIdFromUrl: () => searchParams.itemId,
    isModalOpen: () => showModal(),
    closeModal: () => setShowModal(false),
    openModal: (itemId: string) => {
      const channel = data().find((c) => String(c.id) === String(itemId));
      if (channel) {
        setCurrentChannel(channel);
        setShowModal(true);
      }
    },
  });

  const isQuotaReached = () => {
    const q = quota();
    return q ? q.used >= q.total : false;
  };

  const columns = () =>
    [
      { key: 'id', title: t('common.id'), sortable: true },
      { key: 'name', title: t('common.name'), sortable: true },
      {
        key: 'tags',
        title: t('tags.title'),
        sortable: false,
        render: (item: JsonChannel) => {
          const itemTags = () => resourceTagsMap().get(item.id) || [];
          return (
            <div class="tags-cell">
              <For each={itemTags().slice(0, 3)}>
                {(tag) => <TagBadge tag={tag} size="small" />}
              </For>
              <Show when={itemTags().length > 3}>
                <span class="tags-overflow">+{itemTags().length - 3}</span>
              </Show>
              <button
                class="tag-manage-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setTagPopoverTarget({
                    item,
                    anchorEl: e.currentTarget as HTMLElement,
                  });
                }}
                title={t('tags.manageTags')}
              >
                <BsTagFill />
              </button>
            </div>
          );
        },
      },
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

  const notifyChannelContentRequirement = () => {
    toast.info(t('channels.info.contentRequired'));
  };

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
    bumpTree();
  };

  const handleTagChange = (tagIds: number[]) => {
    setSelectedTagIds(tagIds);
    refreshData();
    bumpTree();
  };

  // Fetch resources for tree view nodes (filter by tag IDs in AND mode)
  const fetchTreeResources = async (tagIds: number[]) => {
    const result = await channelsService.fetchChannelsFiltered({
      page: 1,
      page_size: 100,
      sortOptions: { key: 'name', direction: 'ascending' },
      tag_ids: tagIds,
      tag_filter_mode: 'all',
      team_id: selectedTeamId(),
    });
    return {
      data: result.data as TreeResourceItem[],
      count: result.count,
    };
  };

  const updateItem = (itemId: number, item: JsonChannel) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };
  // Function to close the modal and remove blur
  const closeModal = () => {
    // Only clear URL - let createEffect handle closing the modal
    setSearchParams({ itemId: undefined });
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

                    // Complete the onboarding step for channel creation
                    store.onboarding.completeStep?.(
                      OnboardingStep.CreateChannel
                    );
                  }
                  refreshData();
                  toast.success(t('channels.success.added', { name }));
                  notifyChannelContentRequirement();
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
              channel={currentChannel()!}
              onSubmit={async (channel: Partial<JsonChannel>) => {
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
                      t('channels.success.created', {
                        name: channel.name,
                      })
                    );
                    notifyChannelContentRequirement();
                    return newChannel;
                  } else if (channel.id) {
                    const updatedTeam =
                      await channelsService.updateChannel(channel);
                    updateItem(channel.id, channel as JsonChannel);
                    toast.success(
                      t('channels.success.updated', {
                        name: channel.name,
                      })
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

        <Show when={viewMode() === 'list'}>
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
                      isQuotaReached() ||
                      !canPerformAction('channels', 'create')
                    }
                    title={
                      isQuotaReached()
                        ? 'Quota limit reached for Channels. Cannot add more.'
                        : 'Add a new Channel'
                    }
                  />
                </div>
              ),
              titleActions: (
                <ViewModeToggle mode={viewMode()} onChange={setViewMode} />
              ),
              actions: (
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                  <TeamFilter
                    teams={teams()}
                    selectedTeamId={selectedTeamId()}
                    onTeamChange={handleTeamChange}
                    label={t('filters.teamLabel')}
                    placeholder={t('filters.teamPlaceholder')}
                    clearLabel={t('filters.teamClear')}
                  />
                  <TagFilter
                    tags={tags()}
                    selectedTagIds={selectedTagIds()}
                    onTagChange={handleTagChange}
                    filterMode={tagFilterMode()}
                    onFilterModeChange={setTagFilterMode}
                    label={t('filters.tagLabel')}
                    placeholder={t('filters.tagPlaceholder')}
                    clearLabel={t('filters.tagClear')}
                    searchPlaceholder={t('filters.tagSearchPlaceholder')}
                    filterModeLabels={{
                      any: t('filters.tagFilterModeAny'),
                      all: t('filters.tagFilterModeAll'),
                    }}
                    noMatchMessage={t('filters.noMatches')}
                    emptyMessage={t('filters.noItems')}
                  />
                </div>
              ),
            }}
            selectionHint={t('common.selectionHint')}
            selectionLabel={t('common.selectionCount')}
            selectionActions={({ count, clear }) => (
              <>
                <Show when={canManageTags()}>
                  <button
                    class="selection-action-btn"
                    onClick={(e) => {
                      setBulkTagAnchorEl(e.currentTarget as HTMLElement);
                    }}
                  >
                    <BsTagFill />
                    {t('tags.manageTags')}
                  </button>
                </Show>
                <button
                  class="selection-action-btn danger"
                  disabled={!canPerformAction('channels', 'delete')}
                  onClick={() => setShowConfirmDialogMultiple(true)}
                >
                  <AiOutlineDelete />
                  {t('common.delete')}
                </button>
              </>
            )}
            table={{
              columns,
              actions,
              onRowSelect,
              defaultRowAction: {
                icon: BsEye,
                handler: (item: ChannelTableItem) => {
                  setSearchParams({ itemId: String(item.id) });
                },
                label: t('common.view'),
              },
            }}
            pagination={{ itemsPerPage }}
          ></TableView>
        </Show>

        <Show when={viewMode() === 'tree'}>
          <ToolBar
            title={t('channels.title')}
            titleActions={
              <ViewModeToggle mode={viewMode()} onChange={setViewMode} />
            }
            hideSearch
            mainAction={
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
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
                />
              </div>
            }
            actions={
              <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                <TeamFilter
                  teams={teams()}
                  selectedTeamId={selectedTeamId()}
                  onTeamChange={handleTeamChange}
                  label={t('filters.teamLabel')}
                  placeholder={t('filters.teamPlaceholder')}
                  clearLabel={t('filters.teamClear')}
                />
              </div>
            }
          />
          <ResourceTreeView
            tagGroups={tagGroups()}
            allTags={allTags()}
            fetchResources={fetchTreeResources}
            refreshKey={treeVersion()}
            storageKey="channels"
            onResourceClick={(item) => {
              setCurrentChannel(item as unknown as JsonChannel);
              setShowModal(true);
            }}
            renderResource={(item) => (
              <div
                class="channel-tree-item"
                onClick={() => {
                  setCurrentChannel(item as unknown as JsonChannel);
                  setShowModal(true);
                }}
              >
                <div class="channel-tree-info">
                  <span class="channel-tree-name">{item.name}</span>
                  <Show when={(item as any).timezone}>
                    <span class="channel-tree-meta">
                      {(item as any).timezone}
                    </span>
                  </Show>
                </div>
                <button
                  class="channel-tree-tag-btn"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const channel = item as unknown as JsonChannel;
                    const orgId = store.organizations.selectedId;
                    if (orgId && !resourceTagsMap().has(channel.id)) {
                      try {
                        const itemTags = await tagsService.getResourceTags(
                          orgId,
                          'channel',
                          channel.id
                        );
                        setResourceTagsMap((prev) => {
                          const next = new Map(prev);
                          next.set(channel.id, itemTags);
                          return next;
                        });
                      } catch {
                        /* ignore */
                      }
                    }
                    setTagPopoverTarget({
                      item: channel,
                      anchorEl: e.currentTarget as HTMLElement,
                    });
                  }}
                  title={t('tags.manageTags')}
                >
                  <BsTagFill />
                </button>
              </div>
            )}
          />
        </Show>

        {/* Single-item tag popover */}
        <Show when={tagPopoverTarget()}>
          {(target) => (
            <TagPopover
              availableTags={allTags()}
              tagGroups={tagGroups()}
              selectedTagIds={(
                resourceTagsMap().get(target().item.id) || []
              ).map((t) => t.id)}
              onToggle={(tagId, selected) =>
                handleTagToggle(target().item, tagId, selected)
              }
              onCreateTag={canManageTags() ? handleCreateTag : undefined}
              allowCreate={canManageTags()}
              anchorEl={target().anchorEl}
              onClose={() => setTagPopoverTarget(null)}
              placeholder={t('tags.searchTags')}
              ungroupedLabel={t('tags.groups.ungrouped')}
              emptyLabel={t('tags.noTagsAvailable')}
              noMatchLabel={t('tags.noMatchingTags')}
            />
          )}
        </Show>

        {/* Bulk tag popover */}
        <Show when={bulkTagAnchorEl()}>
          <TagPopover
            availableTags={allTags()}
            tagGroups={tagGroups()}
            selectedTagIds={bulkSelectedTagIds()}
            onToggle={handleBulkTagToggle}
            onCreateTag={canManageTags() ? handleCreateTag : undefined}
            allowCreate={canManageTags()}
            anchorEl={bulkTagAnchorEl()!}
            onClose={() => setBulkTagAnchorEl(null)}
            title={t('tags.manageTags')}
            placeholder={t('tags.searchTags')}
            ungroupedLabel={t('tags.groups.ungrouped')}
            emptyLabel={t('tags.noTagsAvailable')}
            noMatchLabel={t('tags.noMatchingTags')}
          />
        </Show>
      </div>
    </Show>
  );
};

export default ChannelsPage;
