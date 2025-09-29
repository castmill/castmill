import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { AiOutlineUpload } from 'solid-icons/ai';
import { Component, createSignal, onCleanup, Show } from 'solid-js';

import {
  Button,
  IconButton,
  ConfirmDialog,
  Modal,
  TableAction,
  Column,
  SortOptions,
  TableView,
  TableViewRef,
  ModalRef,
  CircularProgress,
  ResourcesObserver,
} from '@castmill/ui-common';
import { JsonWidget } from '@castmill/player';
import { WidgetsService } from '../services/widgets.service';
import { UploadComponent } from './upload';

import './widgets.scss';
import { WidgetDetails } from './widget-details';
import { AddonStore } from '../../common/interfaces/addon-store';

const WidgetsPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
  const [data, setData] = createSignal<JsonWidget[]>([], {
    equals: false,
  });

  const itemsPerPage = 10; // Number of items to show per page

  const [showModal, setShowModal] = createSignal<JsonWidget | undefined>();

  const [showAddWidgetsModal, setShowAddWidgetsModal] = createSignal(false);

  const resourcesObserver = new ResourcesObserver<JsonWidget>(
    props.store.socket,
    'update',
    /* onJoin */
    (resource: JsonWidget) => {
      return `resource:widget:${resource.id}`;
    },
    /* onUpdate */
    (resource: JsonWidget, data: Partial<JsonWidget>) => {
      console.log('Updating widget', resource.id, data);
      updateItem(resource.id, data);
    }
  );

  /** It may be possible to refactor this code as most views will have the same UI for
   * removing resources.
   */
  const [showConfirmDialog, setShowConfirmDialog] = createSignal<
    JsonWidget | undefined
  >();
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveResource = async (resource: JsonWidget | undefined) => {
    if (!resource) {
      return;
    }
    try {
      await WidgetsService.removeWidget(
        props.store.env.baseUrl,
        props.store.organizations.selectedId,
        `${resource.id}`
      );

      refreshData();
    } catch (error) {
      alert(`Error removing widget ${resource.name}: ${error}`);
    }
    setShowConfirmDialog();
  };

  const confirmRemoveMultipleResources = async () => {
    try {
      await Promise.all(
        Array.from(selectedWidgets()).map((resourceId) =>
          WidgetsService.removeWidget(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            resourceId
          )
        )
      );

      refreshData();
    } catch (error) {
      alert(`Error removing widgets: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedWidgets(new Set<string>());
  };

  const closeAddWidgetsModal = () => {
    setShowAddWidgetsModal(false);
    refreshData();
  };

  const openAddWidgetsModal = () => {
    setShowAddWidgetsModal(true);
  };

  const [selectedWidgets, setSelectedWidgets] = createSignal<Set<string>>(
    new Set()
  );

  const [tableRef, setRef] = createSignal<TableViewRef>();

  const fetchData = async (
    page: number,
    pageSize: number,
    sortOptions: SortOptions,
    search: string,
    filters: Record<string, string | boolean>
  ) => {
    return WidgetsService.fetchWidgets(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page,
        page_size: pageSize,
        sortOptions,
        search,
        filters,
      }
    );
  };

  const refreshData = () => {
    const ref = tableRef();
    if (ref) {
      ref.refresh();
    }
  };

  const updateItem = (id: number, updates: Partial<JsonWidget>) => {
    setData((prevData) => {
      const newData = prevData.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      );
      return newData;
    });
  };

  const onRowSelect = (selectedIds: Set<string>) => {
    setSelectedWidgets(selectedIds);
  };

  const columns: Column[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (widget: JsonWidget) => (
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="font-size: 1.5em; min-width: 24px;">
            {widget.icon || '📦'}
          </div>
          <div>
            <div style="font-weight: 500;">{widget.name}</div>
            {widget.description && (
              <div style="font-size: 0.85em; color: #666; margin-top: 2px;">
                {widget.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'template',
      label: 'Type',
      render: (widget: JsonWidget) => (
        <div style="font-family: monospace; background: #f5f5f5; padding: 4px 8px; border-radius: 4px; display: inline-block;">
          {widget.template?.type || 'unknown'}
        </div>
      ),
    },
    {
      key: 'update_interval_seconds',
      label: 'Update Interval',
      sortable: true,
      render: (widget: JsonWidget) => 
        widget.update_interval_seconds ? `${widget.update_interval_seconds}s` : 'N/A',
    },
  ];

  const actions: TableAction<JsonWidget>[] = [
    {
      label: 'View Details',
      icon: BsEye,
      handler: (widget: JsonWidget) => setShowModal(widget),
    },
    {
      label: 'Delete',
      icon: AiOutlineDelete,
      handler: (widget: JsonWidget) => setShowConfirmDialog(widget),
      color: 'danger',
    },
  ];

  onCleanup(() => {
    resourcesObserver.cleanup();
  });

  return (
    <div class="widgets-page">
      <Modal ref={setShowModal} onClose={() => setShowModal()}>
        <Show when={showModal()}>
          <WidgetDetails 
            widget={showModal()!} 
            store={props.store}
            onClose={() => setShowModal()}
          />
        </Show>
      </Modal>

      <Modal ref={setShowAddWidgetsModal} onClose={closeAddWidgetsModal}>
        <Show when={showAddWidgetsModal()}>
          <UploadComponent
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            onCancel={closeAddWidgetsModal}
            onUploadComplete={closeAddWidgetsModal}
          />
        </Show>
      </Modal>

      <ConfirmDialog
        isOpen={!!showConfirmDialog()}
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
        onCancel={() => setShowConfirmDialog()}
        title="Delete Widget"
        confirmText="Delete"
        type="danger"
      >
        <div>
          Are you sure you want to delete the widget{' '}
          <strong>{showConfirmDialog()?.name}</strong>? This action cannot be
          undone.
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={showConfirmDialogMultiple()}
        onConfirm={confirmRemoveMultipleResources}
        onCancel={() => setShowConfirmDialogMultiple(false)}
        title="Delete Multiple Widgets"
        confirmText="Delete"
        type="danger"
      >
        <div>
          Are you sure you want to delete {selectedWidgets().size} widgets?
          This action cannot be undone.
          {Array.from(selectedWidgets()).map((resourceId) => {
            const resource = data().find((d) => `${d.id}` == resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title="Widgets"
        resource="widgets"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label="Upload Widget"
              onClick={openAddWidgetsModal}
              icon={AiOutlineUpload}
              color="primary"
            />
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedWidgets().size === 0}
              />
            </div>
          ),
        }}
        table={{
          columns,
          actions,
          onRowSelect,
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default WidgetsPage;