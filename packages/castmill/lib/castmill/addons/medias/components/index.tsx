import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
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
import { JsonMedia } from '@castmill/player';
import { MediasService } from '../services/medias.service';
import { UploadComponent } from './upload';

import './medias.scss';
import { MediaDetails } from './media-details';
import { AddonStore } from '../../common/interfaces/addon-store';

const MediasPage: Component<{
  store: AddonStore;
  params: any; //typeof useSearchParams;
}> = (props) => {
  const [data, setData] = createSignal<JsonMedia[]>([], {
    equals: false,
  });

  const itemsPerPage = 10; // Number of items to show per page

  const [showModal, setShowModal] = createSignal<JsonMedia | undefined>();

  const [showAddMediasModal, setShowAddMediasModal] = createSignal(false);

  const resourcesObserver = new ResourcesObserver<JsonMedia>(
    props.store.socket,
    'update',
    /* onJoin */
    (resource: JsonMedia) => {
      return `resource:media:${resource.id}`;
    },
    /* onUpdate */
    (resource: JsonMedia, data: Partial<JsonMedia>) => {
      console.log('Updating media', resource.id, data);
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
    } catch (error) {
      alert(`Error removing device ${resource.name}: ${error}`);
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
            resourceId
          )
        )
      );

      refreshData();
    } catch (error) {
      alert(`Error removing devices: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedMedias(new Set<string>());
  };

  const [selectedMedias, setSelectedMedias] = createSignal(new Set<string>());

  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');
  const [loadingError, setLoadingError] = createSignal('');

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedMedias(rowsSelected);
  };

  let tableViewRef: TableViewRef<JsonMedia>;

  const setRef = (ref: TableViewRef<JsonMedia>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
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
  }: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => {
    const result = await MediasService.fetchMedias(
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
    setShowModal(item);
  };

  // Function to close the modal and remove blur
  const closeModal = () => {
    setShowModal();
  };

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${size} ${sizes[i]}`;
  }

  const columns = [
    {
      key: 'thumbnail',
      title: '',
      sortable: false,
      // Show thumbnail or progress circle (a circular progress bar with some % in the middle, or error if not a number)
      render: (item: JsonMedia) => (
        <div class="thumbnail">
          <Show
            when={item.status == 'ready' && item.files && item.files['thumbnail']}
            fallback={
              <Show
                when={item['status'] == 'transcoding'}
                fallback={<div class="error">{item.status_message}</div>}
              >
                <CircularProgress progress={parseFloat(item.status_message!)} />
              </Show>
            }
          >
            <img src={item.files['thumbnail'].uri} alt={item.name} />
          </Show>
        </div>
      ),
    },
    { key: 'name', title: 'Name', sortable: true },
    {
      key: 'size',
      title: 'Size',
      sortable: false,
      render: (item: JsonMedia) => formatBytes(item.size),
    },
    { key: 'mimetype', title: 'Type', sortable: true },
    { key: 'inserted_at', title: 'Created', sortable: true },
    { key: 'updated_at', title: 'Updated', sortable: true },
  ] as Column<JsonMedia>[];

  const actions = [
    {
      icon: BsEye,
      handler: openModal,
      label: 'View',
    },
    {
      icon: AiOutlineDelete,
      handler: (item: JsonMedia) => {
        setShowConfirmDialog(item);
      },
      label: 'Remove',
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
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            onFileUpload={(fileName: string, result: any) => {
              console.log('File uploaded', fileName, result);
            }}
            onUploadComplete={() => {
              // Refresh table
              refreshData();
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
          onClose={closeModal}
          contentClass="medias-modal"
        >
          <MediaDetails
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
                return true;
              } catch (error) {
                alert(`Error updating media ${showModal()?.name}: ${error}`);
                return false;
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title="Remove Device"
        message={`Are you sure you want to remove device "${showConfirmDialog()?.name}"?`}
        onClose={() => setShowConfirmDialog()}
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title="Remove Devices"
        message={'Are you sure you want to remove the following devices?'}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleResources()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedMedias()).map((resourceId) => {
            console.log('Resource ID', resourceId);
            const resource = data().find((d) => `${d.id}` == resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title="Medias"
        resource="medias"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label="Upload Media"
              onClick={openAddMediasModal}
              icon={BsCheckLg}
              color="primary"
            />
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedMedias().size === 0}
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

export default MediasPage;
