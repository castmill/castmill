/**
 * Network Organizations page — create, list, block/unblock, delete organizations.
 */
import { Component, Show, For, createSignal, onMount } from 'solid-js';
import {
  Button,
  FormItem,
  useToast,
  ToolBar,
  ConfirmDialog,
  Pagination,
  Modal,
} from '@castmill/ui-common';
import { NetworkService, Organization } from '../../services/network.service';
import { useI18n } from '../../i18n';
import { BsPlusLg, BsTrash, BsSlashCircle, BsUnlock } from 'solid-icons/bs';
import { useNetworkContext } from './network-context';
import styles from './network.module.scss';

const NetworkOrganizations: Component = () => {
  const { t } = useI18n();
  const toast = useToast();
  const { stats, setStats } = useNetworkContext();

  // Organizations state
  const [organizations, setOrganizations] = createSignal<Organization[]>([]);
  const [orgSearch, setOrgSearch] = createSignal('');
  const [orgPage, setOrgPage] = createSignal(1);
  const [orgPageSize] = createSignal(10);
  const [orgTotalCount, setOrgTotalCount] = createSignal(0);
  const [orgTotalPages, setOrgTotalPages] = createSignal(0);
  const [loadingOrgs, setLoadingOrgs] = createSignal(false);

  // Delete state
  const [orgToDelete, setOrgToDelete] = createSignal<Organization | null>(null);

  // Block/unblock state
  const [orgToBlock, setOrgToBlock] = createSignal<Organization | null>(null);
  const [orgToUnblock, setOrgToUnblock] = createSignal<Organization | null>(
    null
  );
  const [blockingOrg, setBlockingOrg] = createSignal(false);
  const [blockOrgReason, setBlockOrgReason] = createSignal('');

  // New organization form
  const [newOrgName, setNewOrgName] = createSignal('');
  const [creatingOrg, setCreatingOrg] = createSignal(false);

  onMount(async () => {
    await loadOrganizations();
  });

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const result = await NetworkService.listOrganizations({
        page: orgPage(),
        pageSize: orgPageSize(),
        search: orgSearch() || undefined,
      });
      setOrganizations(result.data);
      setOrgTotalCount(result.pagination.total_count);
      setOrgTotalPages(result.pagination.total_pages);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      toast.error(t('network.organizations.loadError'));
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleOrgSearch = (value: string) => {
    setOrgSearch(value);
    setOrgPage(1);
    loadOrganizations();
  };

  const handleOrgPageChange = (page: number) => {
    setOrgPage(page);
    loadOrganizations();
  };

  const handleCreateOrganization = async () => {
    const orgName = newOrgName().trim();
    if (!orgName) {
      toast.error(t('network.organizations.nameRequired'));
      return;
    }

    setCreatingOrg(true);
    try {
      await NetworkService.createOrganization(orgName);
      setNewOrgName('');
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          organizations_count: currentStats.organizations_count + 1,
        });
      }
      await loadOrganizations();
      toast.success(t('network.organizations.createSuccess'));
    } catch (err) {
      console.error('Failed to create organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.createError')
      );
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleDeleteOrganization = async () => {
    const org = orgToDelete();
    if (!org) return;

    try {
      await NetworkService.deleteOrganization(org.id);
      const currentStats = stats();
      if (currentStats) {
        setStats({
          ...currentStats,
          organizations_count: Math.max(
            0,
            currentStats.organizations_count - 1
          ),
        });
      }
      await loadOrganizations();
      toast.success(t('network.organizations.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.deleteError')
      );
    } finally {
      setOrgToDelete(null);
    }
  };

  const handleBlockOrganization = async () => {
    const org = orgToBlock();
    if (!org) return;

    setBlockingOrg(true);
    try {
      const result = await NetworkService.blockOrganization(
        org.id,
        blockOrgReason()
      );
      setOrganizations((orgs) =>
        orgs.map((o) =>
          o.id === org.id
            ? {
                ...o,
                blocked_at: result.organization.blocked_at,
                blocked_reason: result.organization.blocked_reason,
              }
            : o
        )
      );
      toast.success(t('network.organizations.blockSuccess'));
    } catch (err) {
      console.error('Failed to block organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.blockError')
      );
    } finally {
      setBlockingOrg(false);
      setOrgToBlock(null);
      setBlockOrgReason('');
    }
  };

  const handleUnblockOrganization = async () => {
    const org = orgToUnblock();
    if (!org) return;

    setBlockingOrg(true);
    try {
      const result = await NetworkService.unblockOrganization(org.id);
      setOrganizations((orgs) =>
        orgs.map((o) =>
          o.id === org.id
            ? {
                ...o,
                blocked_at: result.organization.blocked_at,
                blocked_reason: result.organization.blocked_reason,
              }
            : o
        )
      );
      toast.success(t('network.organizations.unblockSuccess'));
    } catch (err) {
      console.error('Failed to unblock organization:', err);
      toast.error(
        err instanceof Error
          ? err.message
          : t('network.organizations.unblockError')
      );
    } finally {
      setBlockingOrg(false);
      setOrgToUnblock(null);
    }
  };

  return (
    <div class={styles['network-page']}>
      {/* Header */}
      <div class={styles['page-header']}>
        <h1>{t('network.tabs.organizations')}</h1>
      </div>

      {/* Create Organization Form */}
      <div class={styles['create-org-form']}>
        <h3>{t('network.organizations.createTitle')}</h3>
        <p>{t('network.organizations.createDescription')}</p>
        <div class={styles['create-org-row']}>
          <FormItem
            label={t('network.organizations.name')}
            id="new-org-name"
            value={newOrgName()}
            placeholder={t('network.organizations.namePlaceholder')}
            onInput={(value) => setNewOrgName(value as string)}
          />
          <Button
            label={creatingOrg() ? t('common.creating') : t('common.create')}
            onClick={handleCreateOrganization}
            disabled={creatingOrg() || !newOrgName().trim()}
            icon={BsPlusLg}
            color="primary"
          />
        </div>
      </div>

      {/* Organizations List */}
      <div class={styles['org-list']}>
        <ToolBar onSearch={handleOrgSearch} initialSearchText={orgSearch()} />

        <Show when={loadingOrgs()}>
          <div class={styles['loading-overlay']}>{t('common.loading')}</div>
        </Show>

        <Show
          when={organizations().length > 0}
          fallback={
            <div class={styles['empty-list']}>
              {orgSearch()
                ? t('network.organizations.noSearchResults')
                : t('network.organizations.noOrganizations')}
            </div>
          }
        >
          <table class={styles['data-table']}>
            <thead>
              <tr>
                <th>{t('network.organizations.name')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.created')}</th>
                <th class={styles['actions-column']}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={organizations()}>
                {(org) => (
                  <tr class={org.blocked_at ? styles['blocked-row'] : ''}>
                    <td>{org.name}</td>
                    <td>
                      <Show
                        when={org.blocked_at}
                        fallback={
                          <span class={styles['status-active']}>
                            {t('network.status.active')}
                          </span>
                        }
                      >
                        <span
                          class={styles['status-blocked']}
                          title={org.blocked_reason || ''}
                        >
                          {t('network.status.blocked')}
                        </span>
                      </Show>
                    </td>
                    <td>{new Date(org.inserted_at).toLocaleDateString()}</td>
                    <td>
                      <div class={styles['actions-row']}>
                        <Show
                          when={org.blocked_at}
                          fallback={
                            <Button
                              label=""
                              icon={BsSlashCircle}
                              color="warning"
                              onClick={() => setOrgToBlock(org)}
                              title={t('network.organizations.block')}
                            />
                          }
                        >
                          <Button
                            label=""
                            icon={BsUnlock}
                            color="success"
                            onClick={() => setOrgToUnblock(org)}
                            title={t('network.organizations.unblock')}
                          />
                        </Show>
                        <Button
                          label=""
                          icon={BsTrash}
                          color="danger"
                          onClick={() => setOrgToDelete(org)}
                          title={t('common.delete')}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>

          <Show when={orgTotalPages() > 1}>
            <div class={styles['pagination-container']}>
              <Pagination
                currentPage={orgPage()}
                totalItems={orgTotalCount()}
                itemsPerPage={orgPageSize()}
                onPageChange={handleOrgPageChange}
              />
              <span class={styles['pagination-info']}>
                {t('network.organizations.showingOf', {
                  showing: organizations().length,
                  total: orgTotalCount(),
                })}
              </span>
            </div>
          </Show>
        </Show>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        show={!!orgToDelete()}
        title={t('network.organizations.deleteTitle')}
        message={t('network.organizations.deleteConfirmation', {
          name: orgToDelete()?.name || '',
        })}
        onConfirm={handleDeleteOrganization}
        onClose={() => setOrgToDelete(null)}
      />

      {/* Block Organization Modal */}
      <Show when={orgToBlock()}>
        <Modal
          title={t('network.organizations.blockTitle')}
          description={t('network.organizations.blockConfirmation', {
            name: orgToBlock()?.name || '',
          })}
          onClose={() => {
            setOrgToBlock(null);
            setBlockOrgReason('');
          }}
        >
          <div class="block-form">
            <FormItem
              label={t('network.blockReason')}
              id="block-org-reason"
              value={blockOrgReason()}
              placeholder={t('network.blockReasonPlaceholder')}
              onInput={(value) => setBlockOrgReason(value as string)}
            />
            <div class="modal-actions">
              <Button
                label={
                  blockingOrg()
                    ? t('common.blocking')
                    : t('network.organizations.block')
                }
                onClick={handleBlockOrganization}
                disabled={blockingOrg()}
                color="warning"
              />
              <Button
                label={t('common.cancel')}
                onClick={() => {
                  setOrgToBlock(null);
                  setBlockOrgReason('');
                }}
              />
            </div>
          </div>
        </Modal>
      </Show>

      {/* Unblock Organization Modal */}
      <ConfirmDialog
        show={!!orgToUnblock()}
        title={t('network.organizations.unblockTitle')}
        message={t('network.organizations.unblockConfirmation', {
          name: orgToUnblock()?.name || '',
        })}
        onConfirm={handleUnblockOrganization}
        onClose={() => setOrgToUnblock(null)}
      />
    </div>
  );
};

export default NetworkOrganizations;
