import { BsEye, BsTrash } from 'solid-icons/bs';
import { AiOutlineUpload } from 'solid-icons/ai';
import {
  Component,
  createSignal,
  createEffect,
  createMemo,
  Show,
  For,
  onMount,
  batch,
} from 'solid-js';

import {
  Button,
  Modal,
  TableAction,
  Column,
  SortOptions,
  TableView,
  TableViewRef,
  ModalRef,
  Tabs,
  ConfirmDialog,
} from '@castmill/ui-common';
import { JsonWidget } from '@castmill/player';
import { WidgetsService, WidgetUsage } from '../services/widgets.service';
import { UploadComponent } from './upload';
import { JsonHighlight } from './json-highlight';
import { AssetsList } from './assets-list';
import { IntegrationsList } from '../../common/components/integrations-list';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import './widgets.scss';
import { AddonStore } from '../../common/interfaces/addon-store';

// Widget type with required ID and slug for table display and API calls
type WidgetWithId = JsonWidget & { id: number; slug: string };

const WidgetsPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
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

  const itemsPerPage = 10;

  const [showModal, setShowModal] = createSignal<WidgetWithId | undefined>();
  const [initialTabIndex, setInitialTabIndex] = createSignal(0);
  const [widgetHasIntegrations, setWidgetHasIntegrations] = createSignal(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [widgetToDelete, setWidgetToDelete] = createSignal<
    WidgetWithId | undefined
  >();
  const [widgetUsage, setWidgetUsage] = createSignal<WidgetUsage[]>([]);
  const [isLoadingUsage, setIsLoadingUsage] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);

  // Flag to prevent URL effect from interfering while opening modal programmatically
  let isOpeningModal = false;

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  let uploadModalRef: ModalRef | undefined = undefined;

  const [tableRef, setRef] = createSignal<TableViewRef<number, WidgetWithId>>();

  // Memoized tabs array that reacts to widgetHasIntegrations changes
  const modalTabs = createMemo(() => {
    const widget = showModal();
    const hasIntegrations = widgetHasIntegrations();

    if (!widget) return [];

    const tabs = [
      {
        title: t('widgets.template'),
        content: () => <JsonHighlight json={widget.template} />,
      },
    ];

    if (widget.options_schema) {
      tabs.push({
        title: t('widgets.optionsSchema'),
        content: () => <JsonHighlight json={widget.options_schema} />,
      });
    }

    if (widget.data_schema) {
      tabs.push({
        title: t('widgets.dataSchema'),
        content: () => <JsonHighlight json={widget.data_schema} />,
      });
    }

    // Add assets tab if widget has assets
    if (widget.assets && Object.keys(widget.assets).length > 0) {
      tabs.push({
        title: t('widgets.assets.title'),
        content: () => (
          <AssetsList
            assets={widget.assets}
            widgetSlug={widget.slug}
            baseUrl={props.store.env.baseUrl}
            t={t}
          />
        ),
      });
    }

    if (hasIntegrations) {
      tabs.push({
        title: t('widgets.integrations.title'),
        content: () => (
          <IntegrationsList
            store={props.store}
            widgetId={widget.id}
            widgetSlug={widget.slug}
            baseUrl={props.store.env.baseUrl}
          />
        ),
      });
    }

    return tabs;
  });

  const refreshData = () => {
    tableRef()?.reloadData();
  };

  // Helper to open widget modal by ID with optional tab selection
  const openWidgetById = async (widgetId: number, tab?: string) => {
    try {
      const widget = await WidgetsService.getWidgetById(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        widgetId
      );

      if (widget) {
        // Check if widget has integrations
        const integrations = await WidgetsService.getWidgetIntegrations(
          props.store.env.baseUrl,
          props.store.organizations.selectedId,
          (widget as WidgetWithId).slug
        );
        const hasIntegrations = integrations.length > 0;

        // Calculate tab index based on available tabs
        let tabIndex = 0;
        if (tab) {
          // The tab indices depend on which schemas exist for the widget
          const tabNames = ['template'];
          if (widget.options_schema) tabNames.push('options');
          if (widget.data_schema) tabNames.push('data');
          if (widget.assets && Object.keys(widget.assets).length > 0)
            tabNames.push('assets');
          if (hasIntegrations) tabNames.push('integrations');

          const foundIndex = tabNames.indexOf(tab);
          if (foundIndex >= 0) {
            tabIndex = foundIndex;
          }
        }

        batch(() => {
          setWidgetHasIntegrations(hasIntegrations);
          setInitialTabIndex(tabIndex);
          setShowModal(widget as WidgetWithId);
        });
      }
    } catch (err) {
      console.error('Failed to open widget:', err);
    }
  };

  // Update URL when widget modal is opened/closed
  const updateUrlForWidget = (widgetId: number | null, tab?: string) => {
    const orgId = props.store.organizations.selectedId;
    let url = `/org/${orgId}/content/widgets`;
    if (widgetId !== null) {
      url += `/${widgetId}`;
      if (tab) {
        url += `?tab=${tab}`;
      }
    }
    window.history.pushState({}, '', url);
  };

  // Open widget modal and update URL
  const openWidget = async (widget: WidgetWithId, tabIndex: number = 0) => {
    // Set flag to prevent URL effect from interfering
    isOpeningModal = true;

    // Check if widget has integrations
    const integrations = await WidgetsService.getWidgetIntegrations(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      widget.slug
    );
    const hasIntegrations = integrations.length > 0;

    // Update URL FIRST to prevent the createEffect from closing the modal
    // The effect checks lastProcessedUrl to avoid duplicate processing
    const orgId = props.store.organizations.selectedId;
    const newUrl = `/org/${orgId}/content/widgets/${widget.id}`;
    lastProcessedUrl = newUrl;
    window.history.pushState({}, '', newUrl);

    batch(() => {
      setWidgetHasIntegrations(hasIntegrations);
      setInitialTabIndex(tabIndex);
      setShowModal(widget);
    });

    // Reset flag after a microtask to ensure effect has run
    queueMicrotask(() => {
      isOpeningModal = false;
    });
  };

  // Close widget modal and update URL
  const closeWidget = () => {
    setShowModal(undefined);
    setInitialTabIndex(0);
    setWidgetHasIntegrations(false);
    updateUrlForWidget(null);
  };

  // Track last processed URL to avoid duplicate processing
  let lastProcessedUrl = '';

  // Check URL for deep links - reactive to location changes for soft navigation
  // URL pattern: /org/:orgId/content/widgets/:widgetId?tab=integrations
  createEffect(() => {
    // Skip if we're in the middle of programmatically opening a modal
    if (isOpeningModal) return;

    // Get location from router (reactive) or fall back to window.location
    const location = props.store.router?.location?.();
    const path = location?.pathname || window.location.pathname;
    const search = location?.search || window.location.search;
    const fullUrl = path + search;

    // Skip if we already processed this URL
    if (fullUrl === lastProcessedUrl) return;

    // Check if this is a widgets path
    if (!path.includes('/content/widgets')) return;

    const match = path.match(/\/content\/widgets\/(\d+)/);

    if (match) {
      const widgetId = parseInt(match[1], 10);
      if (!isNaN(widgetId)) {
        // Get tab from query params
        const urlParams = new URLSearchParams(search);
        const tab = urlParams.get('tab') || undefined;
        lastProcessedUrl = fullUrl;
        openWidgetById(widgetId, tab);
      }
    } else {
      // No widget ID in URL - close modal if open
      if (showModal()) {
        lastProcessedUrl = fullUrl;
        setShowModal(undefined);
        setInitialTabIndex(0);
      }
    }
  });

  // Register keyboard shortcuts
  onMount(() => {
    if (props.store.keyboardShortcuts) {
      const { registerShortcutAction } = props.store.keyboardShortcuts;

      registerShortcutAction(
        'generic-create',
        () => {
          if (canPerformAction('widgets', 'create')) {
            openUploadModal();
          }
        },
        () => window.location.pathname.includes('/widgets')
      );

      registerShortcutAction(
        'generic-search',
        () => {
          const currentTableRef = tableRef();
          if (currentTableRef) {
            currentTableRef.focusSearch();
          }
        },
        () => window.location.pathname.includes('/widgets')
      );
    }
  });

  // Apply fixed width to modals when they're shown
  createEffect(() => {
    if (showUploadModal()) {
      setTimeout(() => {
        const modalElement = document.querySelector(
          '.widget-upload-modal'
        ) as HTMLElement;
        if (modalElement) {
          modalElement.style.width = '50vw';
          modalElement.style.maxWidth = '50vw';
          modalElement.style.minWidth = '50vw';
        }
      }, 50);
    }
  });

  createEffect(() => {
    if (showModal()) {
      setTimeout(() => {
        const modalElement = document.querySelector(
          '.widget-details-modal'
        ) as HTMLElement;
        if (modalElement) {
          modalElement.style.width = '50vw';
          modalElement.style.maxWidth = '50vw';
          modalElement.style.minWidth = '50vw';
        }
      }, 50);
    }
  });

  const openUploadModal = () => {
    setShowUploadModal(true);
  };

  // Delete handlers
  const openDeleteConfirm = async (widget: WidgetWithId) => {
    setWidgetToDelete(widget);
    setIsLoadingUsage(true);
    setShowDeleteConfirm(true);

    try {
      const usage = await WidgetsService.getWidgetUsage(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        widget.id
      );
      setWidgetUsage(usage.data);
    } catch (error) {
      console.error('Failed to fetch widget usage:', error);
      setWidgetUsage([]);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setWidgetToDelete(undefined);
    setWidgetUsage([]);
    setIsDeleting(false);
  };

  const handleDeleteWidget = async () => {
    const widget = widgetToDelete();
    if (!widget) return;

    setIsDeleting(true);
    try {
      await WidgetsService.removeWidget(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        String(widget.id)
      );
      refreshData();
      closeDeleteConfirm();
    } catch (error) {
      console.error('Failed to delete widget:', error);
      setIsDeleting(false);
    }
  };

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => {
    const result = await WidgetsService.fetchWidgets(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
      }
    );

    // Cast to WidgetWithId since widgets from the server always have IDs
    return {
      data: result.data as WidgetWithId[],
      count: result.count,
    };
  };

  const columns: Column<number, WidgetWithId>[] = [
    {
      key: 'name',
      title: t('common.name'),
      sortable: true,
      render: (widget: WidgetWithId) => {
        const isImageIcon =
          widget.icon &&
          (widget.icon.startsWith('data:image/') ||
            widget.icon.startsWith('http://') ||
            widget.icon.startsWith('https://') ||
            widget.icon.startsWith('/'));

        // Resolve icon URL - prepend baseUrl for relative paths starting with /
        const iconUrl = widget.icon?.startsWith('/')
          ? `${props.store.env.baseUrl}${widget.icon}`
          : widget.icon;

        return (
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="font-size: 1.5em; min-width: 32px; line-height: 1; display: flex; align-items: center; justify-content: center;">
              {isImageIcon ? (
                <img
                  src={iconUrl}
                  alt={widget.name}
                  style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;"
                  onError={(e) => {
                    // Fallback to emoji if image fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                    const fallback =
                      document.createTextNode(DEFAULT_WIDGET_ICON);
                    e.target.parentNode?.appendChild(fallback);
                  }}
                />
              ) : (
                <span>{widget.icon || DEFAULT_WIDGET_ICON}</span>
              )}
            </div>
            <div style="text-align: left; flex: 1;">
              <div style="font-weight: 500;">{widget.name}</div>
              {widget.description && (
                <div style="font-size: 0.85em; color: #666; margin-top: 2px;">
                  {widget.description}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'template',
      title: t('common.type'),
      render: (widget: WidgetWithId) => {
        const type = widget.template?.type || t('common.unknown');
        return (
          <span
            style={`
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 500;
            background: #e8f4f8;
            color: #0066cc;
            border: 1px solid #b3d9f2;
          `}
          >
            {type}
          </span>
        );
      },
    },
    {
      key: 'update_interval_seconds',
      title: t('widgets.updateInterval'),
      sortable: true,
      render: (widget: WidgetWithId) =>
        widget.update_interval_seconds
          ? `${widget.update_interval_seconds}s`
          : t('common.notAvailable'),
    },
  ];

  const actions: TableAction<WidgetWithId>[] = [
    {
      label: t('widgets.viewDetails'),
      icon: BsEye,
      handler: (widget: WidgetWithId) => openWidget(widget),
    },
    // Only include delete action if user has delete permission
    ...(canPerformAction('widgets', 'delete')
      ? [
          {
            label: t('widgets.delete'),
            icon: BsTrash,
            handler: (widget: WidgetWithId) => openDeleteConfirm(widget),
          },
        ]
      : []),
  ];

  return (
    <div class="widgets-page">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        show={showDeleteConfirm()}
        title={t('widgets.deleteConfirmTitle')}
        message={
          widgetUsage().length > 0
            ? t('widgets.deleteConfirmUsageWarning', {
                widget: widgetToDelete()?.name,
                count: widgetUsage().length,
              })
            : t('widgets.deleteConfirmMessage', {
                widget: widgetToDelete()?.name,
              })
        }
        onConfirm={handleDeleteWidget}
        onClose={closeDeleteConfirm}
      >
        <Show when={isLoadingUsage()}>
          <div class="usage-loading">{t('common.loading')}</div>
        </Show>
        <Show when={!isLoadingUsage() && widgetUsage().length > 0}>
          <div class="usage-warning">
            <p class="usage-warning-text">{t('widgets.usedInPlaylists')}</p>
            <ul class="usage-list">
              <For each={widgetUsage()}>
                {(usage) => <li class="usage-item">{usage.playlist_name}</li>}
              </For>
            </ul>
            <p class="usage-cascade-note">{t('widgets.deleteCascadeNote')}</p>
          </div>
        </Show>
        <Show when={isDeleting()}>
          <div class="deleting-indicator">{t('common.deleting')}</div>
        </Show>
      </ConfirmDialog>

      <Show when={showUploadModal()}>
        <Modal
          ref={(ref: ModalRef) => (uploadModalRef = ref)}
          title={t('widgets.uploadWidget')}
          description={t('widgets.uploadDescription')}
          onClose={() => setShowUploadModal(false)}
          contentClass="widget-upload-modal"
        >
          <UploadComponent
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            onFileUpload={() => {
              // File upload started
            }}
            onUploadComplete={() => {
              refreshData();
            }}
            onCancel={() => {
              uploadModalRef?.close();
            }}
          />
        </Modal>
      </Show>

      <Show when={showModal()}>
        <Modal
          title={showModal()!.name}
          description={showModal()!.description || t('widgets.widgetDetails')}
          onClose={closeWidget}
          contentClass="widget-details-modal"
        >
          <div class="widget-details-content">
            {/* Widget metadata header */}
            <div class="widget-metadata">
              <div class="metadata-item">
                <strong>{t('common.type')}:</strong>{' '}
                <span class="type-value">
                  {showModal()!.template?.type || t('common.unknown')}
                </span>
              </div>
              {showModal()!.update_interval_seconds && (
                <div class="metadata-item">
                  <strong>{t('widgets.updateInterval')}:</strong>{' '}
                  <span class="interval-value">
                    {showModal()!.update_interval_seconds}s
                  </span>
                </div>
              )}
            </div>

            {/* Tabs using ui-common Tabs component */}
            <Tabs tabs={modalTabs()} initialIndex={initialTabIndex()} />
          </div>
        </Modal>
      </Show>

      <TableView<number, WidgetWithId>
        title={t('widgets.title')}
        resource="widgets"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label={t('widgets.uploadWidget')}
              onClick={openUploadModal}
              icon={AiOutlineUpload}
              color="primary"
              disabled={!canPerformAction('widgets', 'create')}
            />
          ),
        }}
        table={{
          columns,
          actions,
          defaultRowAction: {
            icon: BsEye,
            handler: (widget: WidgetWithId) => openWidget(widget),
            label: t('widgets.viewDetails'),
          },
        }}
        pagination={{ itemsPerPage }}
      />
    </div>
  );
};

export default WidgetsPage;
