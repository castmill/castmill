import { BsCheckLg } from 'solid-icons/bs';
import { BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { Component, createSignal, Show } from 'solid-js';

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
  Timestamp,
} from '@castmill/ui-common';
import { JsonPlaylist } from '@castmill/player';
import { PlaylistsService } from '../services/playlists.service';

import './playlists.scss';
import { PlaylistView } from './playlist-view';
import { AddonStore } from '../../common/interfaces/addon-store';
import { PlaylistAddForm } from './playlist-add-form';

const PlaylistsPage: Component<{
  store: AddonStore;
  params: any; //typeof useSearchParams;
}> = (props) => {
  const [data, setData] = createSignal<JsonPlaylist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = createSignal<JsonPlaylist>();
  const [showModal, setShowModal] = createSignal(false);

  const [showAddPlaylistModal, setShowAddPlaylistModal] = createSignal(false);
  const [selectedPlaylists, setSelectedPlaylists] = createSignal(
    new Set<number>()
  );

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
    { key: 'name', title: 'Name', sortable: true },
    { key: 'status', title: 'Status', sortable: false },
    { 
      key: 'inserted_at', 
      title: 'Created', 
      sortable: true,
      render: (item: JsonPlaylist) => <Timestamp value={item.inserted_at} mode="relative" />
    },
    { 
      key: 'updated_at', 
      title: 'Updated', 
      sortable: true,
      render: (item: JsonPlaylist) => <Timestamp value={item.updated_at} mode="relative" />
    },
  ] as Column<JsonPlaylist>[];

  const actions: TableAction<JsonPlaylist>[] = [
    {
      icon: BsEye,
      handler: openModal,
      label: 'View',
    },
    {
      icon: AiOutlineDelete,
      handler: (item: JsonPlaylist) => {
        setCurrentPlaylist(item);
        setShowConfirmDialog(item);
      },
      label: 'Remove',
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
    } catch (error) {
      alert(`Error removing playlist ${resource.name}: ${error}`);
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
    } catch (error) {
      alert(`Error removing playlists: ${error}`);
    }
    setShowConfirmDialogMultiple(false);
    setSelectedPlaylists(new Set<number>());
  };

  return (
    <div class="playlists-page">
      <Show when={showAddPlaylistModal()}>
        <Modal
          title="Add Playlist"
          description="Create a new playlist"
          onClose={() => setShowAddPlaylistModal(false)}
        >
          <PlaylistAddForm
            onSubmit={async (name: string) => {
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
              }
            }}
          />
        </Modal>
      </Show>
      <Show when={showModal()}>
        <Modal
          title={`Playlist "${currentPlaylist()?.name}"`}
          description="Build your playlist here"
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
        title="Remove Playlist"
        message={`Are you sure you want to remove playlist "${showConfirmDialog()?.name}"?`}
        onClose={() => setShowConfirmDialog()}
        onConfirm={() => confirmRemoveResource(showConfirmDialog())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title="Remove Playlists"
        message={'Are you sure you want to remove the following playlists?'}
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
        title="Playlists"
        resource="playlists"
        params={props.params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label="Add Playlist"
              onClick={openAddPlaylistModal}
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
            label: 'View',
          },
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default PlaylistsPage;
