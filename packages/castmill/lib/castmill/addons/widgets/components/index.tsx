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

import './widgets.scss';
import { AddonStore } from '../../common/interfaces/addon-store';

const WidgetsPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
  const [data, setData] = createSignal<JsonWidget[]>([], {
    equals: false,
  });

  const itemsPerPage = 10;

  const [showModal, setShowModal] = createSignal<JsonWidget | undefined>();

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
  ];

  return (
    <div class="widgets-page">
      <Modal ref={setShowModal} onClose={() => setShowModal()}>
        <Show when={showModal()}>
          <div style="padding: 2rem; max-width: 800px;">
            <h2>{showModal()!.name}</h2>
            {showModal()!.description && (
              <p>{showModal()!.description}</p>
            )}
            <div style="margin-top: 1rem;">
              <h3>Template</h3>
              <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto;">
                {JSON.stringify(showModal()!.template, null, 2)}
              </pre>
            </div>
          </div>
        </Show>
      </Modal>

      <TableView
        title="Widgets"
        resource="widgets"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        table={{
          columns,
          actions,
        }}
        pagination={{ itemsPerPage }}
      />
    </div>
  );
};

export default WidgetsPage;