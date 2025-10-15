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
  Dropdown,
  Timestamp,
  useToast,
} from '@castmill/ui-common';
import { TeamsService } from '../../services/teams.service';
import { OrganizationsService } from '../../services/organizations.service';
import { PermissionButton } from '../../components/permission-button/permission-button';
import { usePermissions } from '../../hooks/usePermissions';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createMemo, createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { useI18n } from '../../i18n';
import { getUser } from '../../components/auth';
import styles from './teams-page.module.scss';

interface TeamMemberRow {
  user: User;
  user_id: string;
  role: string;
  inserted_at?: string;
}

const [data, setData] = createSignal<TeamMemberRow[]>([], {
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
const [selectedRole, setSelectedRole] = createSignal<'member' | 'admin'>(
  'member'
);
const [isFormValid, setIsFormValid] = createSignal(false);

const onRowSelect = (rowsSelected: Set<string>) => {
  setSelectedMembers(rowsSelected);
};

const itemsPerPage = 10;

export const TeamMembersView = (props: {
  organizationId: string;
  teamId: number;
  onRemove: (member: User) => void;
  onInvitationSent?: () => void;
}) => {
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const resolveRemoveMemberError = (message: string) => {
    switch (message) {
      case 'cannot_remove_last_team_admin':
        return t('teams.errors.cannotRemoveLastAdmin');
      default:
        return message;
    }
  };
  const currentUser = getUser();
  const currentMembership = createMemo(() => {
    if (!currentUser?.id) {
      return undefined;
    }
    return data().find(
      (entry: TeamMemberRow) => entry.user_id === currentUser.id
    );
  });

  const adminCount = createMemo(
    () => data().filter((entry: TeamMemberRow) => entry.role === 'admin').length
  );

  const canLeaveTeam = createMemo(() => {
    const membership = currentMembership();
    if (!membership) {
      return false;
    }

    if (membership.role !== 'admin') {
      return true;
    }

    return adminCount() > 1;
  });

  const addMember = () => {
    setSelectedUser(undefined);
    setSelectedRole('member');
    setIsFormValid(false);
    setShowAddMemberDialog(true);
  };

  const actions = [
    {
      icon: AiOutlineDelete,
      handler: (item: any) => {
        if (!canPerformAction('teams', 'update')) {
          toast.error(
            t('permissions.noUpdateTeams') ||
              "You don't have permission to update teams"
          );
          return;
        }
        setCurrentMember(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

  const columns = [
    {
      key: 'user.name',
      title: t('common.name'),
      sortable: true,
      render: (item: any) => {
        const isCurrentUser = item.user_id === currentUser?.id;
        return isCurrentUser
          ? `${item.user.name} ${t('common.youIndicator')}`
          : item.user.name;
      },
    },
    { key: 'role', title: t('common.role'), sortable: true },
    {
      key: 'inserted_at',
      title: t('teams.insertedAt'),
      sortable: true,
      render: (item: any) => (
        <Timestamp value={item.inserted_at} mode="relative" />
      ),
    },
  ];

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
        sortOptions: { key: 'name', direction: 'ascending' },
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
      toast.success(t('teams.messages.memberRemoved', { name: member.name }));
      props.onRemove(member);
      setShowConfirmDialog(false);
    } catch (error) {
      const errorMessage = resolveRemoveMemberError((error as Error).message);
      toast.error(errorMessage);
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
      toast.success(t('teams.messages.membersRemoved'));
      Array.from(selectedMembers()).forEach((memberId) => {
        const member = data().find(
          (entry: TeamMemberRow) => entry.user_id === memberId
        );
        if (member) {
          props.onRemove(member.user);
        }
      });
      setShowConfirmDialogMultiple(false);
    } catch (error) {
      const errorMessage = resolveRemoveMemberError((error as Error).message);
      toast.error(errorMessage);
    }
  };

  const leaveTeam = async () => {
    const membership = currentMembership();
    if (!membership) {
      return;
    }

    try {
      await TeamsService.removeMemberFromTeam(
        props.organizationId,
        props.teamId,
        membership.user_id
      );

      refreshData();
      toast.success(
        t('teams.messages.leftTeam', { name: membership.user.name })
      );
      props.onRemove(membership.user);
    } catch (error) {
      const errorMessage = resolveRemoveMemberError((error as Error).message);
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Show when={showAddMemberDialog()}>
        <Modal
          title={t('teams.inviteMember')}
          description={t('teams.inviteMemberDescription')}
          onClose={() => setShowAddMemberDialog(false)}
        >
          {/* Select a user from the organization to invite to the team */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (isFormValid() && selectedUser()) {
                try {
                  await TeamsService.inviteUser(
                    props.organizationId,
                    props.teamId,
                    selectedUser()!.email,
                    selectedRole()
                  );

                  refreshData();
                  toast.success(`Invitation sent to ${selectedUser()!.email}`);
                  props.onInvitationSent?.();
                  setShowAddMemberDialog(false);
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }
            }}
          >
            <ComboBox
              id="user-selector"
              label={t('teams.members.selectUser')}
              placeholder={t('teams.members.searchUser')}
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

            <div style="margin-top: 1em;">
              <Dropdown
                id="team-member-role"
                name="team_role"
                label={t('organizations.role')}
                items={[
                  {
                    value: 'member',
                    name: t('organizations.teamRoleMember'),
                  },
                  { value: 'admin', name: t('organizations.teamRoleAdmin') },
                ]}
                defaultValue={selectedRole()}
                onSelectChange={(value: string | null) => {
                  if (!value) {
                    return;
                  }
                  setSelectedRole(value as 'member' | 'admin');
                }}
              />
            </div>

            <div style="margin-top: 1em;">
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
            const member = data().find(
              (entry: TeamMemberRow) => entry.user_id === memberId
            );
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
            <PermissionButton
              resource="teams"
              action="update"
              label={t('teams.inviteMember')}
              onClick={addMember}
              icon={BsCheckLg}
              color="primary"
            />
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => {
                  if (!canPerformAction('teams', 'update')) {
                    toast.error(
                      t('permissions.noUpdateTeams') ||
                        "You don't have permission to update teams"
                    );
                    return;
                  }
                  setShowConfirmDialogMultiple(true);
                }}
                icon={AiOutlineDelete}
                color="primary"
                disabled={
                  selectedMembers().size === 0 ||
                  !canPerformAction('teams', 'update')
                }
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

      <Show when={currentMembership()}>
        <div class={styles.leaveTeamPanel}>
          <div class={styles.leaveTeamContent}>
            <h4>{t('teams.leaveTeamTitle')}</h4>
            <p>{t('teams.leaveTeamDescription')}</p>
            <Show when={!canLeaveTeam()}>
              <p class={styles.leaveTeamWarning}>
                {t('teams.leaveTeamLastAdminWarning')}
              </p>
            </Show>
          </div>
          <Button
            label={t('teams.leaveTeamAction')}
            color="danger"
            onClick={leaveTeam}
            disabled={!canLeaveTeam()}
          />
        </div>
      </Show>
    </>
  );
};
