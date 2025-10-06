import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { Component, createSignal, Show, onMount } from 'solid-js';

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
import { JsonPlaylist } from '@castmill/player';
import { PlaylistsService } from '../services/playlists.service';
import { QuotaIndicator } from '../../common/components/quota-indicator';
import {
  QuotasService,
  ResourceQuota,
} from '../../common/services/quotas.service';

import './playlists.scss';
import { PlaylistView } from './playlist-view';
import { AddonStore } from '../../common/interfaces/addon-store';
import { PlaylistAddForm } from './playlist-add-form';
import { useTeamFilter } from '../../common/hooks';

const PlaylistsPage: Component<{
  store: AddonStore;
  params: any; //typeof useSearchParams;
}> = (props) => {
  const toast = useToast();
  const [data, setData] = createSignal<JsonPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = createSignal<JsonPlaylist>();
  const [showModal, setShowModal] = createSignal(false);

  const { teams, selectedTeamId, setSelectedTeamId } = useTeamFilter({
    baseUrl: props.store.env.baseUrl,
    organizationId: props.store.organizations.selectedId,
  });

  const [showAddPlaylistModal, setShowAddPlaylistModal] = createSignal(false);
  const [selectedPlaylists, setSelectedPlaylists] = createSignal(
    new Set<number>()
  );

  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;
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
  });

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
    setCurrentPlaylist(item);
    setShowModal(true);
  };

  // Function to close the modal and remove blur
  const closeModal = () => {
    setShowModal(false);
  };

  const columns = [
    { key: 'name', title: t('common.name'), sortable: true },
    { key: 'status', title: t('common.status'), sortable: false },
    {
      key: 'inserted_at',
      title: t('common.created'),
      sortable: true,
      render: (item: JsonPlaylist) => (
        <Timestamp value={item.inserted_at} mode="relative" />
      ),
    },
    {
      key: 'updated_at',
      title: t('common.updated'),
      sortable: true,
      render: (item: JsonPlaylist) => (
        <Timestamp value={item.updated_at} mode="relative" />
      ),
    },
  ] as Column<JsonPlaylist>[];

  const actions: TableAction<JsonPlaylist>[] = [
    {
      icon: BsEye,
      handler: openModal,
      label: t('common.view'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: JsonPlaylist) => {
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
    } catch (error) {
      toast.error(`Error removing playlist ${resource.name}: ${error}`);
    }
    setShowConfirmDialog();
  };

  const confirmRemoveMultipleResources = async () => {
    try {
      await Promise.all(
        Array.from(selectedPlaylists()).map((resourceId) =>
          PlaylistsService.removePlaylist(
            props.store.env.baseUrl,
            props.store.organizations.selectedId,
            resourceId
          )
        )
      );

      refreshData();
      toast.success(
        `${selectedPlaylists().size} playlist(s) removed successfully`
      );
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(`Error removing playlists: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedPlaylists(new Set<number>());
  };

  return (
    <div class="playlists-page">
      <Show when={showAddPlaylistModal()}>
        <Modal
          title={t('playlists.addPlaylist')}
          description={t('playlists.createNewPlaylist')}
          onClose={() => setShowAddPlaylistModal(false)}
        >
          <PlaylistAddForm
            t={t}
            onSubmit={async (name: string) => {
              try {
                const result = await PlaylistsService.addPlaylist(
                  props.store.env.baseUrl,
                  props.store.organizations.selectedId,
                  name
                );
                setShowAddPlaylistModal(false);
                if (result?.data) {
                  setCurrentPlaylist(result.data);
                  setShowModal(true);
                  refreshData();
                  toast.success(`Playlist "${name}" created successfully`);
                  loadQuota(); // Reload quota after creation
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
            baseUrl={props.store.env.baseUrl}
            organizationId={props.store.organizations.selectedId}
            playlistId={currentPlaylist()?.id!}
            onChange={(playlist) => {
              console.log('Playlist changed', playlist);
            }}
          />
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
            console.log('Resource ID', resourceId);
            const resource = data().find((d) => d.id == resourceId);
            return <div>{`- ${resource?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

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
                disabled={isQuotaReached()}
              />
            </div>
          ),
          actions: (
            <div style="display: flex; gap: 1rem; align-items: center;">
              <TeamFilter
                teams={teams()}
                selectedTeamId={selectedTeamId()}
                onTeamChange={handleTeamChange}
              />
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedPlaylists().size === 0}
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
            handler: (item: JsonPlaylist) => {
              setCurrentPlaylist(item);
              setShowModal(true);
            },
            label: t('common.view'),
          },
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default (props: any) => (
  <ToastProvider>
    <PlaylistsPage {...props} />
  </ToastProvider>
);
