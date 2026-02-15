import { BsCheckLg, BsEye, BsTagFill } from 'solid-icons/bs';
import { AiOutlineDelete, AiOutlineEdit } from 'solid-icons/ai';
import {
  Component,
  For,
  batch,
  createEffect,
  createSignal,
  Show,
  onMount,
  untrack,
  onCleanup,
  on,
} from 'solid-js';

import {
  Button,
  IconButton,
  Modal,
  TableAction,
  Column,
  TableView,
  TableViewRef,
  FetchDataOptions,
  ConfirmDialog,
  TeamFilter,
  TagFilter,
  useTagFilter,
  Timestamp,
  ToastProvider,
  useToast,
  FormItem,
  Dropdown,
  ViewModeToggle,
  ResourceTreeView,
  TreeResourceItem,
  ToolBar,
  TagsService,
  Tag,
  TagGroup,
  TagBadge,
  TagPopover,
  useViewMode,
} from '@castmill/ui-common';
import { JsonPlaylist } from '@castmill/player';
import { PlaylistsService } from '../services/playlists.service';
import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

import './playlists.scss';
import { PlaylistView } from './playlist-view';
import { AddonComponentProps } from '../../common/interfaces/addon-store';
import { PlaylistAddForm, AspectRatio } from './playlist-add-form';
import {
  useTeamFilter,
  useModalFromUrl,
  useOnboardingHighlight,
} from '../../common/hooks';
import { ASPECT_RATIO_OPTIONS } from '../constants';
import {
  validateCustomRatioField,
  validateAspectRatioExtreme as validateAspectRatioExtremeUtil,
} from '../utils/aspect-ratio-validation';

const PlaylistsPage: Component<AddonComponentProps> = (props) => {
  const toast = useToast();
  const [data, setData] = createSignal<JsonPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = createSignal<JsonPlaylist>();
  const [showModal, setShowModal] = createSignal(false);
  const [showRenameModal, setShowRenameModal] = createSignal(false);

  // Create a derived signal from props.params to make it reactive
  // Access props.params[0] directly to maintain reactivity
  const itemIdFromUrl = () => {
    if (!props.params) return undefined;
    return props.params[0]?.itemId;
  };

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

  // Helper function to open modal for a given itemId
  const openModalFromItemId = (itemId: string) => {
    const currentData = data();

    // First check if item is in current page data
    const playlist = currentData.find((p) => String(p.id) === String(itemId));
    if (playlist) {
      setCurrentPlaylist(playlist);
      setShowModal(true);
    } else if (currentData.length > 0 && props.store.organizations.selectedId) {
      // Item not in current page - fetch it by ID
      PlaylistsService.getPlaylist(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        Number(itemId)
      )
        .then((fetchedPlaylist) => {
          setCurrentPlaylist(fetchedPlaylist);
          setShowModal(true);
        })
        .catch((error) => {
          console.error('Failed to fetch playlist by ID:', error);
          // Silently fail - item might not exist, be deleted, or user has no access
        });
    }
  };

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
  const [viewMode, setViewMode] = useViewMode('playlists');
  const [treeVersion, setTreeVersion] = createSignal(0);
  const bumpTree = () => setTreeVersion((v) => v + 1);

  const [showAddPlaylistModal, setShowAddPlaylistModal] = createSignal(false);
  const [selectedPlaylists, setSelectedPlaylists] = createSignal(
    new Set<number>()
  );

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

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
  // Tag support
  // ---------------------------------------------------------------------------
  const [tagGroups, setTagGroups] = createSignal<TagGroup[]>([]);
  const [allTags, setAllTags] = createSignal<Tag[]>([]);
  const [resourceTagsMap, setResourceTagsMap] = createSignal<
    Map<number, Tag[]>
  >(new Map());
  const [tagPopoverTarget, setTagPopoverTarget] = createSignal<{
    item: JsonPlaylist;
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

  const loadResourceTags = async (items: JsonPlaylist[]) => {
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
            'playlist',
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
    item: JsonPlaylist,
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
        await tagsService.tagResource(orgId, 'playlist', item.id, tagId);
      } else {
        await tagsService.untagResource(orgId, 'playlist', item.id, tagId);
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      toast.error(t('tags.errors.tagResource', { error: String(error) }));
      try {
        const freshTags = await tagsService.getResourceTags(
          orgId,
          'playlist',
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

    const resourceIds = Array.from(selectedPlaylists());
    try {
      if (selected) {
        await tagsService.bulkTagResources(
          orgId,
          tagId,
          'playlist',
          resourceIds
        );
      } else {
        await tagsService.bulkUntagResources(
          orgId,
          tagId,
          'playlist',
          resourceIds
        );
      }

      const tagMap = new Map(resourceTagsMap());
      await Promise.all(
        resourceIds.map(async (id) => {
          try {
            const freshTags = await tagsService.getResourceTags(
              orgId,
              'playlist',
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
    const ids = Array.from(selectedPlaylists());
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

  // Sync modal state with URL for shareable deep links and browser navigation
  useModalFromUrl({
    getItemIdFromUrl: itemIdFromUrl,
    isModalOpen: () => showModal(),
    closeModal: closeModalAndClearUrl,
    openModal: openModalFromItemId,
  });

  // Handle onboarding highlight for the Add Playlist button
  useOnboardingHighlight(props.params);

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
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

      const quotaData = await quotasService.getResourceQuota(
        props.store.organizations.selectedId,
        'playlists'
      );
      setQuota(quotaData);
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
          if (canPerformAction('playlists', 'create') && !isQuotaReached()) {
            openAddPlaylistModal();
          }
        },
        () =>
          window.location.pathname.includes('/playlists') &&
          canPerformAction('playlists', 'create') &&
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
        () => window.location.pathname.includes('/playlists')
      );

      // Register delete action
      registerShortcutAction(
        'generic-delete',
        () => {
          if (
            selectedPlaylists().size > 0 &&
            canPerformAction('playlists', 'delete')
          ) {
            setShowConfirmDialogMultiple(true);
          }
        },
        () =>
          window.location.pathname.includes('/playlists') &&
          selectedPlaylists().size > 0 &&
          canPerformAction('playlists', 'delete')
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

  const isQuotaReached = () => {
    const q = quota();
    return q ? q.used >= q.total : false;
  };

  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedPlaylists(rowsSelected);
  };

  const itemsPerPage = 10; // Number of items to show per page

  let tableViewRef: TableViewRef<number, JsonPlaylist>;

  const setRef = (ref: TableViewRef<number, JsonPlaylist>) => {
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
    const result = await PlaylistsService.fetchPlaylists(
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

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await PlaylistsService.fetchPlaylists(
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

    setData(result.data);

    return result;
  };

  const openAddPlaylistModal = () => {
    setShowAddPlaylistModal(true);
  };

  // Function to open the modal
  const openModal = (item: JsonPlaylist) => {
    // Open modal immediately
    setCurrentPlaylist(item);
    setShowModal(true);

    // Also update URL for shareability (use replace to avoid polluting browser history)
    if (props.params) {
      const [searchParams, setSearchParams] = props.params;
      setSearchParams({ itemId: String(item.id) }, { replace: true });
    }
  };

  // Function to close the modal and remove blur
  const closeModal = () => {
    // Clear URL FIRST (before animation starts) for immediate feedback
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: undefined }, { replace: true });
    }

    // Then close modal (triggers 300ms animation)
    setShowModal(false);
  };

  const [customRatioModal, setCustomRatioModal] = createSignal<{
    playlist: JsonPlaylist | null;
    show: boolean;
  }>({ playlist: null, show: false });

  const [customWidth, setCustomWidth] = createSignal<string>('16');
  const [customHeight, setCustomHeight] = createSignal<string>('9');
  const [customRatioErrors, setCustomRatioErrors] = createSignal(
    new Map<string, string>()
  );

  const validateCustomRatio = (field: string, value: string) => {
    const errors = validateCustomRatioField(
      field,
      value,
      t,
      customRatioErrors()
    );
    setCustomRatioErrors(errors);
    return !errors.has(field);
  };

  const validateCustomRatioExtreme = () => {
    const result = validateAspectRatioExtremeUtil(
      customWidth(),
      customHeight(),
      t,
      customRatioErrors()
    );
    setCustomRatioErrors(result.errors);
    return result.isValid;
  };

  const handleCustomRatioSubmit = async () => {
    if (
      !validateCustomRatio('width', customWidth()) ||
      !validateCustomRatio('height', customHeight()) ||
      !validateCustomRatioExtreme()
    ) {
      return;
    }

    const width = parseInt(customWidth(), 10);
    const height = parseInt(customHeight(), 10);
    const playlist = customRatioModal().playlist;

    if (!playlist) {
      return;
    }

    try {
      await PlaylistsService.updatePlaylist(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        `${playlist.id}`,
        {
          name: playlist.name,
          description: '',
          settings: {
            aspect_ratio: { width, height },
          },
        }
      );

      toast.success(t('playlists.aspectRatioUpdated'));
      setCustomRatioModal({ playlist: null, show: false });
      setCustomRatioErrors(new Map());
      refreshData();
    } catch (error) {
      toast.error(
        t('playlists.errors.updateAspectRatio', { error: String(error) })
      );
    }
  };

  const handleAspectRatioChange = async (
    playlist: JsonPlaylist,
    newRatio: string
  ) => {
    // If custom is selected, open modal for new custom input
    if (newRatio === 'custom') {
      const current = playlist.settings?.aspect_ratio;
      setCustomWidth(String(current?.width || 16));
      setCustomHeight(String(current?.height || 9));
      setCustomRatioErrors(new Map());
      setCustomRatioModal({ playlist, show: true });
      return;
    }

    // Parse the ratio (could be a preset like "16:9" or a custom ratio like "5:4")
    const [width, height] = newRatio.split(':').map(Number);

    // If it's the same as current, do nothing
    const current = playlist.settings?.aspect_ratio;
    if (current && current.width === width && current.height === height) {
      return;
    }

    try {
      await PlaylistsService.updatePlaylist(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        `${playlist.id}`,
        {
          name: playlist.name,
          description: '',
          settings: {
            aspect_ratio: { width, height },
          },
        }
      );

      toast.success(t('playlists.aspectRatioUpdated'));
      refreshData();
    } catch (error) {
      toast.error(
        t('playlists.errors.updateAspectRatio', { error: String(error) })
      );
    }
  };

  // Use function to make columns reactive to i18n changes
  const columns = () =>
    [
      { key: 'name', title: () => t('common.name'), sortable: true },
      {
        key: 'aspect_ratio',
        title: () => t('playlists.aspectRatio'),
        sortable: false,
        render: (item: JsonPlaylist) => {
          const aspectRatio = item.settings?.aspect_ratio;
          const currentRatio = aspectRatio
            ? `${aspectRatio.width}:${aspectRatio.height}`
            : '16:9';
          const preset = ASPECT_RATIO_OPTIONS.find(
            (opt) => opt.value === currentRatio
          );
          const label = preset ? t(preset.label) : currentRatio;

          return (
            <span
              title={label !== currentRatio ? label : undefined}
              style={{ 'font-size': '0.85em', 'white-space': 'nowrap' }}
            >
              {currentRatio}
            </span>
          );
        },
      },
      { key: 'status', title: () => t('common.status'), sortable: false },
      {
        key: 'inserted_at',
        title: () => t('common.created'),
        sortable: true,
        render: (item: JsonPlaylist) => (
          <Timestamp value={item.inserted_at!} mode="relative" />
        ),
      },
      {
        key: 'updated_at',
        title: () => t('common.updated'),
        sortable: true,
        render: (item: JsonPlaylist) => (
          <Timestamp value={item.updated_at!} mode="relative" />
        ),
      },
      {
        key: 'tags',
        title: () => t('tags.title'),
        sortable: false,
        render: (item: JsonPlaylist) => {
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
    ] as Column<JsonPlaylist>[];

  // Use function to make actions reactive to i18n changes
  const actions = (): TableAction<JsonPlaylist>[] => [
    {
      icon: BsEye,
      handler: openModal,
      label: t('common.view'),
    },
    {
      icon: AiOutlineEdit,
      handler: (item: JsonPlaylist) => {
        setCurrentPlaylist(item);
        setShowRenameModal(true);
      },
      label: t('common.rename'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: JsonPlaylist) => {
        if (!canPerformAction('playlists', 'delete')) {
          toast.error(
            t('permissions.noDeletePlaylists') ||
              "You don't have permission to delete playlists"
          );
          return;
        }
        setCurrentPlaylist(item);
        setShowConfirmDialog(item);
      },
      label: t('common.remove'),
    },
  ];

  /** It may be possible to refactor this code as most views will have the same UI for
   * removing resources.
   */
  const [showConfirmDialog, setShowConfirmDialog] = createSignal<
    JsonPlaylist | undefined
  >();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveResource = async (resource: JsonPlaylist | undefined) => {
    if (!resource) {
      return;
    }
    try {
      await PlaylistsService.removePlaylist(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        resource.id
      );

      refreshData();
      toast.success(`Playlist "${resource.name}" removed successfully`);
      loadQuota(); // Reload quota after deletion
    } catch (error: any) {
      // Check if error has channel information (409 conflict error)
      if (
        error?.errorData?.channels &&
        Array.isArray(error.errorData.channels)
      ) {
        // Format channel usage information
        const channelInfo = error.errorData.channels.map((ch: any) => {
          if (ch.usage_type === 'default') {
            return `${ch.name} (default playlist)`;
          } else if (ch.usage_type === 'scheduled') {
            const start = new Date(ch.entry_start).toLocaleString();
            const end = new Date(ch.entry_end).toLocaleString();
            const repeatInfo = ch.repeat_until
              ? `, repeats until ${new Date(ch.repeat_until).toLocaleDateString()}`
              : '';
            return `${ch.name} (scheduled: ${start} - ${end}${repeatInfo})`;
          }
          return ch.name || ch;
        });

        const channelList = channelInfo.join('\n• ');
        toast.error(
          `${error.message}:\n\n• ${channelList}\n\nPlease remove the playlist from these channels first.`,
          8000
        );
      } else {
        toast.error(`Error removing playlist ${resource.name}: ${error}`);
      }
    }
    setShowConfirmDialog();
  };

  const confirmRemoveMultipleResources = async () => {
    const results = await Promise.allSettled(
      Array.from(selectedPlaylists()).map((resourceId) =>
        PlaylistsService.removePlaylist(
          props.store.env.baseUrl,
          props.store.organizations.selectedId,
          resourceId
        )
      )
    );

    const failures = results.filter(
      (result) => result.status === 'rejected'
    ) as PromiseRejectedResult[];
    const successes = results.filter((result) => result.status === 'fulfilled');

    if (successes.length > 0) {
      refreshData();
      toast.success(`${successes.length} playlist(s) removed successfully`);
      loadQuota(); // Reload quota after deletion
    }

    if (failures.length > 0) {
      // Collect all error messages with channel information
      const errorMessages = failures.map((failure) => {
        const error = failure.reason;
        if (
          error?.errorData?.channels &&
          Array.isArray(error.errorData.channels)
        ) {
          const channelList = error.errorData.channels.join(', ');
          return `${error.message}. Channels: ${channelList}`;
        }
        return error?.message || String(error);
      });

      toast.error(
        `Failed to remove ${failures.length} playlist(s):\n${errorMessages.join('\n')}`,
        7000
      );
    }

    setShowConfirmDialogMultiple(false);
    setSelectedPlaylists(new Set<number>());
  };

  return (
    <div class="playlists-page">
      {/* Custom Aspect Ratio Modal */}
      <Show when={customRatioModal().show}>
        <Modal
          title={t('playlists.customAspectRatio')}
          description={t('playlists.enterCustomRatio')}
          onClose={() => {
            setCustomRatioModal({ playlist: null as any, show: false });
            setCustomRatioErrors(new Map());
          }}
        >
          <div
            style={{
              display: 'flex',
              'flex-direction': 'column',
              gap: '1.5em',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '1em',
                'align-items': 'flex-start',
              }}
            >
              <FormItem
                label={t('playlists.aspectRatioWidth')}
                id="customWidthTable"
                value={customWidth()}
                placeholder="16"
                type="number"
                onInput={(value: string | number | boolean) => {
                  const strValue = String(value);
                  setCustomWidth(strValue);
                  validateCustomRatio('width', strValue);
                }}
              >
                <div class="error">{customRatioErrors().get('width')}</div>
              </FormItem>
              <span
                style={{
                  'font-size': '1.5em',
                  'font-weight': 'bold',
                  'padding-top': '2em',
                }}
              >
                :
              </span>
              <FormItem
                label={t('playlists.aspectRatioHeight')}
                id="customHeightTable"
                value={customHeight()}
                placeholder="9"
                type="number"
                onInput={(value: string | number | boolean) => {
                  const strValue = String(value);
                  setCustomHeight(strValue);
                  validateCustomRatio('height', strValue);
                }}
              >
                <div class="error">{customRatioErrors().get('height')}</div>
              </FormItem>
            </div>
            <Show when={customRatioErrors().get('ratio')}>
              <div
                class="error"
                style={{
                  color: '#ef4444',
                  padding: '0.5em',
                  background: 'rgba(239, 68, 68, 0.1)',
                  'border-radius': '0.25em',
                }}
              >
                {customRatioErrors().get('ratio')}
              </div>
            </Show>
            <div
              style={{
                display: 'flex',
                gap: '1em',
                'justify-content': 'flex-end',
              }}
            >
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setCustomRatioModal({ playlist: null as any, show: false });
                  setCustomRatioErrors(new Map());
                }}
                color="secondary"
              />
              <Button
                label={t('common.apply')}
                onClick={handleCustomRatioSubmit}
                color="primary"
                icon={BsCheckLg}
                disabled={customRatioErrors().size > 0}
              />
            </div>
          </div>
        </Modal>
      </Show>

      <Show when={showAddPlaylistModal()}>
        <Modal
          title={t('playlists.addPlaylist')}
          description={t('playlists.createNewPlaylist')}
          onClose={() => setShowAddPlaylistModal(false)}
        >
          <PlaylistAddForm
            t={t}
            teamId={selectedTeamId()}
            onSubmit={async (
              name: string,
              aspectRatio: AspectRatio,
              teamId?: number | null
            ) => {
              try {
                const result = await PlaylistsService.addPlaylist(
                  props.store.env.baseUrl,
                  props.store.organizations.selectedId,
                  name,
                  aspectRatio,
                  teamId
                );
                setShowAddPlaylistModal(false);
                if (result?.data) {
                  setCurrentPlaylist(result.data);
                  setShowModal(true);
                  refreshData();
                  toast.success(`Playlist "${name}" created successfully`);
                  loadQuota(); // Reload quota after creation

                  // Complete the onboarding step for playlist creation
                  props.store.onboarding?.completeStep?.('create_playlist');
                }
              } catch (error) {
                toast.error(`Error creating playlist: ${error}`);
              }
            }}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={t('playlists.playlistTitle', {
            name: currentPlaylist()?.name,
          })}
          description={t('playlists.buildPlaylist')}
          onClose={closeModal}
          contentClass="playlist-modal"
        >
          <PlaylistView
            store={props.store}
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            playlistId={currentPlaylist()?.id!}
            t={t}
            onChange={() => {
              // Playlist changed
            }}
            onNavigateAway={closeModal}
          />
        </Modal>
      </Show>

      <Show when={showRenameModal()}>
        <Modal
          title={t('playlists.renamePlaylist')}
          description=""
          onClose={() => setShowRenameModal(false)}
          contentClass="playlist-rename-modal"
        >
          <div class="playlist-rename-form">
            <FormItem
              label={t('common.name')}
              id="renameName"
              value={currentPlaylist()?.name || ''}
              placeholder={t('playlists.enterPlaylistName')}
              autofocus={true}
              onInput={(value: string | number | boolean) => {
                const strValue = value as string;
                setCurrentPlaylist((prev) =>
                  prev ? { ...prev, name: strValue } : prev
                );
              }}
            >
              <div></div>
            </FormItem>
            <div class="actions">
              <Button
                label={t('common.update')}
                onClick={async () => {
                  try {
                    await PlaylistsService.updatePlaylist(
                      props.store.env.baseUrl,
                      props.store.organizations.selectedId,
                      `${currentPlaylist()?.id}`,
                      {
                        name: currentPlaylist()?.name || '',
                        description: '',
                      }
                    );
                    refreshData();
                    toast.success(
                      t('playlists.playlistUpdated', {
                        name: currentPlaylist()?.name,
                      })
                    );
                    setShowRenameModal(false);
                  } catch (error) {
                    toast.error(
                      t('playlists.errorUpdating', {
                        name: currentPlaylist()?.name,
                        error: String(error),
                      })
                    );
                  }
                }}
                color="success"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => setShowRenameModal(false)}
                color="danger"
              />
            </div>
          </div>
        </Modal>
      </Show>

      <ConfirmDialog
        show={!!showConfirmDialog()}
        title={t('playlists.removePlaylist')}
        message={t('playlists.confirmRemovePlaylist', {
          name: showConfirmDialog()?.name,
        })}
        onClose={() => setShowConfirmDialog()}
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('playlists.removePlaylists')}
        message={t('playlists.confirmRemovePlaylists')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleResources()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedPlaylists()).map((resourceId) => {
            const resource = data().find((d) => d.id == resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <Show when={viewMode() === 'list'}>
        <TableView
          title={t('playlists.title')}
          resource="playlists"
          params={props.params}
          fetchData={fetchData}
          ref={setRef}
          toolbar={{
            mainAction: (
              <div style="display: flex; align-items: center; gap: 1rem;">
                <Show when={quota()}>
                  <QuotaIndicator
                    used={quota()!.used}
                    total={quota()!.total}
                    resourceName="Playlists"
                    compact
                    isLoading={showLoadingIndicator()}
                  />
                </Show>
                <Button
                  label={t('playlists.addPlaylist')}
                  onClick={openAddPlaylistModal}
                  icon={BsCheckLg}
                  color="primary"
                  disabled={
                    isQuotaReached() || !canPerformAction('playlists', 'create')
                  }
                  data-onboarding="add-playlist"
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
                disabled={!canPerformAction('playlists', 'delete')}
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
            onRowSelect,
            defaultRowAction: {
              icon: BsEye,
              handler: (item: JsonPlaylist) => {
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
          title={t('playlists.title')}
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
                  resourceName="Playlists"
                  compact
                  isLoading={showLoadingIndicator()}
                />
              </Show>
              <Button
                label={t('playlists.addPlaylist')}
                onClick={openAddPlaylistModal}
                icon={BsCheckLg}
                color="primary"
                disabled={
                  isQuotaReached() || !canPerformAction('playlists', 'create')
                }
                data-onboarding="add-playlist"
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
          storageKey="playlists"
          onResourceClick={(item) => openModal(item as unknown as JsonPlaylist)}
          renderResource={(item) => (
            <div
              class="playlist-tree-item"
              onClick={() => openModal(item as unknown as JsonPlaylist)}
            >
              <div class="playlist-tree-info">
                <span class="playlist-tree-name">{item.name}</span>
                <Show when={(item as any).settings?.aspect_ratio}>
                  <span class="playlist-tree-meta">
                    {(item as any).settings.aspect_ratio.width}:
                    {(item as any).settings.aspect_ratio.height}
                  </span>
                </Show>
              </div>
              <button
                class="playlist-tree-tag-btn"
                onClick={async (e) => {
                  e.stopPropagation();
                  const playlist = item as unknown as JsonPlaylist;
                  const orgId = props.store.organizations.selectedId;
                  if (orgId && !resourceTagsMap().has(playlist.id)) {
                    try {
                      const itemTags = await tagsService.getResourceTags(
                        orgId,
                        'playlist',
                        playlist.id
                      );
                      setResourceTagsMap((prev) => {
                        const next = new Map(prev);
                        next.set(playlist.id, itemTags);
                        return next;
                      });
                    } catch {
                      /* ignore */
                    }
                  }
                  setTagPopoverTarget({
                    item: playlist,
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
    <PlaylistsPage {...props} />
  </ToastProvider>
);
