import {
  Button,
  IconButton,
  Modal,
  TableView,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  Timestamp,
  HttpError,
  useToast,
  Dropdown,
} from '@castmill/ui-common';
import { store, setStore } from '../../store/store';
import { PermissionButton } from '../../components/permission-button/permission-button';
import { usePermissions } from '../../hooks/usePermissions';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createEffect, createMemo, createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInviteForm } from './organization-invite-form';
import { OrganizationRole } from '../../types/organization-role.type';
import { useI18n } from '../../i18n';
import { getUser } from '../../components/auth';
import { useNavigate } from '@solidjs/router';
import styles from './organization-page.module.scss';

const [data, setData] = createSignal<
  { user: User; user_id: string; role: string }[]
>([], {
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
const [showLeaveWarningDialog, setShowLeaveWarningDialog] = createSignal(false);

const [selectedMembers, setSelectedMembers] = createSignal(new Set<string>());
const [selectedMembersMap, setSelectedMembersMap] = createSignal(
  new Map<string, { user: User; user_id: string }>()
);

const onRowSelect = (rowsSelected: Set<string>) => {
  const previousSelection = selectedMembers();
  setSelectedMembers(rowsSelected);

  // Update the map: remove deselected items, add newly selected items
  const newMap = new Map(selectedMembersMap());

  // Remove deselected members
  previousSelection.forEach((id) => {
    if (!rowsSelected.has(id)) {
      newMap.delete(id);
    }
  });

  // Add newly selected members from current data
  rowsSelected.forEach((memberId) => {
    if (!newMap.has(memberId)) {
      const member = data().find((d) => d.user_id === memberId);
      if (member) {
        newMap.set(memberId, member);
      }
    }
  });

  setSelectedMembersMap(newMap);
};

const itemsPerPage = 10;

export const OrganizationMembersView = (props: {
  organizationId: string;
  organizationName: string;
  onRemove: (member: User) => void;
}) => {
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const navigate = useNavigate();
  const resolveRemoveMemberError = (error: unknown) => {
    if (error instanceof HttpError) {
      switch (error.status) {
        case 422:
          // Check if it's the specific error message for last organization
          if (error.message === 'cannot_remove_user_from_last_organization') {
            return t(
              'organization.errors.cannotRemoveUserFromLastOrganization'
            );
          }
          return t('organization.errors.cannotRemoveLastAdmin');
        case 404:
          return t('errors.generic');
        default:
          return error.message;
      }
    }

    const message = (error as Error)?.message ?? t('errors.generic');
    if (message === 'cannot_remove_last_organization_admin') {
      return t('organization.errors.cannotRemoveLastAdmin');
    }
    if (message === 'cannot_remove_user_from_last_organization') {
      return t('organization.errors.cannotRemoveUserFromLastOrganization');
    }
    return message;
  };

  const addMember = () => {
    setShowAddMemberDialog(true);
  };

  const currentUser = getUser();

  const roleItems = [
    { name: t('organization.roleAdmin'), value: 'admin' },
    { name: t('organization.roleManager'), value: 'manager' },
    { name: t('organization.roleEditor'), value: 'editor' },
    { name: t('organization.rolePublisher'), value: 'publisher' },
    { name: t('organization.roleDeviceManager'), value: 'device_manager' },
    { name: t('organization.roleMember'), value: 'member' },
    { name: t('organization.roleGuest'), value: 'guest' },
  ];

  const handleRoleChange = async (
    memberId: string,
    memberName: string,
    newRole: string | null
  ) => {
    if (!newRole) return;

    if (!canPerformAction('organizations', 'update')) {
      toast.error(
        t('permissions.noUpdateOrganizations') ||
          "You don't have permission to update member roles"
      );
      return;
    }

    try {
      await OrganizationsService.updateMemberRole(
        props.organizationId,
        memberId,
        newRole as OrganizationRole
      );

      refreshData();
      toast.success(
        t('organization.messages.roleUpdated', { name: memberName })
      );
    } catch (error) {
      const errorMessage =
        error instanceof HttpError
          ? error.message
          : t('organization.errors.updateRoleFailed');
      toast.error(errorMessage);
    }
  };

  const currentMembership = createMemo(() => {
    if (!currentUser?.id) {
      return undefined;
    }
    return data().find((entry) => entry.user_id === currentUser.id);
  });

  const adminCount = createMemo(
    () => data().filter((entry) => entry.role === 'admin').length
  );

  const canLeaveOrganization = createMemo(() => {
    const membership = currentMembership();
    if (!membership) {
      return false;
    }

    // Non-admins can always leave (assuming there's at least one admin)
    if (membership.role !== 'admin') {
      return true;
    }

    // Admins can leave only if there's another admin
    return adminCount() > 1;
  });

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
    {
      key: 'role',
      title: t('common.role'),
      sortable: true,
      render: (item: any) => {
        const isCurrentUser = item.user_id === currentUser?.id;
        const canUpdate = canPerformAction('organizations', 'update');

        // Disable role change for current user or if no permission
        if (isCurrentUser || !canUpdate) {
          const roleLabel =
            roleItems.find((r) => r.value === item.role)?.name || item.role;
          return <span>{roleLabel}</span>;
        }

        return (
          <Dropdown
            label=""
            variant="inline"
            items={roleItems}
            value={item.role}
            id={`member-role-${item.user_id}`}
            name="member_role"
            onSelectChange={(value: string | null) =>
              handleRoleChange(item.user_id, item.user.name, value)
            }
          />
        );
      },
    },
    {
      key: 'inserted_at',
      title: t('common.insertedAt'),
      sortable: true,
      render: (item: any) => (
        <Timestamp value={item.inserted_at} mode="relative" />
      ),
    },
  ];

  const actions = [
    {
      icon: AiOutlineDelete,
      handler: (item: any) => {
        if (!canPerformAction('organizations', 'delete')) {
          toast.error(
            t('permissions.noDeleteOrganizations') ||
              "You don't have permission to remove organization members"
          );
          return;
        }
        setCurrentMember(item);
        setShowConfirmDialog(true);
      },
      label: t('common.remove'),
    },
  ];

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
      toast.success(
        t('organization.messages.memberRemoved', { name: member.name })
      );
      setShowConfirmDialog(false);
    } catch (error) {
      const errorMessage = resolveRemoveMemberError(error);
      toast.error(errorMessage);
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
      toast.success(t('organization.messages.membersRemoved'));
      setShowConfirmDialogMultiple(false);
      setSelectedMembersMap(new Map());
    } catch (error) {
      const errorMessage = resolveRemoveMemberError(error);
      toast.error(errorMessage);
    }
  };

  const handleLeaveOrganizationClick = () => {
    // Check if this is the user's last organization
    const totalOrganizations = store.organizations.data.length;

    if (totalOrganizations <= 1) {
      // Show warning dialog - this will effectively delete the account
      setShowLeaveWarningDialog(true);
    } else {
      // Safe to leave - user has other organizations
      leaveOrganization();
    }
  };

  const leaveOrganization = async () => {
    const membership = currentMembership();
    if (!membership) {
      return;
    }

    try {
      await OrganizationsService.removeMemberFromOrganization(
        props.organizationId,
        membership.user_id
      );

      toast.success(
        t('organization.messages.leftOrganization', {
          name: props.organizationName,
        })
      );

      // Reload organizations to get updated list
      const user = getUser();
      if (!user?.id) {
        // Shouldn't happen, but handle gracefully
        navigate('/login', { replace: true });
        return;
      }

      const updatedOrganizations = await OrganizationsService.getAll(user.id);

      // Update store with new organizations list
      setStore('organizations', {
        data: updatedOrganizations,
        loaded: true,
        loading: false,
        selectedId: null,
        selectedName: '',
      });

      // Navigate to another organization or login page
      if (updatedOrganizations.length > 0) {
        // Navigate to the first available organization
        const nextOrg = updatedOrganizations[0];
        navigate(`/org/${nextOrg.id}`, { replace: true });
      } else {
        // User has no organizations left - redirect to login with message
        toast.info(t('organization.messages.noOrganizationsRemaining'));
        navigate('/login', { replace: true });
      }
    } catch (error) {
      const errorMessage = resolveRemoveMemberError(error);
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <Show when={showAddMemberDialog()}>
        <Modal
          title={t('organization.inviteMember')}
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
                toast.success(
                  t('organization.messages.invitationSent', { email })
                );
                setShowAddMemberDialog(false);
              } catch (error) {
                if (error instanceof HttpError) {
                  const normalizedMessage =
                    error.message === 'role: is invalid'
                      ? t('organization.errors.invalidRole')
                      : error.message;

                  toast.error(normalizedMessage);
                  return;
                }

                toast.error((error as Error).message);
              }
            }}
          />
        </Modal>
      </Show>

      <ConfirmDialog
        show={showConfirmDialog()}
        title={t('organization.dialogs.removeMemberTitle')}
        message={t('organization.dialogs.removeMemberMessage', {
          name: currentMember()?.user?.name,
        })}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={() =>
          confirmRemoveMemberFromOrganization(currentMember()?.user)
        }
      />

      <ConfirmDialog
        show={showConfirmDialogMultiple()}
        title={t('organization.dialogs.removeMembersTitle')}
        message={t('organization.dialogs.removeMembersMessage')}
        onClose={() => setShowConfirmDialogMultiple(false)}
        onConfirm={() => confirmRemoveMultipleMembersFromOrganization()}
      >
        <div style="margin: 1.5em; line-height: 1.5em;">
          {Array.from(selectedMembersMap().values()).map((member) => {
            return <div>{`- ${member.user.name}`}</div>;
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
            <PermissionButton
              resource="organizations"
              action="create"
              label={t('organization.inviteMember')}
              onClick={addMember}
              icon={BsCheckLg}
              color="primary"
            />
          ),
          actions: (
            <div>
              <IconButton
                onClick={() => {
                  if (!canPerformAction('organizations', 'delete')) {
                    toast.error(
                      t('permissions.noDeleteOrganizations') ||
                        "You don't have permission to remove organization members"
                    );
                    return;
                  }
                  setShowConfirmDialogMultiple(true);
                }}
                icon={AiOutlineDelete}
                color="primary"
                disabled={
                  selectedMembers().size === 0 ||
                  !canPerformAction('organizations', 'delete')
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
        <div class={styles.leaveOrganizationPanel}>
          <div class={styles.leaveOrganizationContent}>
            <h4>{t('organization.leaveOrganizationTitle')}</h4>
            <p>{t('organization.leaveOrganizationDescription')}</p>
            <Show when={!canLeaveOrganization()}>
              <p class={styles.leaveOrganizationWarning}>
                {t('organization.leaveOrganizationLastAdminWarning')}
              </p>
            </Show>
          </div>
          <Button
            label={t('organization.leaveOrganizationAction')}
            color="danger"
            onClick={handleLeaveOrganizationClick}
            disabled={!canLeaveOrganization()}
          />
        </div>
      </Show>

      <ConfirmDialog
        show={showLeaveWarningDialog()}
        title={t('organization.leaveLastOrganizationWarningTitle')}
        message={t('organization.leaveLastOrganizationWarningMessage')}
        onClose={() => setShowLeaveWarningDialog(false)}
        onConfirm={() => {
          setShowLeaveWarningDialog(false);
          leaveOrganization();
        }}
      />
    </>
  );
};
