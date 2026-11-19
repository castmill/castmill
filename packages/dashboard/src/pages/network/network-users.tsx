/**
 * Network Users & Invitations page — invite, list, block/unblock, delete users;
 * list and delete pending invitations.
 */
import { Component, Show, createSignal, onMount, onCleanup } from 'solid-js';
import {
  Button,
  FormItem,
  useToast,
  ConfirmDialog,
  Modal,
  ComboBox,
  Dropdown,
  Table,
  type Column,
  type TableAction,
  type TableCardContent,
  tableCardLabels,
  EntityCardIcon,
} from '@castmill/ui-common';
import {
  NetworkService,
  Organization,
  NetworkUser,
  NetworkInvitation,
} from '../../services/network.service';
import { useI18n } from '../../i18n';
import {
  BsPlusLg,
  BsTrash,
  BsSlashCircle,
  BsUnlock,
  BsShieldPlus,
  BsShieldMinus,
} from 'solid-icons/bs';
import { getUser } from '../../components/auth';
import { IoPersonOutline } from 'solid-icons/io';
import { useNetworkContext } from './network-context';
import { invitationCard as pendingInvitationCard } from '../../components/entity-cards/invitation-card';
import styles from './network.module.scss';
import { networkEntityCardParts } from '../../components/entity-cards/network-entity-card';

const NetworkUsers: Component = () => {
  const { t } = useI18n();
  const toast = useToast();
  const cardLabels = tableCardLabels(t);
  const { stats, setStats } = useNetworkContext();
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Users state
  const [users, setUsers] = createSignal<NetworkUser[]>([]);
  const [loadingUsers, setLoadingUsers] = createSignal(true);
  const [usersPage, setUsersPage] = createSignal(1);
  const [usersTotalPages, setUsersTotalPages] = createSignal(1);
  const [usersTotalCount, setUsersTotalCount] = createSignal(0);
  const [usersSearch, setUsersSearch] = createSignal('');
  const PAGE_SIZE = 20;

  // User actions
  const [userToBlock, setUserToBlock] = createSignal<NetworkUser | null>(null);
  const [userToUnblock, setUserToUnblock] = createSignal<NetworkUser | null>(
    null
  );
  const [userToDelete, setUserToDelete] = createSignal<NetworkUser | null>(
    null
  );
  const [blockingUser, setBlockingUser] = createSignal(false);
  const [blockUserReason, setBlockUserReason] = createSignal('');
  const [userToPromote, setUserToPromote] = createSignal<NetworkUser | null>(
    null
  );
  const [userToDemote, setUserToDemote] = createSignal<NetworkUser | null>(
    null
  );

  // Network admins and yourself cannot be blocked or deleted, and you cannot
  // remove your own admin role, so a network always keeps an admin.
  const isSelf = (user: NetworkUser) => user.id === getUser()?.id;
  const isNetworkAdmin = (user: NetworkUser) => user.role === 'admin';

  // Invitations state
  const [invitations, setInvitations] = createSignal<NetworkInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = createSignal(true);
  const [invitationToDelete, setInvitationToDelete] =
    createSignal<NetworkInvitation | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal('');
  const [selectedInviteOrg, setSelectedInviteOrg] = createSignal<
    Organization | undefined
  >(undefined);
  const [inviteRole, setInviteRole] = createSignal<'admin' | 'member'>('admin');
  const [inviting, setInviting] = createSignal(false);
  const [inviteError, setInviteError] = createSignal<string | null>(null);

  const isValidEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  onMount(async () => {
    await Promise.all([loadUsers(), loadInvitations()]);
  });

  onCleanup(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
  });

  const loadUsers = async (page?: number, search?: string) => {
    setLoadingUsers(true);
    try {
      const currentPage = page ?? usersPage();
      const currentSearch = search ?? usersSearch();
      const result = await NetworkService.listUsers({
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: currentSearch || undefined,
      });
      setUsers(result.data);
      setUsersPage(result.pagination.page);
      setUsersTotalPages(result.pagination.total_pages);
      setUsersTotalCount(result.pagination.total_count);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error(t('network.users.loadError'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadInvitations = async () => {
    setLoadingInvitations(true);
    try {
      const data = await NetworkService.listInvitations();
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
      toast.error(t('network.invitations.loadError'));
    } finally {
      setLoadingInvitations(false);
    }
  };

  // User actions
  const changeNetworkRole = async (
    user: NetworkUser,
    role: 'admin' | 'member'
  ) => {
    const promoting = role === 'admin';
    try {
      if (promoting) {
        await NetworkService.makeNetworkAdmin(user.id);
      } else {
        await NetworkService.removeNetworkAdmin(user.id);
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
      toast.success(
        t(
          promoting
            ? 'network.users.makeAdminSuccess'
            : 'network.users.removeAdminSuccess',
          { name: user.name }
        )
      );
    } catch (err) {
      console.error('Failed to change network role:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              promoting
                ? 'network.users.makeAdminError'
                : 'network.users.removeAdminError'
            )
      );
    } finally {
      setUserToPromote(null);
      setUserToDemote(null);
    }
  };

  const handleBlockUser = async () => {
    const user = userToBlock();
    if (!user) return;

    setBlockingUser(true);
    try {
      const result = await NetworkService.blockUser(user.id, blockUserReason());
      setUsers((currentUsers) =>
        currentUsers.map((u) =>
          u.id === user.id
            ? {
                ...u,
                blocked_at: result.user.blocked_at,
                blocked_reason: result.user.blocked_reason,
              }
            : u
        )
      );
      toast.success(t('network.users.blockSuccess'));
    } catch (err) {
      console.error('Failed to block user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.blockError')
      );
    } finally {
      setBlockingUser(false);
      setUserToBlock(null);
      setBlockUserReason('');
    }
  };

  const handleUnblockUser = async () => {
    const user = userToUnblock();
    if (!user) return;

    setBlockingUser(true);
    try {
      const result = await NetworkService.unblockUser(user.id);
      setUsers((currentUsers) =>
        currentUsers.map((u) =>
          u.id === user.id
            ? {
                ...u,
                blocked_at: result.user.blocked_at,
                blocked_reason: result.user.blocked_reason,
              }
            : u
        )
      );
      toast.success(t('network.users.unblockSuccess'));
    } catch (err) {
      console.error('Failed to unblock user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.unblockError')
      );
    } finally {
      setBlockingUser(false);
      setUserToUnblock(null);
    }
  };

  const handleDeleteUser = async () => {
    const user = userToDelete();
    if (!user) return;

    try {
      await NetworkService.deleteUser(user.id);
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          users_count: Math.max(0, currentStats.users_count - 1),
        });
      }
      setUsers((currentUsers) => currentUsers.filter((u) => u.id !== user.id));
      toast.success(t('network.users.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error(
        err instanceof Error ? err.message : t('network.users.deleteError')
      );
    } finally {
      setUserToDelete(null);
    }
  };

  // Invite
  const handleInviteUser = async () => {
    const org = selectedInviteOrg();
    if (!inviteEmail().trim() || !org) {
      setInviteError(t('network.users.inviteEmailRequired'));
      return;
    }

    if (!isValidEmail(inviteEmail())) {
      setInviteError(t('network.users.inviteEmailInvalid'));
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      await NetworkService.inviteUserToOrganization(
        org.id,
        inviteEmail(),
        inviteRole()
      );
      toast.success(t('network.users.inviteSuccess'));
      setInviteEmail('');
      setSelectedInviteOrg(undefined);
      setInviteRole('admin');
      setShowInviteModal(false);
      // Reload invitations to show the new one
      await loadInvitations();
    } catch (err) {
      console.error('Failed to invite user:', err);
      const errorMessage =
        err instanceof Error ? err.message : t('network.users.inviteError');
      setInviteError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  const fetchOrganizationsForInvite = async (
    page: number,
    pageSize: number,
    searchQuery: string
  ): Promise<{ count: number; data: Organization[] }> => {
    try {
      const result = await NetworkService.listOrganizations({
        page,
        pageSize,
        search: searchQuery,
      });
      return {
        count: result.pagination.total_count,
        data: result.data,
      };
    } catch (error) {
      console.error('Failed to fetch organizations for invite:', error);
      return { count: 0, data: [] };
    }
  };

  // Delete invitation
  const handleDeleteInvitation = async () => {
    const invitation = invitationToDelete();
    if (!invitation) return;

    try {
      await NetworkService.deleteInvitation(invitation.id);
      toast.success(t('network.invitations.deleteSuccess'));
      setInvitationToDelete(null);
      await loadInvitations();
    } catch (err) {
      console.error('Failed to delete invitation:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.invitations.deleteError')
      );
    }
  };

  // Compact mobile card: email, blocked status · created
  const userCard = (user: NetworkUser): TableCardContent => {
    const network = networkEntityCardParts(t, user);
    return {
      visual: <EntityCardIcon icon={IoPersonOutline} />,
      title: user.name || user.email,
      titleText: user.name || user.email,
      subtitle: user.name ? user.email : undefined,
      meta: [
        isNetworkAdmin(user)
          ? t('network.users.networkAdmin')
          : t('network.users.networkMember'),
        ...network.meta,
      ],
      footer: network.footer,
    };
  };

  // Compact mobile card: organization, role · status · expiry
  const invitationCard = (invitation: NetworkInvitation): TableCardContent => ({
    ...pendingInvitationCard(t)(invitation),
    subtitle: invitation.organization_name,
  });

  const userColumns = (): Column<string, NetworkUser>[] => [
    { key: 'name', title: () => t('network.users.name') },
    { key: 'email', title: () => t('network.users.email') },
    {
      key: 'role',
      title: () => t('network.users.networkRole'),
      render: (user) => (
        <Show
          when={isNetworkAdmin(user)}
          fallback={
            <span class={styles['role-member']}>
              {t('network.users.networkMember')}
            </span>
          }
        >
          <span class={styles['role-admin']}>
            {t('network.users.networkAdmin')}
          </span>
        </Show>
      ),
    },
    {
      key: 'blocked_at',
      title: () => t('common.status'),
      render: (user) => (
        <Show
          when={user.blocked_at}
          fallback={
            <span class={styles['status-active']}>
              {t('network.status.active')}
            </span>
          }
        >
          <span
            class={styles['status-blocked']}
            title={user.blocked_reason || ''}
          >
            {t('network.status.blocked')}
          </span>
        </Show>
      ),
    },
    {
      key: 'inserted_at',
      title: () => t('common.created'),
      render: (user) => new Date(user.inserted_at).toLocaleDateString(),
    },
  ];

  const userActions = (): TableAction<NetworkUser>[] => [
    {
      icon: BsShieldPlus,
      label: () => t('network.users.makeAdmin'),
      hidden: (user) =>
        isNetworkAdmin(user) || !!user.blocked_at || isSelf(user),
      handler: (user) => setUserToPromote(user),
    },
    {
      icon: BsShieldMinus,
      label: () => t('network.users.removeAdmin'),
      hidden: (user) => !isNetworkAdmin(user) || isSelf(user),
      handler: (user) => setUserToDemote(user),
    },
    {
      icon: BsSlashCircle,
      label: () => t('network.users.block'),
      hidden: (user) =>
        !!user.blocked_at || isNetworkAdmin(user) || isSelf(user),
      handler: (user) => setUserToBlock(user),
    },
    {
      icon: BsUnlock,
      label: () => t('network.users.unblock'),
      hidden: (user) => !user.blocked_at || isSelf(user),
      handler: (user) => setUserToUnblock(user),
    },
    {
      icon: BsTrash,
      label: () => t('common.delete'),
      hidden: (user) => isNetworkAdmin(user) || isSelf(user),
      handler: (user) => setUserToDelete(user),
    },
  ];

  const invitationColumns = (): Column<string, NetworkInvitation>[] => [
    { key: 'email', title: () => t('common.email') },
    {
      key: 'organization_name',
      title: () => t('network.invitations.organizationName'),
    },
    { key: 'role', title: () => t('network.users.roleLabel') },
    {
      key: 'status',
      title: () => t('common.status'),
      render: (invitation) => (
        <span class={styles['status-pending']}>{invitation.status}</span>
      ),
    },
    {
      key: 'inserted_at',
      title: () => t('common.created'),
      render: (invitation) =>
        new Date(invitation.inserted_at).toLocaleDateString(),
    },
    {
      key: 'expires_at',
      title: () => t('network.invitations.expires'),
      render: (invitation) =>
        new Date(invitation.expires_at).toLocaleDateString(),
    },
  ];

  const invitationActions = (): TableAction<NetworkInvitation>[] => [
    {
      icon: BsTrash,
      label: () => t('common.delete'),
      handler: (invitation) => setInvitationToDelete(invitation),
    },
  ];

  return (
    <div class={styles['network-page']}>
      {/* Header */}
      <div class={styles['page-header']}>
        <h1>{t('sidebar.networkUsers')}</h1>
      </div>

      {/* Invite User Section */}
      <div class={styles['invite-section']}>
        <h3>{t('network.users.inviteTitle')}</h3>
        <p>{t('network.users.inviteDescription')}</p>
        <Button
          label={t('network.users.inviteButton')}
          onClick={() => setShowInviteModal(true)}
          icon={BsPlusLg}
          color="primary"
        />
      </div>

      {/* Users List */}
      <div class={styles['users-list']}>
        <h3>
          {t('network.users.listTitle')}
          <Show when={usersTotalCount() > 0}>
            <span
              style={{
                'font-weight': 'normal',
                'font-size': '0.85em',
                'margin-left': '0.5em',
                color: 'var(--cm-text-secondary)',
              }}
            >
              ({usersTotalCount()})
            </span>
          </Show>
        </h3>

        {/* Search */}
        <div style={{ 'margin-bottom': '1em' }}>
          <FormItem
            label={t('network.users.searchPlaceholder')}
            id="users-search"
            value={usersSearch()}
            placeholder={t('network.users.searchPlaceholder')}
            type="text"
            onInput={(value) => {
              const val = String(value);
              setUsersSearch(val);
              if (searchTimeout) clearTimeout(searchTimeout);
              searchTimeout = setTimeout(() => {
                setUsersPage(1);
                loadUsers(1, val);
              }, 300);
            }}
          />
        </div>

        <Show when={loadingUsers()}>
          <div class={styles['empty-list']}>{t('common.loading')}</div>
        </Show>

        <Show when={!loadingUsers()}>
          <Show
            when={users().length > 0}
            fallback={
              <div class={styles['empty-list']}>
                {t('network.users.noUsers')}
              </div>
            }
          >
            <Table<string, NetworkUser>
              cardLayout
              cardLabels={cardLabels}
              hideCheckboxes
              card={userCard}
              columns={userColumns}
              data={users()}
              actions={userActions}
              actionsLabel={() => t('common.actions')}
            />

            {/* Pagination */}
            <Show when={usersTotalPages() > 1}>
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'center',
                  'align-items': 'center',
                  gap: '1em',
                  'margin-top': '1em',
                }}
              >
                <Button
                  label={t('common.previous')}
                  onClick={() => {
                    const prev = Math.max(1, usersPage() - 1);
                    setUsersPage(prev);
                    loadUsers(prev);
                  }}
                  disabled={usersPage() <= 1}
                />
                <span>
                  {usersPage()} / {usersTotalPages()}
                </span>
                <Button
                  label={t('common.next')}
                  onClick={() => {
                    const next = Math.min(usersTotalPages(), usersPage() + 1);
                    setUsersPage(next);
                    loadUsers(next);
                  }}
                  disabled={usersPage() >= usersTotalPages()}
                />
              </div>
            </Show>
          </Show>
        </Show>
      </div>

      {/* Invitations Section */}
      <div style={{ 'margin-top': '2em' }}>
        <div class={styles['invitations-header']}>
          <h3>{t('network.invitations.title')}</h3>
          <p>{t('network.invitations.description')}</p>
        </div>

        <div class={styles['invitations-list']}>
          <Show when={loadingInvitations()}>
            <div class={styles['loading-invitations']}>
              {t('common.loading')}
            </div>
          </Show>

          <Show when={!loadingInvitations()}>
            <Show
              when={invitations().length > 0}
              fallback={
                <div class={styles['empty-list']}>
                  {t('network.invitations.noInvitations')}
                </div>
              }
            >
              <Table<string, NetworkInvitation>
                cardLayout
                cardLabels={cardLabels}
                hideCheckboxes
                card={invitationCard}
                columns={invitationColumns}
                data={invitations()}
                actions={invitationActions}
                actionsLabel={() => t('common.actions')}
              />
            </Show>
          </Show>
        </div>
      </div>

      {/* Invite Modal */}
      <Show when={showInviteModal()}>
        <Modal
          title={t('network.users.inviteModalTitle')}
          description={t('network.users.inviteDescription')}
          onClose={() => {
            setShowInviteModal(false);
            setInviteEmail('');
            setSelectedInviteOrg(undefined);
            setInviteRole('admin');
            setInviteError(null);
          }}
        >
          <div class={styles['invite-form']}>
            <ComboBox<Organization>
              closeLabel={t('common.close')}
              id="invite-org-selector"
              label={t('network.users.selectOrganization')}
              placeholder={t('network.users.selectOrganizationPlaceholder')}
              value={selectedInviteOrg()}
              fetchItems={fetchOrganizationsForInvite}
              renderItem={(org: Organization) => (
                <div class={styles['org-combobox-item']}>
                  <div class={styles['org-name']}>{org.name}</div>
                </div>
              )}
              onSelect={(org: Organization) => setSelectedInviteOrg(org)}
              clearable={true}
              clearLabel={t('common.clear')}
              onClear={() => setSelectedInviteOrg(undefined)}
            />

            <FormItem
              label={t('network.users.inviteEmailLabel')}
              id="invite-email"
              value={inviteEmail()}
              placeholder={t('network.users.inviteEmailPlaceholder')}
              type="email"
              onInput={(value) => setInviteEmail(String(value))}
            />

            <Dropdown
              id="invite-role"
              name="role"
              label={t('network.users.roleLabel')}
              items={[
                {
                  name: t('network.users.roleAdmin'),
                  value: 'admin',
                },
                {
                  name: t('network.users.roleMember'),
                  value: 'member',
                },
              ]}
              defaultValue={inviteRole()}
              onSelectChange={(value: string | null) => {
                if (value) {
                  setInviteRole(value as 'admin' | 'member');
                }
              }}
            />

            <Show when={inviteError()}>
              <div class={styles['error-message']}>{inviteError()}</div>
            </Show>

            <div class={styles['modal-actions']} data-modal-actions>
              <Button
                label={
                  inviting()
                    ? t('common.sending')
                    : t('network.users.sendInvite')
                }
                onClick={handleInviteUser}
                disabled={
                  inviting() || !inviteEmail().trim() || !selectedInviteOrg()
                }
                color="primary"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setSelectedInviteOrg(undefined);
                  setInviteRole('admin');
                  setInviteError(null);
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Block User Modal */}
      <Show when={userToBlock()}>
        <Modal
          title={t('network.users.blockTitle')}
          description={t('network.users.blockConfirmation', {
            name: userToBlock()?.name || '',
          })}
          onClose={() => {
            setUserToBlock(null);
            setBlockUserReason('');
          }}
        >
          <div class={styles['block-form']}>
            <FormItem
              label={t('network.blockReason')}
              id="block-user-reason"
              value={blockUserReason()}
              placeholder={t('network.blockReasonPlaceholder')}
              onInput={(value) => setBlockUserReason(value as string)}
            />
            <div class={styles['modal-actions']} data-modal-actions>
              <Button
                label={
                  blockingUser()
                    ? t('common.blocking')
                    : t('network.users.block')
                }
                onClick={handleBlockUser}
                disabled={blockingUser()}
                color="warning"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setUserToBlock(null);
                  setBlockUserReason('');
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Unblock User Modal */}
      <ConfirmDialog
        show={!!userToUnblock()}
        title={t('network.users.unblockTitle')}
        message={t('network.users.unblockConfirmation', {
          name: userToUnblock()?.name || '',
        })}
        onConfirm={handleUnblockUser}
        onClose={() => setUserToUnblock(null)}
      />

      {/* Delete User Modal */}
      <ConfirmDialog
        show={!!userToDelete()}
        title={t('network.users.deleteTitle')}
        message={t('network.users.deleteConfirmation', {
          name: userToDelete()?.name || '',
        })}
        onConfirm={handleDeleteUser}
        onClose={() => setUserToDelete(null)}
      />

      {/* Network admin role modals */}
      <ConfirmDialog
        show={!!userToPromote()}
        title={t('network.users.makeAdminTitle')}
        message={t('network.users.makeAdminConfirmation', {
          name: userToPromote()?.name || '',
        })}
        onConfirm={() => changeNetworkRole(userToPromote()!, 'admin')}
        onClose={() => setUserToPromote(null)}
      />
      <ConfirmDialog
        show={!!userToDemote()}
        title={t('network.users.removeAdminTitle')}
        message={t('network.users.removeAdminConfirmation', {
          name: userToDemote()?.name || '',
        })}
        onConfirm={() => changeNetworkRole(userToDemote()!, 'member')}
        onClose={() => setUserToDemote(null)}
      />

      {/* Delete Invitation Modal */}
      <ConfirmDialog
        show={!!invitationToDelete()}
        title={t('network.invitations.deleteTitle')}
        message={t('network.invitations.deleteConfirmation', {
          email: invitationToDelete()?.email || '',
        })}
        onConfirm={handleDeleteInvitation}
        onClose={() => setInvitationToDelete(null)}
      />
    </div>
  );
};

export default NetworkUsers;
