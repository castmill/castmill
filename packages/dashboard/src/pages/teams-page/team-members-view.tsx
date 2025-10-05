/**
 * Team Members View
 *
 * (c) Castmill 2025
 */

import {
  Button,
  IconButton,
  Modal,
  TableView,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  ComboBox,
  useToast,
} from '@castmill/ui-common';
import { TeamsService } from '../../services/teams.service';
import { OrganizationsService } from '../../services/organizations.service';
import { store, setStore } from '../../store/store';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';

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

const [selectedUser, setSelectedUser] = createSignal<User | undefined>(
  undefined
);
const [isFormValid, setIsFormValid] = createSignal(false);

const onRowSelect = (rowsSelected: Set<string>) => {
  setSelectedMembers(rowsSelected);
};

const itemsPerPage = 10;

const columns = [
  { key: 'user.name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role', sortable: true },
  { key: 'inserted_at', title: 'Inserted At', sortable: true },
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
  setSelectedUser(undefined);
  setIsFormValid(false);
  setShowAddMemberDialog(true);
};

export const TeamMembersView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
}) => {
  const toast = useToast();

  const fetchData = async (opts: FetchDataOptions) => {
    const result = await TeamsService.fetchMembers(
      props.organizationId,
      props.teamId,
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

  // Fetch organization users for the combobox
  const fetchUsers = async (
    page: number,
    pageSize: number,
    searchQuery: string
  ) => {
    const result = await OrganizationsService.fetchMembers(
      props.organizationId,
      {
        page: { num: page, size: pageSize },
        sortOptions: {},
        search: searchQuery,
      }
    );

    return {
      count: result.count,
      data: result.data.map((member: any) => member.user),
    };
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setIsFormValid(true);
  };

  const confirmRemoveMemberFromTeam = async (member?: User) => {
    if (!member) {
      return;
    }

    try {
      await TeamsService.removeMemberFromTeam(
        props.organizationId,
        props.teamId,
        member.id
      );

      refreshData();
      toast.success(`Member ${member.name} removed successfully`);
      setShowConfirmDialog(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const confirmRemoveMultipleMembersFromTeam = async () => {
    try {
      await Promise.all(
        Array.from(selectedMembers()).map((memberId) =>
          TeamsService.removeMemberFromTeam(
            props.organizationId,
            props.teamId,
            memberId
          )
        )
      );

      refreshData();
      toast.success('Members removed successfully');
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <Show when={showAddMemberDialog()}>
        <Modal
          title="Invite Member"
          description="Add a new member to the team"
          onClose={() => setShowAddMemberDialog(false)}
        >
          {/* Select a user from the organization to invite to the team */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isFormValid() && selectedUser()) {
                try {
                  await TeamsService.inviteUser(
                    store.organizations.selectedId!,
                    props.teamId,
                    selectedUser()!.email
                  );

                  refreshData();
                  toast.success(`Invitation sent to ${email()}`);
                  setShowAddMemberDialog(false);
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }
            }}
          >
            <ComboBox
              id="user-selector"
              label="Select User"
              placeholder="Search for a user..."
              value={selectedUser()}
              fetchItems={fetchUsers}
              renderItem={(user: User) => (
                <div>
                  <div style="font-weight: 500;">{user.name}</div>
                  <div style="font-size: 0.875rem; color: #666;">
                    {user.email}
                  </div>
                </div>
              )}
              onSelect={handleUserSelect}
            />
            <div class="form-input"></div>
            <div class="form-actions">
              <Button
                label="Invite"
                type="submit"
                disabled={!isFormValid()}
                color="primary"
              />
            </div>
          </form>
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={`Remove User From Team`}
        message={`Are you sure you want to remove member "${currentMember()?.user?.name}" from the team?`}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() => confirmRemoveMemberFromTeam(currentMember()?.user)}
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={`Remove members From Team`}
        message={`Are you sure you want to remove the following members from the team?`}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleMembersFromTeam()}
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
        resource="teams"
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
