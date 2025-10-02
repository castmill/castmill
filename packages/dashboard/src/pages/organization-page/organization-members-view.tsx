/**
 * Organizations Members View
 *
 * (c) Castmill 2025
 */

import {
  Button,
  IconButton,
  Modal,
  TableView,
  FormItem,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  Dropdown,
  Timestamp,
} from '@castmill/ui-common';
import { store, setStore } from '../../store/store';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createEffect, createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInviteForm } from './organization-invite-form';
import { OrganizationRole } from '../../types/organization-role.type';

const [data, setData] = createSignal<{ user: User; user_id: string }[]>([], {
  equals: false,
});

const [currentMember, setCurrentMember] = createSignal<{
  user: User;
  role: string;
}>();
const [showAddMemberDialog, setShowAddMemberDialog] = createSignal(false);
const [showConfirmDialogMultiple, setShowConfirmDialogMultiple] =
  createSignal(false);

const [showConfirmDialog, setShowConfirmDialog] = createSignal(false);

const [selectedMembers, setSelectedMembers] = createSignal(new Set<string>());

const onRowSelect = (rowsSelected: Set<string>) => {
  setSelectedMembers(rowsSelected);
};

const itemsPerPage = 10;

const columns = [
  { key: 'user.name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  { 
    key: 'inserted_at', 
    title: 'Inserted At', 
    sortable: true,
    render: (item: any) => <Timestamp value={item.inserted_at} mode="relative" />
  },
];

const actions = [
  {
    icon: AiOutlineDelete,
    handler: (item: any) => {
      setCurrentMember(item);
      setShowConfirmDialog(true);
    },
    label: 'Remove',
  },
];

const addMember = () => {
  setShowAddMemberDialog(true);
};

export const OrganizationMembersView = (props: {
  organizationId: string;
  organizationName: string;
  onRemove: (member: User) => void;
}) => {
  const fetchData = async (opts: FetchDataOptions) => {
    const result = await OrganizationsService.fetchMembers(
      props.organizationId,
      opts
    );
    setData(result.data);
    return result;
  };

  let tableViewRef: TableViewRef<string, User>;

  const setRef = (ref: TableViewRef<string, User>) => {
    tableViewRef = ref;
  };

  const refreshData = () => {
    if (tableViewRef) {
      tableViewRef.reloadData();
    }
  };

  createEffect(() => {
    refreshData();
  });

  const confirmRemoveMemberFromOrganization = async (member?: User) => {
    if (!member) {
      return;
    }

    try {
      await OrganizationsService.removeMemberFromOrganization(
        props.organizationId,
        member.id
      );

      refreshData();

      setShowConfirmDialog(false);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const confirmRemoveMultipleMembersFromOrganization = async () => {
    try {
      await Promise.all(
        Array.from(selectedMembers()).map((memberId) =>
          OrganizationsService.removeMemberFromOrganization(
            props.organizationId,
            memberId
          )
        )
      );

      refreshData();

      setShowConfirmDialogMultiple(false);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <>
      <Show when={showAddMemberDialog()}>
        <Modal
          title="Invite Member"
          description={`Add a new member to the organization ${props.organizationName}`}
          onClose={() => setShowAddMemberDialog(false)}
        >
          <OrganizationInviteForm
            organizationId={props.organizationId}
            onSubmit={async (email: string, role: OrganizationRole) => {
              try {
                await OrganizationsService.inviteUser(
                  store.organizations.selectedId!,
                  email,
                  role
                );

                refreshData();
                setShowAddMemberDialog(false);
              } catch (error) {
                alert((error as Error).message);
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={`Remove User From Organization`}
        message={`Are you sure you want to remove member "${currentMember()?.user?.name}" from the organization?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() =>
          confirmRemoveMemberFromOrganization(currentMember()?.user)
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
          {Array.from(selectedMembers()).map((memberId) => {
            const member = data().find((d) => d.user_id === memberId);
            return <div>{`- ${member?.user.name}`}</div>;
          })}
        </div>
      </ConfirmDialog>

      <TableView
        title=""
        resource="users"
        fetchData={fetchData}
        ref={setRef}
        toolbar={{
          mainAction: (
            <Button
              label="Invite Member"
              onClick={addMember}
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
                disabled={selectedMembers().size === 0}
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
