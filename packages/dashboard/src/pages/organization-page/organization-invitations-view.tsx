/**
 * Organization Members View
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
import { AiOutlineDelete } from 'solid-icons/ai';
import { createSignal } from 'solid-js';
import { OrganizationsService } from '../../services/organizations.service';

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

const columns = [
  { key: 'email', title: 'Email', sortable: true },
  { key: 'status', title: 'Status', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  {
    key: 'inserted_at',
    title: 'Inserted At',
    sortable: true,
    render: (item: any) => (
      <Timestamp value={item.inserted_at} mode="relative" />
    ),
  },
  {
    key: 'expires_at',
    title: 'Expires At',
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
    label: 'Remove',
  },
];

export const OrganizationInvitationsView = (props: {
  organizationId: string;
  onRemove: (invitation: Invitation) => void;
}) => {
  const toast = useToast();

  const fetchData = async (opts: FetchDataOptions) => {
    const result = await OrganizationsService.fetchInvitations(
      props.organizationId,
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
      toast.success(`Invitation for ${invitation.email} removed successfully`);
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const confirmRemoveMultipleMembersFromOrganization = async () => {
    try {
      await Promise.all(
        Array.from(selectedInvitations()).map((invitationId) =>
          OrganizationsService.removeInvitationFromOrganization(
            props.organizationId,
            invitationId
          )
        )
      );

      refreshData();
      toast.success('Invitations removed successfully');
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <ConfirmDialog
        show={showConfirmDialog()}
        title={`Remove Invitation From Organization`}
        message={`Are you sure you want to remove the invitation of member "${currentInvitation()?.email}" from the organization?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() =>
          confirmRemoveInvitationFromOrganization(currentInvitation())
        }
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={`Remove members From Organization`}
        message={`Are you sure you want to remove the following members from the organization?`}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleMembersFromOrganization()}
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
        itemIdKey="user_id"
      ></TableView>
    </>
  );
};
