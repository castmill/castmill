/**
 * Network Users & Invitations page — invite, list, block/unblock, delete users;
 * list and delete pending invitations.
 */
import { Component, Show, For, createSignal, onMount } from 'solid-js';
import {
  Button,
  FormItem,
  useToast,
  ConfirmDialog,
  Modal,
  ComboBox,
  Dropdown,
} from '@castmill/ui-common';
import {
  NetworkService,
  Organization,
  NetworkUser,
  NetworkInvitation,
} from '../../services/network.service';
import { useI18n } from '../../i18n';
import { BsPlusLg, BsTrash, BsSlashCircle, BsUnlock } from 'solid-icons/bs';
import { useNetworkContext } from './network-context';
import styles from './network.module.scss';

const NetworkUsers: Component = () => {
  const { t } = useI18n();
  const toast = useToast();
  const { stats, setStats } = useNetworkContext();

  // Users state
  const [users, setUsers] = createSignal<NetworkUser[]>([]);
  const [loadingUsers, setLoadingUsers] = createSignal(true);

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

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await NetworkService.listUsers();
      setUsers(data);
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
        <h3>{t('network.users.listTitle')}</h3>

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
            <table class={styles['data-table']}>
              <thead>
                <tr>
                  <th>{t('network.users.name')}</th>
                  <th>{t('network.users.email')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.created')}</th>
                  <th class={styles['actions-column']}>
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <For each={users()}>
                  {(user) => (
                    <tr class={user.blocked_at ? styles['blocked-row'] : ''}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
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
                      </td>
                      <td>{new Date(user.inserted_at).toLocaleDateString()}</td>
                      <td>
                        <div class={styles['actions-row']}>
                          <Show
                            when={user.blocked_at}
                            fallback={
                              <Button
                                label=""
                                icon={BsSlashCircle}
                                color="warning"
                                onClick={() => setUserToBlock(user)}
                                title={t('network.users.block')}
                              />
                            }
                          >
                            <Button
                              label=""
                              icon={BsUnlock}
                              color="success"
                              onClick={() => setUserToUnblock(user)}
                              title={t('network.users.unblock')}
                            />
                          </Show>
                          <Button
                            label=""
                            icon={BsTrash}
                            color="danger"
                            onClick={() => setUserToDelete(user)}
                            title={t('common.delete')}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
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
              <table class={styles['data-table']}>
                <thead>
                  <tr>
                    <th>{t('common.email')}</th>
                    <th>{t('network.invitations.organizationName')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.created')}</th>
                    <th>{t('network.invitations.expires')}</th>
                    <th class={styles['actions-column']}>
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={invitations()}>
                    {(invitation) => (
                      <tr>
                        <td>{invitation.email}</td>
                        <td>{invitation.organization_name}</td>
                        <td>
                          <span class={styles['status-pending']}>
                            {invitation.status}
                          </span>
                        </td>
                        <td>
                          {new Date(
                            invitation.inserted_at
                          ).toLocaleDateString()}
                        </td>
                        <td>
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div class={styles['actions-row']}>
                            <Button
                              label=""
                              icon={BsTrash}
                              color="danger"
                              onClick={() => setInvitationToDelete(invitation)}
                              title={t('common.delete')}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
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
          <div class="invite-form">
            <ComboBox<Organization>
              id="invite-org-selector"
              label={t('network.users.selectOrganization')}
              placeholder={t('network.users.selectOrganizationPlaceholder')}
              value={selectedInviteOrg()}
              fetchItems={fetchOrganizationsForInvite}
              renderItem={(org: Organization) => (
                <div class="org-combobox-item">
                  <div class="org-name">{org.name}</div>
                </div>
              )}
              onSelect={(org: Organization) => setSelectedInviteOrg(org)}
              clearable={true}
              clearLabel={t('common.clear')}
              onClear={() => setSelectedInviteOrg(undefined)}
            />

            <div style="margin-top: 1em;">
              <FormItem
                label={t('network.users.inviteEmailLabel')}
                id="invite-email"
                value={inviteEmail()}
                placeholder={t('network.users.inviteEmailPlaceholder')}
                type="email"
                onInput={(value) => setInviteEmail(String(value))}
              >
                <></>
              </FormItem>
            </div>

            <div style="margin-top: 1em;">
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
            </div>

            <Show when={inviteError()}>
              <div class="error-message">{inviteError()}</div>
            </Show>

            <div class="modal-actions">
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
          <div class="block-form">
            <FormItem
              label={t('network.blockReason')}
              id="block-user-reason"
              value={blockUserReason()}
              placeholder={t('network.blockReasonPlaceholder')}
              onInput={(value) => setBlockUserReason(value as string)}
            >
              <></>
            </FormItem>
            <div class="modal-actions">
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
