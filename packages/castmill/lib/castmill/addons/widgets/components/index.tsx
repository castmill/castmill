import { BsEye } from 'solid-icons/bs';
import { AiOutlineUpload } from 'solid-icons/ai';
import { Component, createSignal, createEffect, Show } from 'solid-js';

import {
  Button,
  Modal,
  TableAction,
  Column,
  SortOptions,
  TableView,
  TableViewRef,
  ModalRef,
} from '@castmill/ui-common';
import { JsonWidget } from '@castmill/player';
import { WidgetsService } from '../services/widgets.service';
import { UploadComponent } from './upload';
import { JsonHighlight } from './json-highlight';

import { DEFAULT_WIDGET_ICON } from '../../common/constants';
import './widgets.scss';
import { AddonStore } from '../../common/interfaces/addon-store';

// Widget type with required ID for table display
type WidgetWithId = JsonWidget & { id: number };

const WidgetsPage: Component<{
  store: AddonStore;
  params: any;
}> = (props) => {
  const [data, setData] = createSignal<WidgetWithId[]>([], {
    equals: false,
  });

  const itemsPerPage = 10;

  const [showModal, setShowModal] = createSignal<WidgetWithId | undefined>();
  let modalRef: ModalRef | undefined = undefined;

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  let uploadModalRef: ModalRef | undefined = undefined;

  const [tableRef, setRef] = createSignal<TableViewRef<number, WidgetWithId>>();

  const refreshData = () => {
    tableRef()?.reloadData();
  };

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
      title: 'Name',
      sortable: true,
      render: (widget: WidgetWithId) => {
        const isImageIcon =
          widget.icon &&
          (widget.icon.startsWith('data:image/') ||
            widget.icon.startsWith('http://') ||
            widget.icon.startsWith('https://') ||
            widget.icon.startsWith('/'));

        return (
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="font-size: 1.5em; min-width: 32px; line-height: 1; display: flex; align-items: center; justify-content: center;">
              {isImageIcon ? (
                <img
                  src={widget.icon}
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
      title: 'Type',
      render: (widget: WidgetWithId) => {
        const type = widget.template?.type || 'unknown';
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
      title: 'Update Interval',
      sortable: true,
      render: (widget: WidgetWithId) =>
        widget.update_interval_seconds
          ? `${widget.update_interval_seconds}s`
          : 'N/A',
    },
  ];

  const actions: TableAction<WidgetWithId>[] = [
    {
      label: 'View Details',
      icon: BsEye,
      handler: (widget: WidgetWithId) => setShowModal(widget),
    },
  ];

  return (
    <div class="widgets-page">
      <Show when={showUploadModal()}>
        <Modal
          ref={(ref: ModalRef) => (uploadModalRef = ref)}
          title="Upload Widget"
          description="Upload a JSON widget definition file."
          onClose={() => setShowUploadModal(false)}
          contentClass="widget-upload-modal"
        >
          <UploadComponent
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            onFileUpload={(fileName: string, result: any) => {
              console.log('Widget uploaded', fileName, result);
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
          ref={(ref: ModalRef) => (modalRef = ref)}
          title={showModal()!.name}
          description={showModal()!.description || 'Widget details'}
          onClose={() => setShowModal(undefined)}
          contentClass="widget-details-modal"
        >
          <div style="padding: 1rem; max-height: 70vh; overflow-y: auto;">
            <div style="margin-bottom: 1.5rem; color: #f8f9fa; background: #2d2d2d; padding: 1rem; border-radius: 4px;">
              <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                <div>
                  <strong style="color: #9cdcfe;">Type:</strong>{' '}
                  <span style="color: #ce9178;">
                    {showModal()!.template?.type || 'unknown'}
                  </span>
                </div>
                {showModal()!.update_interval_seconds && (
                  <div>
                    <strong style="color: #9cdcfe;">Update Interval:</strong>{' '}
                    <span style="color: #b5cea8;">
                      {showModal()!.update_interval_seconds}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
              <h3 style="margin-bottom: 0.5rem; font-size: 1.1em; color: #d4d4d4;">
                Template
              </h3>
              <JsonHighlight json={showModal()!.template} />
            </div>

            {showModal()!.options_schema && (
              <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 0.5rem; font-size: 1.1em; color: #d4d4d4;">
                  Options Schema
                </h3>
                <JsonHighlight json={showModal()!.options_schema} />
              </div>
            )}

            {showModal()!.data_schema && (
              <div style="margin-bottom: 1.5rem;">
                <h3 style="margin-bottom: 0.5rem; font-size: 1.1em; color: #d4d4d4;">
                  Data Schema
                </h3>
                <JsonHighlight json={showModal()!.data_schema} />
              </div>
            )}
          </div>
        </Modal>
      </Show>

      <TableView<number, WidgetWithId>
        title="Widgets"
        resource="widgets"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label="Upload Widget"
              onClick={openUploadModal}
              icon={AiOutlineUpload}
              color="primary"
            />
          ),
        }}
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
