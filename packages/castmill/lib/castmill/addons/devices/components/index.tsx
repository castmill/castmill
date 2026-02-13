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
  ConfirmDialog,
  Modal,
  Column,
  TableView,
  TableViewRef,
  TableAction,
  ResourcesObserver,
  TeamFilter,
  TagFilter,
  useTagFilter,
  FetchDataOptions,
  ToastProvider,
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

import { BsCheckLg, BsEye, BsTagFill } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import { Device } from '../interfaces/device.interface';
import DeviceView from './device-view';
import styles from './devices.module.scss';
import './devices.scss';

import RegisterDevice from './register-device';
import { DevicesService } from '../services/devices.service';
import { AddonComponentProps } from '../../common/interfaces/addon-store';
import {
  useTeamFilter,
  useModalFromUrl,
  useViewMode,
} from '../../common/hooks';

import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

interface DeviceTableItem extends Device {
  location: string;
  city: string;
  country: string;
}

const DevicesPage: Component<AddonComponentProps> = (props) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) => {
    const result = props.store.i18n?.t(key, params) || key;
    return result;
  };
  const toast = useToast();

  // Helper function to check permissions
  const canPerformAction = (resource: string, action: string): boolean => {
    if (!props.store.permissions?.matrix) return false;
    const allowedActions =
      props.store.permissions.matrix[
        resource as keyof typeof props.store.permissions.matrix
      ];
    return allowedActions?.includes(action as any) ?? false;
  };

  // ---------------------------------------------------------------------------
  // Tag support (device IDs are strings)
  // ---------------------------------------------------------------------------
  const [tagGroups, setTagGroups] = createSignal<TagGroup[]>([]);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [resourceTagsMap, setResourceTagsMap] = createSignal<
    Map<string, Tag[]>
  >(new Map());
  const [tagPopoverTarget, setTagPopoverTarget] = createSignal<{
    item: DeviceTableItem;
    anchorEl: HTMLElement;
  } | null>(null);
  const [bulkTagAnchorEl, setBulkTagAnchorEl] =
    createSignal<HTMLElement | null>(null);

  const canManageTags = () => {
    const role = props.store.permissions?.role;
    return role === 'admin' || role === 'manager';
  };

  const tagsService = new TagsService(props.store.env.baseUrl);

  const loadTagGroups = async () => {
    if (!props.store.organizations.selectedId) return;
    try {
      const [groups, allTagsList] = await Promise.all([
        tagsService.listTagGroups(props.store.organizations.selectedId, {
          preloadTags: true,
        }),
        tagsService.listTags(props.store.organizations.selectedId),
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
      () => props.store.organizations.selectedId,
      () => loadTagGroups()
    )
  );

  const loadResourceTags = async (items: DeviceTableItem[]) => {
    if (!items.length || !props.store.organizations.selectedId) {
      setResourceTagsMap(new Map());
      return;
    }
    const tagMap = new Map<string, Tag[]>();
    await Promise.all(
      items.map(async (item) => {
        try {
          const itemTags = await tagsService.getResourceTags(
            props.store.organizations.selectedId,
            'device',
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

  const handleTagToggle = async (
    item: DeviceTableItem,
    tagId: number,
    selected: boolean
  ) => {
    const orgId = props.store.organizations.selectedId;
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
        await tagsService.tagResource(orgId, 'device', item.id, tagId);
      } else {
        await tagsService.untagResource(orgId, 'device', item.id, tagId);
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
      try {
        const freshTags = await tagsService.getResourceTags(
          orgId,
          'device',
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
    const orgId = props.store.organizations.selectedId;
    if (!orgId) return;

    const resourceIds = Array.from(selectedDevices());
    try {
      if (selected) {
        await tagsService.bulkTagResources(orgId, tagId, 'device', resourceIds);
      } else {
        await tagsService.bulkUntagResources(
          orgId,
          tagId,
          'device',
          resourceIds
        );
      }

      const tagMap = new Map(resourceTagsMap());
      await Promise.all(
        resourceIds.map(async (id) => {
          try {
            const freshTags = await tagsService.getResourceTags(
              orgId,
              'device',
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
    const ids = Array.from(selectedDevices());
    if (ids.length === 0) return [];
    const allItemTags = ids.map((id) => resourceTagsMap().get(id) || []);
    if (allItemTags.length === 0) return [];
    const firstItemTagIds = new Set(allItemTags[0].map((t) => t.id));
    return [...firstItemTagIds].filter((tagId) =>
      allItemTags.every((tags) => tags.some((t) => t.id === tagId))
    );
  };

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const newTag = await tagsService.createTag(
      props.store.organizations.selectedId,
      { name }
    );
    setAllTags((prev) => [...prev, newTag]);
    return newTag;
  };

  const [totalItems, setTotalItems] = createSignal(0);

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
    params: props.params, // Pass URL search params for shareable filtered views
  });

  // Tag filtering for organization
  const {
    tags,
    selectedTagIds,
    setSelectedTagIds,
    filterMode: tagFilterMode,
    setFilterMode: setTagFilterMode,
  } = useTagFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
    params: props.params,
  });

  // View mode: list (table) or tree – persisted in localStorage
  const [viewMode, setViewMode] = useViewMode('devices');
  const [treeVersion, setTreeVersion] = createSignal(0);
  const bumpTree = () => setTreeVersion((v) => v + 1);

  const itemsPerPage = 10; // Number of items to show per page

  const [data, setData] = createSignal<DeviceTableItem[]>([], {
    equals: false,
  });

  // Load tags whenever the visible table page changes
  createEffect(on(data, (items) => loadResourceTags(items)));

  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');

  const [pincode, setPincode] = createSignal('');

  const [showModal, setShowModal] = createSignal(false);
  const [showRegisterModal, setShowRegisterModal] = createSignal(false);

  const [registerError, setRegisterError] = createSignal('');

  const [currentDevice, setCurrentDevice] = createSignal<DeviceTableItem>();

  const [selectedDevices, setSelectedDevices] = createSignal(new Set<string>());

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = createSignal(false);

  const quotasService = new QuotasService(props.store.env.baseUrl);

  let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

  const loadQuota = async () => {
    try {
      setQuotaLoading(true);

      // Only show loading indicator if request takes more than 1 second
      loadingTimeout = setTimeout(() => {
        if (quotaLoading()) {
          setShowLoadingIndicator(true);
        }
      }, 1000);

      const quotaData = await quotasService.getResourceQuota(
        props.store.organizations.selectedId,
        'devices'
      );
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to load quota:', error);
    } finally {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      setQuotaLoading(false);
      setShowLoadingIndicator(false);
    }
  };

  onMount(() => {
    loadQuota();

    // Register actions for generic shortcuts
    // The shortcuts themselves are already registered globally in GlobalShortcuts
    const { registerShortcutAction } = props.store.keyboardShortcuts || {};
    if (registerShortcutAction) {
      // Register create action
      registerShortcutAction(
        'generic-create',
        () => {
          if (canPerformAction('devices', 'create') && !isQuotaReached()) {
            openRegisterModal();
          }
        },
        () =>
          window.location.pathname.includes('/devices') &&
          canPerformAction('devices', 'create') &&
          !isQuotaReached()
      );

      // Register search action
      registerShortcutAction(
        'generic-search',
        () => {
          if (tableViewRef) {
            tableViewRef.focusSearch();
          }
        },
        () => window.location.pathname.includes('/devices')
      );

      // Register delete action
      registerShortcutAction(
        'generic-delete',
        () => {
          if (
            selectedDevices().size > 0 &&
            canPerformAction('devices', 'delete')
          ) {
            setShowConfirmDialogMultiple(true);
          }
        },
        () =>
          window.location.pathname.includes('/devices') &&
          selectedDevices().size > 0 &&
          canPerformAction('devices', 'delete')
      );
    }
  });

  onCleanup(() => {
    // Unregister actions when leaving this addon
    const { unregisterShortcutAction } = props.store.keyboardShortcuts || {};
    if (unregisterShortcutAction) {
      unregisterShortcutAction('generic-create');
      unregisterShortcutAction('generic-search');
      unregisterShortcutAction('generic-delete');
    }
  });

  // Reload data when organization changes (using on() to defer execution)
  createEffect(
    on(
      () => props.store.organizations.selectedId,
      (orgId, prevOrgId) => {
        // Only reload when org actually changes (not on first run when prevOrgId is undefined)
        if (prevOrgId !== undefined && orgId !== prevOrgId) {
          loadQuota();
          if (tableViewRef) {
            tableViewRef.reloadData();
          }
        }
      }
    )
  );

  // Function to close the modal and update URL
  const closeModalAndClearUrl = () => {
    // Clear URL FIRST (before animation starts) for immediate feedback
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: undefined }, { replace: true });
    }

    // Then close modal (triggers 300ms animation)
    setShowModal(false);
  };

  // Sync modal state with URL itemId parameter
  useModalFromUrl({
    getItemIdFromUrl: () => props.params?.[0]?.itemId,
    isModalOpen: () => showModal(),
    closeModal: closeModalAndClearUrl,
    openModal: (itemId) => {
      const device = data().find((d) => String(d.id) === String(itemId));
      if (device) {
        setCurrentDevice(device);
        setShowModal(true);
      }
    },
  });

  const isQuotaReached = () => {
    const currentQuota = quota();
    if (!currentQuota) return false;
    return currentQuota.used >= currentQuota.total;
  };

  const [searchParams, setSearchParams] = props.params;

  const resourcesObserver = new ResourcesObserver<DeviceTableItem>(
    props.store.socket,
    'device:status',
    /* onJoin */
    (resource: DeviceTableItem) => {
      return `device_updates:${resource.id}`;
    },
    /* onUpdate */
    (resource: DeviceTableItem, { online }: { online: boolean }) => {
      updateDeviceStatus(resource.id, online);
    }
  );

  // We want to show this modal directly, if for example the user did arrive to the registration page
  // via a link embedded in a QR-Code. The registration code is then passed as a URL parameter.
  if (searchParams.registrationCode) {
    setShowRegisterModal(true);
    setPincode(searchParams.registrationCode);
  }

  const handleDeviceRegistrationSubmit = async (registrationData: {
    name: string;
    pincode: string;
  }) => {
    try {
      setLoading(true);
      const device = await DevicesService.registerDevice(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        registrationData.name,
        registrationData.pincode
      );

      refreshData();
      loadQuota(); // Reload quota after registration
      setLoadingSuccess(t('devices.deviceRegisteredSuccess'));

      // Update total items
      setTotalItems(totalItems() + 1);

      // Complete the onboarding step for device registration
      props.store.onboarding?.completeStep?.('register_device');
    } catch (error) {
      setRegisterError(
        t('devices.errorRegisteringDevice', { error: String(error) })
      );
    } finally {
      setLoading(false);
    }
  };

  // Function to open the modal
  const openModal = (item: DeviceTableItem) => {
    // Open modal immediately
    setCurrentDevice(item);
    setShowModal(true);

    // Also update URL for shareability (use replace to avoid polluting browser history)
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: String(item.id) }, { replace: true });
    }
  };

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

  // Function to open the register modal
  const openRegisterModal = () => {
    setShowRegisterModal(true);
  };

  // Function to reset the registration form for "Register Another"
  const handleRegisterAnother = () => {
    setLoadingSuccess('');
    setRegisterError('');
    setPincode('');
  };

  // Use function to make columns reactive to i18n changes
  const columns = () =>
    [
      { key: 'name', title: t('common.name'), sortable: true },
      {
        key: 'online',
        title: t('common.online'),
        sortable: true,
        render: (item: DeviceTableItem) => (
          <svg
            width="16"
            height="16"
            fill={item.online ? 'green' : 'red'}
            viewBox="0 0 16 16"
          >
            <circle cx="8" cy="8" r="6" />
          </svg>
        ),
      },
      { key: 'timezone', title: t('common.timezone'), sortable: true },
      { key: 'version', title: t('common.version'), sortable: true },
      { key: 'last_ip', title: t('common.ip'), sortable: true },
      {
        key: 'tags',
        title: t('tags.title'),
        sortable: false,
        render: (item: DeviceTableItem) => {
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
    ] as Column<DeviceTableItem>[];

  // Use function to make actions reactive to i18n changes
  const actions = (): TableAction<DeviceTableItem>[] => [
    {
      icon: BsEye,
      handler: openModal,
      label: t('common.view'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: DeviceTableItem) => {
        if (!canPerformAction('devices', 'delete')) {
          toast.error(
            t('permissions.noDeleteDevices') ||
              "You don't have permission to delete devices"
          );
          return;
        }
        setCurrentDevice(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

  const updateDeviceStatus = (deviceId: string, newOnlineStatus: boolean) => {
    updateItem(deviceId, { online: newOnlineStatus } as DeviceTableItem);
  };

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await DevicesService.fetchDevices(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
        team_id: selectedTeamId(),
        tag_ids: selectedTagIds(),
        tag_filter_mode: tagFilterMode(),
      }
    );

    resourcesObserver.observe(result.data);

    setData(result.data);

    return result;
  };

  onCleanup(() => {
    resourcesObserver.cleanup();
  });

  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveDevice = async (device: DeviceTableItem | undefined) => {
    if (!device) {
      return;
    }
    try {
      await DevicesService.removeDevice(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        device.id
      );

      refreshData();
      toast.success(t('devices.deviceRemovedSuccess', { name: device.name }));
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(
        t('devices.errorRemovingDevice', {
          name: device.name,
          error: String(error),
        })
      );
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleDevices = async () => {
    try {
      await Promise.all(
        Array.from(selectedDevices()).map((deviceId) =>
          DevicesService.removeDevice(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            deviceId
          )
        )
      );

      refreshData();
      toast.success(
        t('devices.devicesRemovedSuccess', { count: selectedDevices().size })
      );
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(t('devices.errorRemovingDevices', { error: String(error) }));
    }
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedDevices(rowsSelected);
  };

  let tableViewRef: TableViewRef<string, DeviceTableItem>;

  const setRef = (ref: TableViewRef<string, DeviceTableItem>) => {
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
    const result = await DevicesService.fetchDevices(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: 1,
        page_size: 100,
        sortOptions: { key: 'name', direction: 'ascending' },
        tag_ids: tagIds,
        tag_filter_mode: 'all',
        team_id: selectedTeamId(),
      }
    );
    return {
      data: result.data as TreeResourceItem[],
      count: result.count,
    };
  };

  const updateItem = (itemId: string, item: Partial<DeviceTableItem>) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };

  return (
    <div class={`${styles.devicesPage}`}>
      <Show when={showRegisterModal()}>
        <Modal
          title={t('devices.registerDevice')}
          description={t('devices.registerDescription')}
          onClose={() => setShowRegisterModal(false)}
          successMessage={loadingSuccess()}
          errorMessage={registerError()}
          loading={loading()}
        >
          <RegisterDevice
            store={props.store}
            pincode={pincode()}
            success={!!loadingSuccess()}
            onSubmit={handleDeviceRegistrationSubmit}
            onCancel={() => setShowRegisterModal(false)}
            onRegisterAnother={handleRegisterAnother}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={`Device "${currentDevice()?.name}"`}
          description={t('devices.deviceDetails')}
          onClose={closeModalAndClearUrl}
        >
          <DeviceView
            baseUrl={props.store.env.baseUrl}
            organization_id={props.store.organizations.selectedId}
            device={currentDevice()!}
            store={props.store}
            onChange={(device) => {
              updateItem(device.id, device);
            }}
            t={t}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('devices.removeDevice')}
        message={t('devices.confirmRemove', {
          name: currentDevice()?.name || '',
        })}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveDevice(currentDevice())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('devices.removeDevices')}
        message={t('devices.confirmRemoveMultiple')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleDevices()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedDevices()).map((deviceId) => {
            const device = data().find((d) => d.id === deviceId);
            return <div>{`- ${device?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <Show when={viewMode() === 'list'}>
        <TableView
          title={t('devices.title')}
          resource="devices"
          params={props.params}
          fetchData={fetchData}
          ref={setRef}
          toolbar={{
            filters: [
              { name: t('common.online'), key: 'online', isActive: true },
              { name: t('common.offline'), key: 'offline', isActive: true },
            ],
            mainAction: (
              <div style="display: flex; align-items: center; gap: 1rem;">
                <Show when={quota()}>
                  <QuotaIndicator
                    used={quota()!.used}
                    total={quota()!.total}
                    resourceName={t('devices.title')}
                    compact
                    isLoading={showLoadingIndicator()}
                  />
                </Show>
                <Button
                  label={t('devices.addDevice')}
                  onClick={openRegisterModal}
                  icon={BsCheckLg}
                  color="primary"
                  disabled={
                    isQuotaReached() || !canPerformAction('devices', 'create')
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
                disabled={!canPerformAction('devices', 'delete')}
                onClick={() => setShowConfirmDialogMultiple(true)}
              >
                <AiOutlineDelete />
                Delete
              </button>
            </>
          )}
          table={{
            columns,
            actions,
            actionsLabel: t('common.actions'),
            onRowSelect,
            defaultRowAction: {
              icon: BsEye,
              handler: (item: DeviceTableItem) => {
                openModal(item);
              },
              label: t('common.view'),
            },
          }}
          pagination={{ itemsPerPage }}
        ></TableView>
      </Show>

      <Show when={viewMode() === 'tree'}>
        <ToolBar
          title={t('devices.title')}
          titleActions={
            <ViewModeToggle mode={viewMode()} onChange={setViewMode} />
          }
          hideSearch
          mainAction={
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <Show when={quota()}>
                <QuotaIndicator
                  used={quota()!.used}
                  total={quota()!.total}
                  resourceName={t('devices.title')}
                  compact
                  isLoading={showLoadingIndicator()}
                />
              </Show>
              <Button
                label={t('devices.addDevice')}
                onClick={openRegisterModal}
                icon={BsCheckLg}
                color="primary"
                disabled={
                  isQuotaReached() || !canPerformAction('devices', 'create')
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
          storageKey="devices"
          onResourceClick={(item) =>
            openModal(item as unknown as DeviceTableItem)
          }
          renderResource={(item) => (
            <div
              class="device-tree-item"
              onClick={() => openModal(item as unknown as DeviceTableItem)}
            >
              <div class="device-tree-info">
                <span class="device-tree-name">{item.name}</span>
                <Show when={(item as any).last_ip}>
                  <span class="device-tree-meta">{(item as any).last_ip}</span>
                </Show>
              </div>
              <button
                class="device-tree-tag-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  const device = item as unknown as DeviceTableItem;
                  const orgId = props.store.organizations.selectedId;
                  if (orgId && !resourceTagsMap().has(device.id)) {
                    try {
                      const itemTags = await tagsService.getResourceTags(
                        orgId,
                        'device',
                        device.id
                      );
                      setResourceTagsMap((prev) => {
                        const next = new Map(prev);
                        next.set(device.id, itemTags);
                        return next;
                      });
                    } catch {
                      /* ignore */
                    }
                  }
                  setTagPopoverTarget({
                    item: device,
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
            selectedTagIds={(resourceTagsMap().get(target().item.id) || []).map(
              (t) => t.id
            )}
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
  );
};

export default (props: any) => (
  <ToastProvider>
    <DevicesPage {...props} />
  </ToastProvider>
);
