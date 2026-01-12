import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
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
  useToast,
} from '@castmill/ui-common';

import { store } from '../../store/store';
import { PermissionButton } from '../../components/permission-button/permission-button';
import { usePermissions } from '../../hooks/usePermissions';

import { BsCheckLg, BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';

import { Team } from '../../interfaces/team';
import styles from './teams-page.module.scss';
import { useSearchParams } from '@solidjs/router';
import { TeamsService, TeamUpdate } from '../../services/teams.service';
import { TeamView } from './team-view';
import { useI18n } from '../../i18n';
import { QuotaIndicator } from '../../components/quota-indicator';
import { QuotasService, ResourceQuota } from '../../services/quotas.service';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useLocation } from '@solidjs/router';
import { useModalFromUrl } from '../../hooks/useModalFromUrl';

const TeamsPage: Component = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const { registerShortcutAction, unregisterShortcutAction } =
    useKeyboardShortcuts();
  const location = useLocation();

  const toast = useToast();

  const itemsPerPage = 10; // Number of items to show per page

  const [data, setData] = createSignal<Team[]>([], {
    equals: false,
  });

  const [showModal, setShowModal] = createSignal(false);

  const [currentTeam, setCurrentTeam] = createSignal<TeamUpdate>();

  const [selectedTeams, setSelectedTeams] = createSignal(new Set<number>());

  const [quota, setQuota] = createSignal<ResourceQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = createSignal(true);

  const loadQuota = async () => {
    if (!store.organizations.selectedId) return;

    try {
      setQuotaLoading(true);
      const quotaData = await QuotasService.getResourceQuota(
        store.organizations.selectedId,
        'teams'
      );
      setQuota(quotaData);
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    } finally {
      setQuotaLoading(false);
    }
  };

  onMount(() => {
    loadQuota();

    // Register keyboard shortcuts
    registerShortcutAction(
      'generic-create',
      () => {
        if (!isQuotaReached() && canPerformAction('teams', 'create')) {
          addTeam();
        }
      },
      () => location.pathname.includes('/teams')
    );

    registerShortcutAction(
      'generic-search',
      () => {
        if (tableViewRef) {
          tableViewRef.focusSearch();
        }
      },
      () => location.pathname.includes('/teams')
    );

    registerShortcutAction(
      'generic-delete',
      () => {
        if (selectedTeams().size > 0 && canPerformAction('teams', 'delete')) {
          setShowConfirmDialogMultiple(true);
        }
      },
      () => location.pathname.includes('/teams')
    );
  });

  // Reload data when organization changes
  createEffect(() => {
    const orgId = store.organizations.selectedId;
    if (orgId && tableViewRef) {
      tableViewRef.reloadData();
      loadQuota();
    }
  });

  // Sync modal state with URL itemId parameter
  useModalFromUrl({
    getItemIdFromUrl: () => searchParams.itemId,
    isModalOpen: () => showModal(),
    closeModal: () => setShowModal(false),
    openModal: (itemId: string) => {
      const team = data().find((t) => String(t.id) === String(itemId));
      if (team) {
        setCurrentTeam(team);
        setShowModal(true);
      }
    },
  });

  const isQuotaReached = () => {
    const q = quota();
    return q ? q.used >= q.total : false;
  };

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
        if (!canPerformAction('teams', 'delete')) {
          toast.error(
            t('permissions.noDeleteTeams') ||
              "You don't have permission to delete teams"
          );
          return;
        }
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
    if (!store.organizations.selectedId) {
      return { count: 0, data: [] };
    }

    const result = await TeamsService.fetchTeams(
      store.organizations.selectedId,
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

  onCleanup(() => {
    unregisterShortcutAction('generic-create');
    unregisterShortcutAction('generic-search');
    unregisterShortcutAction('generic-delete');
  });

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
      toast.success(`Team ${team.name} removed successfully`);
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(
        t('teams.errors.removeTeam', {
          name: team.name || '',
          error: String(error),
        })
      );
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
      toast.success(t('teams.teamsRemovedSuccessfully'));
      loadQuota(); // Reload quota after deletion
    } catch (error) {
      toast.error(t('teams.errors.removeTeams', { error: String(error) }));
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
    // Only clear URL - let createEffect handle closing the modal
    setSearchParams({ itemId: undefined });
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

                  toast.success(`Team ${newTeam.name} created successfully`);
                  loadQuota(); // Reload quota after creation

                  return newTeam;
                } else {
                  const updatedTeam = await TeamsService.updateTeam(
                    store.organizations.selectedId!,
                    team
                  );
                  updateItem(team.id, team);
                  toast.success(`Team ${team.name} updated successfully`);
                  return updatedTeam;
                }
              } catch (error) {
                toast.error(
                  t('teams.errors.saveTeam', { error: String(error) })
                );
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('teams.removeTeam')}
        message={t('teams.confirmRemoveTeam', {
          name: currentTeam()?.name || '',
        })}
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
        params={[searchParams, setSearchParams]}
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          filters: [],
          mainAction: (
            <div style="display: flex; align-items: center; gap: 1rem;">
              <Show when={quota() && !quotaLoading()}>
                <QuotaIndicator
                  used={quota()!.used}
                  total={quota()!.total}
                  resourceName="Teams"
                  compact
                />
              </Show>
              <PermissionButton
                resource="teams"
                action="create"
                label={t('teams.addTeam')}
                onClick={addTeam}
                icon={BsCheckLg}
                color="primary"
                forceDisabled={isQuotaReached()}
              />
            </div>
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => {
                  if (!canPerformAction('teams', 'delete')) {
                    toast.error(
                      t('permissions.noDeleteTeams') ||
                        "You don't have permission to delete teams"
                    );
                    return;
                  }
                  setShowConfirmDialogMultiple(true);
                }}
                icon={AiOutlineDelete}
                color="primary"
                disabled={
                  selectedTeams().size === 0 ||
                  !canPerformAction('teams', 'delete')
                }
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
              setSearchParams({ itemId: String(item.id) });
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
