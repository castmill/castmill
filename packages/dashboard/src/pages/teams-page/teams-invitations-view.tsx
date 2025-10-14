/**
 * Team Members View
 *
 * (c) Castmill 2025
 */

import {
  IconButton,
  TableView,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  Timestamp,
  useToast,
} from '@castmill/ui-common';
import { TeamsService } from '../../services/teams.service';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createEffect, createSignal } from 'solid-js';
import { useI18n } from '../../i18n';

interface Invitation {
  id: number;
  email: string;
  status: string;
}

const [data, setData] = createSignal<Invitation[]>([], {
  equals: false,
});

const [currentInvitation, setCurrentInvitation] = createSignal<Invitation>();
const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
  createSignal(false);

const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

const [selectedInvitations, setSelectedInvitations] = createSignal(
  new Set<number>()
);

const onRowSelect = (rowsSelected: Set<number>) => {
  setSelectedInvitations(rowsSelected);
};

const itemsPerPage = 10;

export const TeamInvitationsView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (invitation: Invitation) => void;
  refreshKey?: number;
}) => {
  const { t } = useI18n();

  const columns = [
    { key: 'email', title: t('common.email'), sortable: true },
    { key: 'status', title: t('common.status'), sortable: true },
    {
      key: 'inserted_at',
      title: t('common.insertedAt'),
      sortable: true,
      render: (item: any) => (
        <Timestamp value={item.inserted_at} mode="relative" />
      ),
    },
    {
      key: 'expires_at',
      title: t('common.expiresAt'),
      sortable: true,
      render: (item: any) => (
        <Timestamp value={item.expires_at} mode="relative" />
      ),
    },
  ];

  const actions = [
    {
      icon: AiOutlineDelete,
      handler: (item: any) => {
        setCurrentInvitation(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

  const toast = useToast();

  const fetchData = async (opts: FetchDataOptions) => {
    const result = await TeamsService.fetchInvitations(
      props.organizationId,
      props.teamId,
      opts
    );
    setData(result.data);
    return result;
  };

  let tableViewRef: TableViewRef<number, Invitation>;

  const setRef = (ref: TableViewRef<number, Invitation>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  const confirmRemoveInvitationFromTeam = async (invitation?: Invitation) => {
    if (!invitation) {
      return;
    }

    try {
      await TeamsService.removeInvitationFromTeam(
        props.organizationId,
        props.teamId,
        invitation.id
      );

      refreshData();
      toast.success(
        t('teams.invitationRemovedSuccessfully', { email: invitation.email })
      );
      props.onRemove(invitation);
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const confirmRemoveMultipleMembersFromTeam = async () => {
    try {
      await Promise.all(
        Array.from(selectedInvitations()).map((invitationId) =>
          TeamsService.removeInvitationFromTeam(
            props.organizationId,
            props.teamId,
            invitationId
          )
        )
      );

      refreshData();
      toast.success(t('teams.invitationsRemovedSuccessfully'));
      Array.from(selectedInvitations()).forEach((invitationId) => {
        const invitation = data().find((d) => d.id === invitationId);
        if (invitation) {
          props.onRemove(invitation);
        }
      });
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  createEffect(() => {
    // Trigger refresh when team changes
    props.teamId;
    refreshData();
  });

  createEffect(() => {
    if (props.refreshKey !== undefined) {
      refreshData();
    }
  });

  return (
    <>
      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('teams.removeInvitationFromTeam')}
        message={t('teams.confirmRemoveInvitation', {
          email: currentInvitation()?.email || '',
        })}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveInvitationFromTeam(currentInvitation())}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('teams.removeInvitationsFromTeam')}
        message={t('teams.confirmRemoveInvitations')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleMembersFromTeam()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedInvitations()).map((invitationId) => {
            const invitation = data().find((d) => d.id === invitationId);
            return <div>{`- ${invitation?.email}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title=""
        resource="invitations"
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          actions: (
            <div>
              <IconButton
                onClick={() => setShowConfirmDialogMultiple(true)}
                icon={AiOutlineDelete}
                color="primary"
                disabled={selectedInvitations().size === 0}
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
        itemIdKey="id"
      ></TableView>
    </>
  );
};
