/**
 * Organization Invitations View
 *
 * (c) Castmill 2025
 */

import {
  TableView,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  Timestamp,
  HttpError,
  useToast,
  tableCardLabels,
} from '@castmill/ui-common';
import { AiOutlineDelete, AiOutlineSend } from 'solid-icons/ai';
import { invitationCard } from '../../components/entity-cards/invitation-card';
import { createSignal } from 'solid-js';
import { OrganizationsService } from '../../services/organizations.service';
import { useI18n } from '../../i18n';

interface Invitation {
  id: number;
  email: string;
  status: string;
}

const itemsPerPage = 10;

export const OrganizationInvitationsView = (props: {
  organizationId: string;
  onRemove: (invitation: Invitation) => void;
}) => {
  const { t } = useI18n();
  const cardLabels = tableCardLabels(t);
  const toast = useToast();

  const [data, setData] = createSignal<Invitation[]>([], { equals: false });
  const [currentInvitation, setCurrentInvitation] = createSignal<Invitation>();
  const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);
  const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
    createSignal(false);
  const [invitationToResend, setInvitationToResend] =
    createSignal<Invitation>();
  const [resending, setResending] = createSignal(false);
  const [selectedInvitations, setSelectedInvitations] = createSignal(
    new Set<number>()
  );
  const [selectedInvitationDetails, setSelectedInvitationDetails] =
    createSignal(new Map<number, Invitation>());
  let clearSelectedRows: (() => void) | undefined;

  const onRowSelect = (rowsSelected: Set<number>) => {
    setSelectedInvitations(rowsSelected);
    setSelectedInvitationDetails((previous) => {
      const next = new Map(
        [...previous].filter(([id]) => rowsSelected.has(id))
      );
      data().forEach((invitation) => {
        if (rowsSelected.has(invitation.id)) {
          next.set(invitation.id, invitation);
        }
      });
      return next;
    });
  };

  const columns = [
    { key: 'email', title: t('common.email'), sortable: true },
    { key: 'status', title: t('common.status'), sortable: true },
    { key: 'role', title: t('common.role'), sortable: true },
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
      icon: AiOutlineSend,
      handler: (item: Invitation) => setInvitationToResend(item),
      label: t('organization.resendInvitation'),
      hidden: (item: Invitation) => item.status === 'accepted',
    },
    {
      icon: AiOutlineDelete,
      handler: (item: Invitation) => {
        setCurrentInvitation(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

  const fetchData = async (opts: FetchDataOptions) => {
    const result = await OrganizationsService.fetchInvitations(
      props.organizationId,
      opts
    );
    setData(result.data);
    setSelectedInvitationDetails((previous) => {
      const selected = selectedInvitations();
      const next = new Map([...previous].filter(([id]) => selected.has(id)));
      result.data.forEach((invitation: Invitation) => {
        if (selected.has(invitation.id)) {
          next.set(invitation.id, invitation);
        }
      });
      return next;
    });
    return result;
  };

  let tableViewRef: TableViewRef<number, Invitation>;

  const setRef = (ref: TableViewRef<number, Invitation>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      return tableViewRef.reloadData();
    }
  };

  const resendErrorMessage = (error: unknown, email: string) => {
    if (error instanceof HttpError) {
      switch (error.message) {
        case 'already_accepted':
          return t('organization.errors.invitationAlreadyAccepted');
        case 'already_member':
          return t('organization.errors.invitationAlreadyMember', { email });
        case 'already_invited':
          return t('organization.errors.invitationPending', { email });
        case 'invitation_email_not_sent':
          return t('organization.errors.invitationEmailNotSent', { email });
        case 'invitation_busy':
          return t('organization.errors.invitationBusy', { email });
        case 'quota_exceeded':
          return t('organization.errors.membersQuotaExceeded');
      }
    }
    return t('organization.errors.resendInvitationFailed');
  };

  const confirmResendInvitation = async () => {
    const invitation = invitationToResend();
    if (!invitation || resending()) {
      return;
    }

    setResending(true);
    try {
      await OrganizationsService.resendInvitation(
        props.organizationId,
        invitation.id
      );
      toast.success(
        t('organization.messages.invitationResent', {
          email: invitation.email,
        })
      );
      setInvitationToResend(undefined);
      refreshData();
    } catch (error) {
      toast.error(resendErrorMessage(error, invitation.email));
      // The invitation was renewed even though its email was not sent.
      if (
        error instanceof HttpError &&
        error.message === 'invitation_email_not_sent'
      ) {
        setInvitationToResend(undefined);
        refreshData();
      }
    } finally {
      setResending(false);
    }
  };

  const confirmRemoveInvitationFromOrganization = async (
    invitation?: Invitation
  ) => {
    if (!invitation) {
      return;
    }

    try {
      await OrganizationsService.removeInvitationFromOrganization(
        props.organizationId,
        invitation.id
      );

      refreshData();
      clearSelectedRows?.();
      toast.success(
        t('organization.messages.invitationRemoved', {
          email: invitation.email,
        })
      );
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error(t('organization.errors.removeInvitationFailed'));
    }
  };

  const confirmRemoveMultipleInvitationsFromOrganization = async () => {
    const invitationIds = Array.from(selectedInvitations());
    const results = await Promise.allSettled(
      invitationIds.map((invitationId) =>
        OrganizationsService.removeInvitationFromOrganization(
          props.organizationId,
          invitationId
        )
      )
    );
    const succeededCount = results.filter(
      (result) => result.status === 'fulfilled'
    ).length;
    const failedCount = results.length - succeededCount;

    await refreshData();
    if (succeededCount > 0) {
      clearSelectedRows?.();
    }

    if (failedCount === 0) {
      toast.success(t('organization.messages.invitationsRemoved'));
      setShowConfirmDialogMultiple(false);
    } else {
      toast.error(t('organization.errors.removeInvitationFailed'));
      if (succeededCount > 0) {
        setShowConfirmDialogMultiple(false);
      }
    }
  };

  return (
    <>
      <ConfirmDialog
        show={!!invitationToResend()}
        title={t('organization.dialogs.resendInvitationTitle')}
        message={t('organization.dialogs.resendInvitationMessage', {
          email: invitationToResend()?.email ?? '',
        })}
        confirmLabel={t('organization.resend')}
        cancelLabel={t('common.cancel')}
        onClose={() => setInvitationToResend(undefined)}
        onConfirm={confirmResendInvitation}
      />

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('organization.dialogs.removeInvitationTitle')}
        message={t('organization.dialogs.removeInvitationMessage', {
          email: currentInvitation()?.email ?? '',
        })}
        confirmLabel={t('common.remove')}
        cancelLabel={t('common.cancel')}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() =>
          confirmRemoveInvitationFromOrganization(currentInvitation())
        }
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('organization.dialogs.removeInvitationsTitle')}
        message={t('organization.dialogs.removeInvitationsMessage')}
        confirmLabel={t('common.remove')}
        cancelLabel={t('common.cancel')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleInvitationsFromOrganization()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedInvitations()).map((invitationId) => {
            const invitation = selectedInvitationDetails().get(invitationId);
            return <div>{`- ${invitation?.email ?? ''}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title=""
        resource="invitations"
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          searchPlaceholder: t('common.search'),
        }}
        selectionHint={t('common.selectionHint')}
        selectionLabel={t('common.selectionCount')}
        selectionActions={({ clear }) => {
          clearSelectedRows = clear;
          return (
            <button
              class="selection-action-btn danger"
              onClick={() => setShowConfirmDialogMultiple(true)}
            >
              <AiOutlineDelete />
              {t('common.remove')}
            </button>
          );
        }}
        table={{
          columns,
          actions,
          actionsLabel: t('common.actions'),
          onRowSelect,
          cardLayout: true,
          cardLabels,
          card: invitationCard(t),
        }}
        pagination={{ itemsPerPage }}
        itemIdKey="id"
      ></TableView>
    </>
  );
};
