import {
  BsCheckLg,
  BsEye,
  BsTagFill,
  BsFileEarmarkImage,
  BsFileEarmarkPlay,
  BsFileEarmarkMusic,
  BsFileEarmark,
} from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import {
  Component,
  For,
  batch,
  createEffect,
  createSignal,
  onCleanup,
  Show,
  onMount,
  on,
} from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  TableAction,
  Column,
  TableView,
  TableViewRef,
  ModalRef,
  CircularProgress,
  ResourcesObserver,
  TeamFilter,
  TagFilter,
  FetchDataOptions,
  Timestamp,
  ToastProvider,
  HttpError,
  useToast,
  useTagFilter,
  ViewModeToggle,
  ResourceTreeView,
  TreeResourceItem,
  TagsService,
  Tag,
  TagGroup,
  TagBadge,
  TagPopover,
  ToolBar,
  formatBytes,
} from '@castmill/ui-common';
import { JsonMedia } from '@castmill/player';
import { MediasService } from '../services/medias.service';
import { UploadComponent } from './upload';
import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

import './medias.scss';
import { MediaDetails } from './media-details';
import {
  AddonStore,
  AddonComponentProps,
} from '../../common/interfaces/addon-store';
import {
  useTeamFilter,
  useModalFromUrl,
  useViewMode,
} from '../../common/hooks';

const MediasPage: Component<AddonComponentProps> = (props) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
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

  const [data, setData] = createSignal<JsonMedia[]>([], {
    equals: false,
  });

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
    params: props.params, // Pass URL search params for shareable filtered views
  });

  // Tag filtering for organization by campaigns, locations, etc.
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

  const itemsPerPage = 10; // Number of items to show per page

  // View mode: list (table) or tree – persisted in localStorage
  const [viewMode, setViewMode] = useViewMode('medias');
  const [tagGroups, setTagGroups] = createSignal<TagGroup[]>([]);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [treeVersion, setTreeVersion] = createSignal(0);
  const bumpTree = () => setTreeVersion((v) => v + 1);

  // ---------------------------------------------------------------------------
  // Per-resource tag state & popover targeting
  // ---------------------------------------------------------------------------

  // Map of resourceId → Tag[] for the currently visible page
  const [resourceTagsMap, setResourceTagsMap] = createSignal<
    Map<number, Tag[]>
  >(new Map());

  // Single-item tag popover target
  const [tagPopoverTarget, setTagPopoverTarget] = createSignal<{
    item: JsonMedia;
    anchorEl: HTMLElement;
  } | null>(null);

  // Bulk tag popover anchor
  const [bulkTagAnchorEl, setBulkTagAnchorEl] =
    createSignal<HTMLElement | null>(null);

  // Permission: only admin/manager can manage tags
  const canManageTags = () => {
    const role = props.store.permissions?.role;
    return role === 'admin' || role === 'manager';
  };

  // Initialize TagsService and load tag groups for tree view
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

  // Load tag groups when org changes (needed for tree view)
  createEffect(
    on(
      () => props.store.organizations.selectedId,
      () => loadTagGroups()
    )
  );

  // ---------------------------------------------------------------------------
  // Load tags for visible media items (runs whenever the table page changes)
  // ---------------------------------------------------------------------------

  const loadResourceTags = async (items: JsonMedia[]) => {
    if (!items.length || !props.store.organizations.selectedId) {
      setResourceTagsMap(new Map());
      return;
    }

    const tagMap = new Map<number, Tag[]>();
    await Promise.all(
      items.map(async (item) => {
        try {
          const itemTags = await tagsService.getResourceTags(
            props.store.organizations.selectedId,
            'media',
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

  // ---------------------------------------------------------------------------
  // Tag toggle handlers (single item + bulk)
  // ---------------------------------------------------------------------------

  const handleTagToggle = async (
    item: JsonMedia,
    tagId: number,
    selected: boolean
  ) => {
    const orgId = props.store.organizations.selectedId;
    if (!orgId) return;

    // Optimistic local update
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
        await tagsService.tagResource(orgId, 'media', item.id, tagId);
      } else {
        await tagsService.untagResource(orgId, 'media', item.id, tagId);
      }
      bumpTree();
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
      // Revert optimistic update by reloading from server
      try {
        const freshTags = await tagsService.getResourceTags(
          orgId,
          'media',
          item.id
        );
        setResourceTagsMap((prev) => {
          const next = new Map(prev);
          next.set(item.id, freshTags);
          return next;
        });
      } catch {
        /* ignore reload failure */
      }
    }
  };

  const handleBulkTagToggle = async (tagId: number, selected: boolean) => {
    const orgId = props.store.organizations.selectedId;
    if (!orgId) return;

    const resourceIds = Array.from(selectedMedias());
    try {
      if (selected) {
        await tagsService.bulkTagResources(orgId, tagId, 'media', resourceIds);
      } else {
        await tagsService.bulkUntagResources(
          orgId,
          tagId,
          'media',
          resourceIds
        );
      }

      // Refresh tags for affected items
      const tagMap = new Map(resourceTagsMap());
      await Promise.all(
        resourceIds.map(async (id) => {
          try {
            const freshTags = await tagsService.getResourceTags(
              orgId,
              'media',
              id
            );
            tagMap.set(id, freshTags);
          } catch {
            /* ignore */
          }
        })
      );
      setResourceTagsMap(tagMap);
      bumpTree();
    } catch (error) {
      console.error('Failed to bulk toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
    }
  };

  // Compute tags that are common to ALL selected items (for bulk popover)
  const bulkSelectedTagIds = () => {
    const ids = Array.from(selectedMedias());
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
    setAllTags([...allTags(), newTag]);
    return newTag;
  };

  // Fetch resources for tree view nodes (filter by tag IDs in AND mode)
  const fetchTreeResources = async (tagIds: number[]) => {
    const result = await MediasService.fetchMedias(
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
      data: result.data.map((m: JsonMedia) => ({
        ...m,
        thumbnail: m.files?.['thumbnail']?.uri,
      })) as TreeResourceItem[],
      count: result.count,
    };
  };

  const [showModal, setShowModal] = createSignal<JsonMedia | undefined>();

  const [showAddMediasModal, setShowAddMediasModal] = createSignal(false);

  // Function to close the modal and update URL
  const closeModalAndClearUrl = () => {
    // Clear URL FIRST (before animation starts) for immediate feedback
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: undefined }, { replace: true });
    }

    // Then close modal (triggers 300ms animation)
    setShowModal(undefined);
  };

  // Sync modal state with URL for shareable deep links and browser navigation
  useModalFromUrl({
    getItemIdFromUrl: () => props.params?.[0]?.itemId,
    isModalOpen: () => !!showModal(),
    closeModal: closeModalAndClearUrl,
    openModal: (itemId) => {
      const media = data().find((m) => String(m.id) === itemId);
      if (media) {
        setShowModal(media);
      }
    },
  });

  const resourcesObserver = new ResourcesObserver<JsonMedia>(
    props.store.socket,
    'update',
    /* onJoin */
    (resource: JsonMedia) => {
      return `resource:media:${resource.id}`;
    },
    /* onUpdate */
    (resource: JsonMedia, data: Partial<JsonMedia>) => {
      updateItem(resource.id, data);
    }
  );

  /** It may be possible to refactor this code as most views will have the same UI for
   * removing resources.
   */
  const [showConfirmDialog, setShowConfirmDialog] = createSignal<
    JsonMedia | undefined
  >();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveResource = async (resource: JsonMedia | undefined) => {
    if (!resource) {
      return;
    }
    try {
      await MediasService.removeMedia(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        `${resource.id}`
      );

      refreshData();
      bumpTree();
      toast.success(`Media "${resource.name}" removed successfully`);
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        toast.error(t('organization.errors.mediaInUseAsLogo'));
      } else {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Error removing media ${resource.name}: ${message}`);
      }
    }
    setShowConfirmDialog();
  };

  const confirmRemoveMultipleResources = async () => {
    try {
      await Promise.all(
        Array.from(selectedMedias()).map((resourceId) =>
          MediasService.removeMedia(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            String(resourceId)
          )
        )
      );

      refreshData();
      bumpTree();
      toast.success(`${selectedMedias().size} media(s) removed successfully`);
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        toast.error(t('organization.errors.mediaInUseAsLogo'));
      } else {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`Error removing medias: ${message}`);
      }
    }
    setShowConfirmDialogMultiple(false);
    setSelectedMedias(new Set<number>());
  };

  const [selectedMedias, setSelectedMedias] = createSignal(new Set<number>());

  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');
  const [loadingError, setLoadingError] = createSignal('');

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [storageQuota, setStorageQuota] = createSignal<ResourceQuota | null>(
    null
  );
  const [quotaLoading, setQuotaLoading] = createSignal(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = createSignal(false);

  const quotasService = new QuotasService(props.store.env.baseUrl);

  let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

  const loadQuota = async () => {
    if (!props.store.organizations.selectedId) return;

    try {
      setQuotaLoading(true);

      // Only show loading indicator if request takes more than 1 second
      loadingTimeout = setTimeout(() => {
        if (quotaLoading()) {
          setShowLoadingIndicator(true);
        }
      }, 1000);

      // Load both media count and storage quotas
      const [quotaData, storageData] = await Promise.all([
        quotasService.getResourceQuota(
          props.store.organizations.selectedId,
          'medias'
        ),
        quotasService.getResourceQuota(
          props.store.organizations.selectedId,
          'storage'
        ),
      ]);

      setQuota(quotaData);
      setStorageQuota(storageData);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
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
          if (canPerformAction('medias', 'create') && !isQuotaReached()) {
            openAddMediasModal();
          }
        },
        () =>
          window.location.pathname.includes('/medias') &&
          canPerformAction('medias', 'create') &&
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
        () => window.location.pathname.includes('/medias')
      );

      // Register delete action
      registerShortcutAction(
        'generic-delete',
        () => {
          if (
            selectedMedias().size > 0 &&
            canPerformAction('medias', 'delete')
          ) {
            setShowConfirmDialogMultiple(true);
          }
        },
        () =>
          window.location.pathname.includes('/medias') &&
          selectedMedias().size > 0 &&
          canPerformAction('medias', 'delete')
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

  const isQuotaReached = (): boolean => {
    const q = quota();
    const sq = storageQuota();
    // Disable upload if either media count OR storage quota is reached
    return !!(q && q.used >= q.total) || !!(sq && sq.used >= sq.total);
  };

  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedMedias(rowsSelected);
  };

  let tableViewRef: TableViewRef<number, JsonMedia>;

  const setRef = (ref: TableViewRef<number, JsonMedia>) => {
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

  const updateItem = (itemId: number, item: Partial<JsonMedia>) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await MediasService.fetchMedias(
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

  const openAddMediasModal = () => {
    setShowAddMediasModal(true);
  };

  // Function to open the modal
  const openModal = (item: JsonMedia) => {
    // Open modal immediately
    setShowModal(item);

    // Also update URL for shareability (use replace to avoid polluting browser history)
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: String(item.id) }, { replace: true });
    }
  };

  // Use function to make columns reactive to i18n changes
  const columns = () =>
    [
      {
        key: 'thumbnail',
        title: '',
        sortable: false,
        // Show thumbnail or progress circle (a circular progress bar with some % in the middle, or error if not a number)
        render: (item: JsonMedia) => (
          <div class="thumbnail">
            <Show
              when={
                item.status == 'ready' && item.files && item.files['thumbnail']
              }
              fallback={
                <Show
                  when={item['status'] == 'transcoding'}
                  fallback={<div class="error">{item.status_message}</div>}
                >
                  <CircularProgress
                    progress={parseFloat(item.status_message!)}
                  />
                </Show>
              }
            >
              <img src={item.files['thumbnail'].uri} alt={item.name} />
            </Show>
          </div>
        ),
      },
      {
        key: 'name',
        title: t('common.name'),
        sortable: true,
        render: (item: JsonMedia) => (
          <span class="name-cell" title={item.name}>
            {item.name}
          </span>
        ),
      },
      {
        key: 'size',
        title: t('common.size'),
        sortable: false,
        render: (item: JsonMedia) => formatBytes(item.size ?? 0),
      },
      {
        key: 'mimetype',
        title: t('common.type'),
        sortable: true,
        render: (item: JsonMedia) => {
          const mime = item.mimetype || '';
          const Icon = mime.startsWith('image/')
            ? BsFileEarmarkImage
            : mime.startsWith('video/')
              ? BsFileEarmarkPlay
              : mime.startsWith('audio/')
                ? BsFileEarmarkMusic
                : BsFileEarmark;
          return (
            <span class="mimetype-cell" title={mime}>
              <Icon />
            </span>
          );
        },
      },
      {
        key: 'inserted_at',
        title: t('common.created'),
        sortable: true,
        render: (item: JsonMedia) => (
          <Timestamp value={item.inserted_at!} mode="relative" />
        ),
      },
      {
        key: 'updated_at',
        title: t('common.updated'),
        sortable: true,
        render: (item: JsonMedia) => (
          <Timestamp value={item.updated_at!} mode="relative" />
        ),
      },
      {
        key: 'tags',
        title: t('tags.title'),
        sortable: false,
        render: (item: JsonMedia) => {
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
                data-onboarding="tag-content"
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
    ] as Column<JsonMedia>[];

  // Use function to make actions reactive to i18n changes
  const actions = () =>
    [
      {
        icon: BsEye,
        handler: openModal,
        label: t('common.view'),
      },
      {
        icon: AiOutlineDelete,
        handler: (item: JsonMedia) => {
          if (!canPerformAction('medias', 'delete')) {
            toast.error(
              t('permissions.noDeleteMedias') ||
                "You don't have permission to delete media files"
            );
            return;
          }
          setShowConfirmDialog(item);
        },
        label: t('common.remove'),
      },
    ] as TableAction<JsonMedia>[];

  let addMediasModal: ModalRef | undefined = undefined;

  return (
    <div class="medias-page">
      <Show when={showAddMediasModal()}>
        <Modal
          ref={(ref: ModalRef) => (addMediasModal = ref)}
          title="Upload Medias"
          description="Upload any Images, Videos, or Audio files here."
          onClose={() => setShowAddMediasModal(false)}
          successMessage={loadingSuccess()}
          errorMessage={loadingError()}
          loading={loading()}
        >
          <UploadComponent
            store={props.store}
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            onFileUpload={() => {
              // File upload handled
            }}
            onUploadComplete={() => {
              // Refresh table and tree
              refreshData();
              bumpTree();
              loadQuota(); // Reload quota after upload
            }}
            onCancel={() => {
              addMediasModal!.close();
            }}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={`Media "${showModal()?.name}"`}
          description=""
          onClose={closeModalAndClearUrl}
          contentClass="medias-modal"
        >
          <MediaDetails
            store={props.store}
            media={showModal()!}
            onSubmit={async (mediaUpdate) => {
              try {
                await MediasService.updateMedia(
                  props.store.env.baseUrl,
                  props.store.organizations.selectedId,
                  `${showModal()?.id}`,
                  mediaUpdate
                );
                refreshData();
                bumpTree();
                toast.success(
                  `Media "${showModal()?.name}" updated successfully`
                );
                return true;
              } catch (error) {
                toast.error(
                  `Error updating media ${showModal()?.name}: ${error}`
                );
                return false;
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={!!showConfirmDialog()}
        title="Remove Media"
        message={`Are you sure you want to remove media "${showConfirmDialog()?.name}"?`}
        onClose={() => setShowConfirmDialog()}
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title="Remove Medias"
        message={'Are you sure you want to remove the following medias?'}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleResources()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedMedias()).map((resourceId) => {
            const resource = data().find((d) => d.id === resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <Show when={viewMode() === 'list'}>
        <TableView<number, JsonMedia>
          title="Medias"
          resource="medias"
          params={props.params}
          fetchData={fetchData}
          ref={setRef}
          itemIdKey="id"
          toolbar={{
            mainAction: (
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <Show when={quota()}>
                  <QuotaIndicator
                    used={quota()!.used}
                    total={quota()!.total}
                    resourceName="Medias"
                    compact
                    isLoading={showLoadingIndicator()}
                  />
                </Show>
                <Show when={storageQuota()}>
                  <QuotaIndicator
                    used={storageQuota()!.used}
                    total={storageQuota()!.total}
                    resourceName=""
                    compact
                    isLoading={showLoadingIndicator()}
                    formatValue={formatBytes}
                  />
                </Show>
                <Button
                  label="Upload Media"
                  onClick={openAddMediasModal}
                  icon={BsCheckLg}
                  color="primary"
                  disabled={
                    isQuotaReached() || !canPerformAction('medias', 'create')
                  }
                />
              </div>
            ),
            titleActions: (
              <span data-onboarding="tree-view-toggle">
                <ViewModeToggle mode={viewMode()} onChange={setViewMode} />
              </span>
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
                disabled={!canPerformAction('medias', 'delete')}
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
              handler: (item: JsonMedia) => {
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
          title="Medias"
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
                  resourceName="Medias"
                  compact
                  isLoading={showLoadingIndicator()}
                />
              </Show>
              <Button
                label="Upload Media"
                onClick={openAddMediasModal}
                icon={BsCheckLg}
                color="primary"
                disabled={
                  isQuotaReached() || !canPerformAction('medias', 'create')
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
          storageKey="medias"
          onResourceClick={(item) => openModal(item as unknown as JsonMedia)}
          renderResource={(item) => (
            <div
              class="media-tree-item"
              onClick={() => openModal(item as unknown as JsonMedia)}
            >
              <Show when={(item as any).files?.['thumbnail']}>
                <img
                  class="media-tree-thumbnail"
                  src={(item as any).files['thumbnail'].uri}
                  alt={item.name}
                />
              </Show>
              <div class="media-tree-info">
                <span class="media-tree-name">{item.name}</span>
                <span class="media-tree-meta">
                  {(item as any).mimetype} ·{' '}
                  {formatBytes((item as any).size ?? 0)}
                </span>
              </div>
              <button
                class="media-tree-tag-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  const media = item as unknown as JsonMedia;
                  const orgId = props.store.organizations.selectedId;
                  // Load tags for this item if not already in the map
                  if (orgId && !resourceTagsMap().has(media.id)) {
                    try {
                      const itemTags = await tagsService.getResourceTags(
                        orgId,
                        'media',
                        media.id
                      );
                      setResourceTagsMap((prev) => {
                        const next = new Map(prev);
                        next.set(media.id, itemTags);
                        return next;
                      });
                    } catch {
                      /* ignore */
                    }
                  }
                  setTagPopoverTarget({
                    item: media,
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
    <MediasPage {...props} />
  </ToastProvider>
);
