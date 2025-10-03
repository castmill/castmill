import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { Component, createSignal, onCleanup, Show, onMount } from 'solid-js';

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
import { QuotaIndicator } from '../../common/components/quota-indicator';
import { QuotasService, ResourceQuota } from '../../common/services/quotas.service';

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
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      alert(`Error removing media ${resource.name}: ${error}`);
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
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      alert(`Error removing medias: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedMedias(new Set<string>());
  };

  const [selectedMedias, setSelectedMedias] = createSignal(new Set<string>());

  const [loading, setLoading] = createSignal(false);
  const [loadingSuccess, setLoadingSuccess] = createSignal('');
  const [loadingError, setLoadingError] = createSignal('');

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [storageQuota, setStorageQuota] = createSignal<ResourceQuota | null>(null);
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
        )
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
  });

  const isQuotaReached = (): boolean => {
    const q = quota();
    const sq = storageQuota();
    // Disable upload if either media count OR storage quota is reached
    return !!(q && q.used >= q.total) || !!(sq && sq.used >= sq.total);
  };

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
            when={
              item.status == 'ready' && item.files && item.files['thumbnail']
            }
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
            <div style="display: flex; align-items: center; gap: 1rem;">
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
                disabled={isQuotaReached()}
              />
            </div>
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
          defaultRowAction: {
            icon: BsEye,
            handler: (item: JsonMedia) => {
              openModal(item);
            },
            label: 'View',
          },
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default MediasPage;
