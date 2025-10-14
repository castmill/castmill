/**
 * Organizations Members View
 *
 * (c) Castmill 2025
 */

import {
  IconButton,
  Modal,
  TableView,
  FetchDataOptions,
  ConfirmDialog,
  TableViewRef,
  Timestamp,
  HttpError,
  useToast,
} from '@castmill/ui-common';
import { store, setStore } from '../../store/store';
import { PermissionButton } from '../../components/permission-button/permission-button';
import { usePermissions } from '../../hooks/usePermissions';
import { BsCheckLg } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import { createEffect, createSignal, Show } from 'solid-js';
import { User } from '../../interfaces/user.interface';
import { OrganizationsService } from '../../services/organizations.service';
import { OrganizationInviteForm } from './organization-invite-form';
import { OrganizationRole } from '../../types/organization-role.type';
import { useI18n } from '../../i18n';
import { getUser } from '../../components/auth';

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

export const OrganizationMembersView = (props: {
  organizationId: string;
  organizationName: string;
  onRemove: (member: User) => void;
}) => {
  const { t } = useI18n();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const resolveRemoveMemberError = (error: unknown) => {
    if (error instanceof HttpError) {
      switch (error.status) {
        case 422:
          return t('organization.errors.cannotRemoveLastAdmin');
        case 404:
          return t('errors.generic');
        default:
          return error.message;
      }
    }

    const message = (error as Error)?.message ?? t('errors.generic');
    return message === 'cannot_remove_last_organization_admin'
      ? t('organization.errors.cannotRemoveLastAdmin')
      : message;
  };

  const addMember = () => {
    setShowAddMemberDialog(true);
  };

  const currentUser = getUser();

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
    </>
  );
};
