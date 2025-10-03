import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  Show,
} from 'solid-js';

import {
  Button,
  IconButton,
  Column,
  TableView,
  TableViewRef,
  TableAction,
  Modal,
  ConfirmDialog,
  FetchDataOptions,
} from '@castmill/ui-common';

import { store, setStore } from '../../store/store';

import { BsCheckLg, BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import { Team } from '../../interfaces/team';
import styles from './teams-page.module.scss';
import { useSearchParams } from '@solidjs/router';
import { TeamsService, TeamUpdate } from '../../services/teams.service';
import { TeamView } from './team-view';
import { useI18n } from '../../i18n';

const TeamsPage: Component = () => {
  const params = useSearchParams();
  const { t } = useI18n();

  const itemsPerPage = 10; // Number of items to show per page

  const [data, setData] = createSignal<Team[]>([], {
    equals: false,
  });

  const [showModal, setShowModal] = createSignal(false);

  const [currentTeam, setCurrentTeam] = createSignal<TeamUpdate>();

  const [selectedTeams, setSelectedTeams] = createSignal(new Set<number>());

  const columns = [
    { key: 'id', title: t('common.id'), sortable: true },
    { key: 'name', title: t('common.name'), sortable: true },
  ] as Column<Team>[];

  interface TeamTableItem extends Team {}

  const actions: TableAction<Team>[] = [
    {
      icon: BsEye,
      handler: (item: TeamTableItem) => {
        setCurrentTeam(item);
        setShowModal(true);
      },
      label: t('common.view'),
    },
    {
      icon: AiOutlineDelete,
      handler: (item: TeamTableItem) => {
        setCurrentTeam(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: FetchDataOptions) => {
    const result = await TeamsService.fetchTeams(
      store.organizations.selectedId!,
      {
        page,
        sortOptions,
        search,
        filters,
      }
    );

    setData(result.data);

    return result;
  };

  onCleanup(() => {});

  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);

  const confirmRemoveTeam = async (team: TeamUpdate | undefined) => {
    if (!team) {
      return;
    }
    try {
      await TeamsService.removeTeam(store.organizations.selectedId!, team.id);
      refreshData();
    } catch (error) {
      alert(t('teams.errors.removeTeam', { name: team.name, error: String(error) }));
    }
    setShowConfirmDialog(false);
  };

  const confirmRemoveMultipleTeams = async () => {
    try {
      await Promise.all(
        Array.from(selectedTeams()).map((teamId) =>
          TeamsService.removeTeam(store.organizations.selectedId!, teamId)
        )
      );

      refreshData();
    } catch (error) {
      alert(t('teams.errors.removeTeams', { error: String(error) }));
    }
    setShowConfirmDialogMultiple(false);
  };

  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedTeams(rowsSelected);
  };

  let tableViewRef: TableViewRef<number, Team>;

  const setRef = (ref: TableViewRef<number, Team>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const updateItem = (itemId: number, item: TeamUpdate) => {
    if (tableViewRef) {
      tableViewRef.updateItem(itemId, item);
    }
  };
  // Function to close the modal and remove blur
  const closeModal = () => {
    setShowModal(false);
  };

  const addTeam = () => {
    setCurrentTeam();
    setShowModal(true);
  };

  const [title, setTitle] = createSignal('');

  createEffect(() => {
    if (currentTeam()?.id) {
      setTitle(t('teams.teamTitle', { name: currentTeam()?.name || '' }));
    } else {
      setTitle(t('teams.newTeam'));
    }
  });

  return (
    <div class={`${styles.teamsPage}`}>
      <Show when={showModal()}>
        <Modal
          title={title()}
          description={t('teams.description')}
          onClose={closeModal}
        >
          <TeamView
            organizationId={store.organizations.selectedId!}
            team={currentTeam() || { name: '' }}
            onSubmit={async (team: TeamUpdate) => {
              try {
                if (!team.id) {
                  const newTeam = await TeamsService.addTeam(
                    store.organizations.selectedId!,
                    team.name!
                  );
                  setCurrentTeam({ id: newTeam.id, name: newTeam.name });
                  refreshData();
                  return newTeam;
                } else {
                  const updatedTeam = await TeamsService.updateTeam(
                    store.organizations.selectedId!,
                    team
                  );
                  updateItem(team.id, team);
                  return updatedTeam;
                }
              } catch (error) {
                alert(t('teams.errors.saveTeam', { error: String(error) }));
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('teams.removeTeam')}
        message={t('teams.confirmRemoveTeam', { name: currentTeam()?.name || '' })}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveTeam(currentTeam())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('teams.removeTeams')}
        message={t('teams.confirmRemoveTeams')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleTeams()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedTeams()).map((deviceId) => {
            const device = data().find((d) => d.id === deviceId);
            return <div>{`- ${device?.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title={t('teams.title')}
        resource="teams"
        params={params}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          filters: [],
          mainAction: (
            <Button
              label={t('teams.addTeam')}
              onClick={addTeam}
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
                disabled={selectedTeams().size === 0}
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
            handler: (item: TeamTableItem) => {
              setCurrentTeam(item);
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

export default TeamsPage;
