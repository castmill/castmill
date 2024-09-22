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
  SortOptions,
  TableView,
  TableViewRef,
} from '@castmill/ui-common';
import { JsonPlaylist } from '@castmill/player';
import { PlaylistsService } from '../services/playlists.service';

import './playlists.scss';
import { PlaylistView } from './playlist-view';
import { AddonStore } from '../../common/interfaces/addon-store';

const PlaylistsPage: Component<{
  store: AddonStore;
  params: any; //typeof useSearchParams;
}> = (props) => {
  const [currentPlaylist, setCurrentPlaylist] = createSignal<JsonPlaylist>();
  const [showModal, setShowModal] = createSignal(false);

  const [showAddPlaylistModal, setShowAddPlaylistModal] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);
  const [selectedPlaylists, setSelectedPlaylists] = createSignal(
    new Set<string>()
  );

  const onRowSelect = (rowsSelected: Set<string>) => {
    setSelectedPlaylists(rowsSelected);
  };

  const itemsPerPage = 10; // Number of items to show per page

  let tableViewRef: TableViewRef<JsonPlaylist>;

  const setRef = (ref: TableViewRef<JsonPlaylist>) => {
    tableViewRef = ref;
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
    { key: 'inserted_at', title: 'Created', sortable: true },
    { key: 'updated_at', title: 'Updated', sortable: true },
  ] as Column<JsonPlaylist>[];

  const actions = [
    {
      icon: BsEye,
      handler: openModal,
      label: 'View',
    },
    {
      icon: AiOutlineDelete,
      handler: (item: JsonPlaylist) => {
        setCurrentPlaylist(item);
      },
      label: 'Remove',
    },
  ] as TableAction<JsonPlaylist>[];

  return (
    <div class="playlists-page">
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
        }}
        pagination={{ itemsPerPage }}
      ></TableView>
    </div>
  );
};

export default PlaylistsPage;
