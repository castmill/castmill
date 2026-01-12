import { BsEye, BsGrid, BsPlus } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import {
  Component,
  createEffect,
  createSignal,
  Show,
  onMount,
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
  Timestamp,
  ToastProvider,
  useToast,
} from '@castmill/ui-common';
import {
  LayoutsService,
  JsonLayout,
  LayoutCreate,
} from '../services/layouts.service';
import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

import './layouts.scss';
import { LayoutView } from './layout-view';
import { AddonComponentProps } from '../../common/interfaces/addon-store';
import { LayoutAddForm, AspectRatio } from './layout-add-form';
import { useTeamFilter, useModalFromUrl } from '../../common/hooks';

const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '21:9', label: '21:9 (Ultrawide)' },
  { value: '1:1', label: '1:1 (Square)' },
];

const LayoutsPage: Component<AddonComponentProps> = (props) => {
  const toast = useToast();
  const [data, setData] = createSignal<JsonLayout[]>([]);
  const [currentLayout, setCurrentLayout] = createSignal<JsonLayout>();
  const [showModal, setShowModal] = createSignal(false);
  const [showRenameModal, setShowRenameModal] = createSignal(false);

  // Get itemId from URL params
  const itemIdFromUrl = () => {
    if (!props.params) return undefined;
    return props.params[0]?.itemId;
  };

  // Function to close the modal and update URL
  const closeModalAndClearUrl = () => {
    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: undefined }, { replace: true });
    }
    setShowModal(false);
  };

  // Helper function to open modal for a given itemId
  const openModalFromItemId = (itemId: string) => {
    const currentData = data();

    const layout = currentData.find((l) => String(l.id) === String(itemId));
    if (layout) {
      setCurrentLayout(layout);
      setShowModal(true);
    } else if (currentData.length > 0 && props.store.organizations.selectedId) {
      LayoutsService.getLayout(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        itemId
      )
        .then((fetchedLayout) => {
          setCurrentLayout(fetchedLayout);
          setShowModal(true);
        })
        .catch((error) => {
          console.error('Failed to fetch layout by ID:', error);
        });
    }
  };

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
    params: props.params,
  });

  const [showAddLayoutModal, setShowAddLayoutModal] = createSignal(false);
  const [selectedLayouts, setSelectedLayouts] = createSignal(new Set<string>());

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

  // Sync modal state with URL for shareable deep links
  useModalFromUrl({
    getItemIdFromUrl: itemIdFromUrl,
    isModalOpen: () => showModal(),
    closeModal: closeModalAndClearUrl,
    openModal: openModalFromItemId,
  });

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(false);
  const [showLoadingIndicator, setShowLoadingIndicator] = createSignal(false);

  const quotasService = new QuotasService(props.store.env.baseUrl);

  let loadingTimeout: ReturnType<typeof setTimeout> | undefined;

  const loadQuota = async () => {
    if (!props.store.organizations.selectedId) return;

    try {
      setQuotaLoading(true);

      loadingTimeout = setTimeout(() => {
        if (quotaLoading()) {
          setShowLoadingIndicator(true);
        }
      }, 1000);

      const quotaData = await quotasService.getResourceQuota(
        props.store.organizations.selectedId,
        'layouts'
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

    const { registerShortcutAction } = props.store.keyboardShortcuts || {};
    if (registerShortcutAction) {
      registerShortcutAction(
        'generic-create',
        () => {
          if (canPerformAction('layouts', 'create') && !isQuotaReached()) {
            openAddLayoutModal();
          }
        },
        () =>
          window.location.pathname.includes('/layouts') &&
          canPerformAction('layouts', 'create') &&
          !isQuotaReached()
      );

      registerShortcutAction(
        'generic-search',
        () => {
          if (tableViewRef) {
            tableViewRef.focusSearch();
          }
        },
        () => window.location.pathname.includes('/layouts')
      );

      registerShortcutAction(
        'generic-delete',
        () => {
          if (
            selectedLayouts().size > 0 &&
            canPerformAction('layouts', 'delete')
          ) {
            setShowConfirmDialogMultiple(true);
          }
        },
        () =>
          window.location.pathname.includes('/layouts') &&
          selectedLayouts().size > 0 &&
          canPerformAction('layouts', 'delete')
      );
    }
  });

  onCleanup(() => {
    const { unregisterShortcutAction } = props.store.keyboardShortcuts || {};
    if (unregisterShortcutAction) {
      unregisterShortcutAction('generic-create');
      unregisterShortcutAction('generic-search');
      unregisterShortcutAction('generic-delete');
    }
  });

  // Reload data when organization changes
  createEffect(
    on(
      () => props.store.organizations.selectedId,
      (orgId, prevOrgId) => {
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
    return !!(q && q.used >= q.total);
  };

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedLayouts(new Set(rowsSelected));
  };

  let tableViewRef: TableViewRef<string, JsonLayout>;

  const setRef = (ref: TableViewRef<string, JsonLayout>) => {
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

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await LayoutsService.fetchLayouts(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
        team_id: selectedTeamId(),
      }
    );

    setData(result.data);
    return result;
  };

  const openAddLayoutModal = () => {
    setShowAddLayoutModal(true);
  };

  const openModal = (item: JsonLayout) => {
    setCurrentLayout(item);
    setShowModal(true);

    if (props.params) {
      const [, setSearchParams] = props.params;
      setSearchParams({ itemId: String(item.id) }, { replace: true });
    }
  };

  const [showConfirmDialog, setShowConfirmDialog] = createSignal<
    JsonLayout | undefined
  >();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveResource = async (resource: JsonLayout | undefined) => {
    if (!resource) return;

    try {
      await LayoutsService.deleteLayout(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        resource.id
      );

      refreshData();
      toast.success(
        t('layouts.deleteSuccess', { name: resource.name }) ||
          `Layout "${resource.name}" deleted successfully`
      );
      loadQuota();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Error deleting layout ${resource.name}: ${message}`);
    }
    setShowConfirmDialog();
  };

  const confirmRemoveMultipleResources = async () => {
    try {
      await Promise.all(
        Array.from(selectedLayouts()).map((resourceId) =>
          LayoutsService.deleteLayout(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            resourceId
          )
        )
      );

      refreshData();
      toast.success(`${selectedLayouts().size} layout(s) deleted successfully`);
      loadQuota();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Error deleting layouts: ${message}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedLayouts(new Set<string>());
  };

  const handleAddLayout = async (
    name: string,
    aspectRatio: AspectRatio
  ): Promise<boolean> => {
    try {
      const layoutData: LayoutCreate = {
        name,
        aspect_ratio: aspectRatio.value,
        zones: {
          zones: [
            {
              id: `zone-${Date.now()}`,
              name: 'Zone 1',
              rect: { x: 0, y: 0, width: 100, height: 100 },
              zIndex: 0,
            },
          ],
        },
      };

      const teamId = selectedTeamId();
      if (teamId !== null && teamId !== undefined) {
        layoutData.team_id = teamId;
      }

      await LayoutsService.createLayout(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        layoutData
      );

      refreshData();
      loadQuota();
      toast.success(t('layouts.addSuccess') || 'Layout created successfully');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Error creating layout: ${message}`);
      return false;
    }
  };

  const columns = [
    {
      key: 'name',
      title: t('common.name'),
      sortable: true,
    },
    {
      key: 'aspect_ratio',
      title: t('layouts.aspectRatio') || 'Aspect Ratio',
      sortable: true,
      render: (item: JsonLayout) => item.aspect_ratio || '-',
    },
    {
      key: 'zones',
      title: t('layouts.zones') || 'Zones',
      sortable: false,
      render: (item: JsonLayout) => {
        const zoneCount = item.zones?.zones?.length || 0;
        return `${zoneCount} zone${zoneCount !== 1 ? 's' : ''}`;
      },
    },
    {
      key: 'updated_at',
      title: t('common.modified'),
      sortable: true,
      render: (item: JsonLayout) =>
        item.updated_at ? (
          <Timestamp value={item.updated_at} mode="relative" />
        ) : (
          '-'
        ),
    },
  ] as Column<JsonLayout>[];

  const actions: TableAction<JsonLayout>[] = [
    {
      icon: BsEye,
      label: t('common.view'),
      handler: openModal,
    },
    {
      icon: AiOutlineDelete,
      label: t('common.delete'),
      handler: (item: JsonLayout) => setShowConfirmDialog(item),
    },
  ];

  return (
    <div class="layouts-page">
      <TableView
        title={t('sidebar.layouts')}
        resource="layouts"
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
                  resourceName={t('sidebar.layouts')}
                  compact
                  isLoading={showLoadingIndicator()}
                />
              </Show>
              <Button
                label={t('layouts.addLayout') || 'Add Layout'}
                onClick={openAddLayoutModal}
                icon={BsPlus}
                color="primary"
                disabled={
                  isQuotaReached() || !canPerformAction('layouts', 'create')
                }
              />
            </div>
          ),
          actions: (
            <div style="display: flex; gap: 1rem; align-items: center;">
              <TeamFilter
                teams={teams() ?? []}
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
                disabled={selectedLayouts().size === 0}
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
            handler: (item: JsonLayout) => {
              openModal(item);
            },
            label: t('common.view'),
          },
        }}
        pagination={{ itemsPerPage: 10 }}
      />

      {/* Add Layout Modal */}
      <Show when={showAddLayoutModal()}>
        <Modal
          title={t('layouts.addLayout') || 'Add Layout'}
          description={t('layouts.createNewLayout') || 'Create a new layout'}
          onClose={() => setShowAddLayoutModal(false)}
        >
          <LayoutAddForm
            onSubmit={async (name, aspectRatio) => {
              const success = await handleAddLayout(name, aspectRatio);
              if (success) {
                setShowAddLayoutModal(false);
              }
              return success;
            }}
            onCancel={() => setShowAddLayoutModal(false)}
            t={t}
          />
        </Modal>
      </Show>

      {/* Layout Details Modal */}
      <Show when={showModal()}>
        <Modal
          title={currentLayout()?.name || t('layouts.layoutDetails')}
          description={t('layouts.layoutDetails') || 'Layout details'}
          onClose={closeModalAndClearUrl}
          contentClass="layout-modal"
        >
          <Show when={currentLayout()}>
            <LayoutView
              layout={currentLayout()!}
              store={props.store}
              onUpdate={(updatedLayout) => {
                setCurrentLayout(updatedLayout);
                refreshData();
              }}
              onClose={closeModalAndClearUrl}
            />
          </Show>
        </Modal>
      </Show>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        show={!!showConfirmDialog()}
        title={t('layouts.deleteLayout') || 'Delete Layout'}
        message={
          t('layouts.confirmDelete', { name: showConfirmDialog()?.name }) ||
          `Are you sure you want to delete "${showConfirmDialog()?.name}"?`
        }
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
        onClose={() => setShowConfirmDialog()}
      />

      {/* Multi-delete Confirmation Dialog */}
      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('layouts.deleteLayouts') || 'Delete Layouts'}
        message={
          t('layouts.confirmDeleteMultiple', {
            count: selectedLayouts().size,
          }) ||
          `Are you sure you want to delete ${selectedLayouts().size} layout(s)?`
        }
        onConfirm={confirmRemoveMultipleResources}
        onClose={() => setShowConfirmDialogMultiple(false)}
      />
    </div>
  );
};

// Wrap the component with ToastProvider
const LayoutsPageWithToast: Component<AddonComponentProps> = (props) => {
  return (
    <ToastProvider>
      <LayoutsPage {...props} />
    </ToastProvider>
  );
};

export default LayoutsPageWithToast;
