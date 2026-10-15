import { Component, createEffect, createSignal, For, Show } from 'solid-js';
import { BsPlus, BsPencil, BsKey } from 'solid-icons/bs';
import { AiOutlineDelete, AiOutlineStop } from 'solid-icons/ai';
import {
  Button,
  ConfirmDialog,
  Dropdown,
  FormItem,
  IconButton,
  Modal,
  Tabs,
  useToast,
} from '@castmill/ui-common';

import { store } from '../../store/store';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Agent,
  AgentAttrs,
  AgentsService,
  parseServerDate,
} from '../../services/agents.service';
import { OrganizationRole } from '../../types/organization-role.type';
import {
  AgentIntegrationInstructions,
  copyToClipboard,
} from './agent-integration-instructions';
import { AgentActivityLog } from './agent-activity-log';

import styles from './agents-page.module.scss';

export const AGENT_ROLES: OrganizationRole[] = [
  'admin',
  'manager',
  'member',
  'editor',
  'publisher',
  'device_manager',
  'guest',
];

const ROLE_LABEL_KEYS: Record<OrganizationRole, string> = {
  admin: 'organization.roleAdmin',
  manager: 'organization.roleManager',
  member: 'organization.roleMember',
  editor: 'organization.roleEditor',
  publisher: 'organization.rolePublisher',
  device_manager: 'organization.roleDeviceManager',
  guest: 'organization.roleGuest',
};

interface AgentFormData {
  name: string;
  description: string;
  role: OrganizationRole;
}

const emptyForm = (): AgentFormData => ({
  name: '',
  description: '',
  role: 'member',
});

type PendingConfirm = {
  kind: 'rotate' | 'revoke' | 'delete';
  agent: Agent;
} | null;

const AgentsPage: Component = () => {
  const { t, formatDate } = useI18n();
  const { hasAnyRole, hasRole } = usePermissions();
  const toast = useToast();

  const canView = () => hasAnyRole(['admin', 'manager']);
  const canManage = () => hasRole('admin');
  const orgId = () => store.organizations.selectedId;

  const [agents, setAgents] = createSignal<Agent[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [refreshKey, setRefreshKey] = createSignal(0);

  const [showForm, setShowForm] = createSignal(false);
  const [editingAgent, setEditingAgent] = createSignal<Agent | null>(null);
  const [formData, setFormData] = createSignal<AgentFormData>(emptyForm());
  const [saving, setSaving] = createSignal(false);

  const [secret, setSecret] = createSignal<{
    agent: Agent;
    value: string;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    createSignal<PendingConfirm>(null);

  const loadAgents = async () => {
    const organizationId = orgId();
    if (!organizationId || !canView()) return;

    setLoading(true);
    try {
      setAgents(await AgentsService.list(organizationId));
    } catch (error) {
      toast.error(t('agents.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (orgId() && canView()) {
      loadAgents();
    }
  });

  const roleLabel = (role: OrganizationRole) =>
    ROLE_LABEL_KEYS[role] ? t(ROLE_LABEL_KEYS[role]) : role;

  const openCreate = () => {
    setEditingAgent(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      role: agent.role,
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    const organizationId = orgId();
    if (!organizationId) return;

    const data = formData();
    const attrs: AgentAttrs = {
      name: data.name.trim(),
      description: data.description.trim(),
      role: data.role,
    };

    setSaving(true);
    try {
      const editing = editingAgent();
      if (editing) {
        await AgentsService.update(organizationId, editing.id, attrs);
        toast.success(t('agents.updated'));
      } else {
        const result = await AgentsService.create(organizationId, attrs);
        setSecret({ agent: result.data, value: result.secret });
        toast.success(t('agents.created'));
      }
      setShowForm(false);
      await loadAgents();
    } catch (error) {
      toast.error(
        t('agents.errors.saveFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    const pending = pendingConfirm();
    const organizationId = orgId();
    setPendingConfirm(null);
    if (!pending || !organizationId) return;

    try {
      switch (pending.kind) {
        case 'rotate': {
          const result = await AgentsService.rotateCredentials(
            organizationId,
            pending.agent.id
          );
          setSecret({ agent: result.data, value: result.secret });
          toast.success(t('agents.rotated'));
          break;
        }
        case 'revoke':
          await AgentsService.revokeCredentials(
            organizationId,
            pending.agent.id
          );
          toast.success(t('agents.revoked'));
          break;
        case 'delete':
          await AgentsService.remove(organizationId, pending.agent.id);
          toast.success(t('agents.deleted'));
          break;
      }
      await loadAgents();
      setRefreshKey(refreshKey() + 1);
    } catch (error) {
      toast.error(
        t('agents.errors.actionFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };

  const confirmTexts = () => {
    const pending = pendingConfirm();
    if (!pending) return { title: '', message: '' };
    return {
      title: t(`agents.confirm.${pending.kind}Title`),
      message: t(`agents.confirm.${pending.kind}Message`, {
        name: pending.agent.name,
      }),
    };
  };

  const copySecret = async () => {
    const current = secret();
    if (!current) return;
    if (await copyToClipboard(current.value)) {
      toast.success(t('agents.copied'));
    } else {
      toast.error(t('agents.errors.copyFailed'));
    }
  };

  const agentsTable = () => (
    <Show
      when={agents().length > 0}
      fallback={
        <div class={styles.empty}>
          {loading() ? t('common.loading') : t('agents.empty')}
        </div>
      }
    >
      <table class={styles.table} data-testid="agents-table">
        <thead>
          <tr>
            <th>{t('common.name')}</th>
            <th>{t('common.role')}</th>
            <th>{t('agents.credentials')}</th>
            <th>{t('agents.lastUsed')}</th>
            <Show when={canManage()}>
              <th>{t('common.actions')}</th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={agents()}>
            {(agent) => (
              <tr data-testid={`agent-row-${agent.id}`}>
                <td>
                  <div class={styles.agentName}>{agent.name}</div>
                  <Show when={agent.description}>
                    <div class={styles.muted}>{agent.description}</div>
                  </Show>
                </td>
                <td>{roleLabel(agent.role)}</td>
                <td>
                  <Show
                    when={agent.has_credentials}
                    fallback={
                      <span class={styles.statusError}>
                        {t('agents.credentialsRevoked')}
                      </span>
                    }
                  >
                    <code>{`${agent.secret_prefix ?? ''}…`}</code>
                  </Show>
                </td>
                <td>
                  {agent.last_used_at
                    ? formatDate(parseServerDate(agent.last_used_at), 'Pp')
                    : t('agents.neverUsed')}
                  <Show when={agent.last_ip}>
                    <div class={styles.muted}>{agent.last_ip}</div>
                  </Show>
                </td>
                <Show when={canManage()}>
                  <td>
                    <div class={styles.rowActions}>
                      <IconButton
                        icon={BsPencil}
                        onClick={() => openEdit(agent)}
                        color="primary"
                        title={t('common.edit')}
                      />
                      <IconButton
                        icon={BsKey}
                        onClick={() =>
                          setPendingConfirm({ kind: 'rotate', agent })
                        }
                        color="primary"
                        title={t('agents.rotate')}
                      />
                      <Show when={agent.has_credentials}>
                        <IconButton
                          icon={AiOutlineStop}
                          onClick={() =>
                            setPendingConfirm({ kind: 'revoke', agent })
                          }
                          color="danger"
                          title={t('agents.revoke')}
                        />
                      </Show>
                      <IconButton
                        icon={AiOutlineDelete}
                        onClick={() =>
                          setPendingConfirm({ kind: 'delete', agent })
                        }
                        color="danger"
                        title={t('common.delete')}
                      />
                    </div>
                  </td>
                </Show>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </Show>
  );

  return (
    <div class={styles.agentsPage}>
      <Show
        when={canView()}
        fallback={
          <div class={styles.empty} data-testid="agents-no-access">
            {t('agents.noAccess')}
          </div>
        }
      >
        <div class={styles.header}>
          <div>
            <h1>{t('agents.title')}</h1>
            <p class={styles.muted}>{t('agents.description')}</p>
          </div>
          <Show when={canManage()}>
            <Button
              label={t('agents.newAgent')}
              icon={BsPlus}
              color="primary"
              onClick={openCreate}
            />
          </Show>
        </div>

        <Tabs
          tabs={[
            { title: () => t('agents.tabs.agents'), content: agentsTable },
            {
              title: () => t('agents.tabs.activity'),
              content: () => (
                <AgentActivityLog
                  organizationId={orgId() || ''}
                  agents={agents()}
                  refreshKey={refreshKey()}
                />
              ),
            },
            {
              title: () => t('agents.tabs.setup'),
              content: () => <AgentIntegrationInstructions />,
            },
          ]}
        />
      </Show>

      <Show when={showForm()}>
        <Modal
          title={editingAgent() ? t('agents.editAgent') : t('agents.newAgent')}
          description={t('agents.formDescription')}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={handleSubmit} class={styles.form}>
            <FormItem
              label={t('common.name')}
              id="agent-name"
              value={formData().name}
              placeholder={t('agents.namePlaceholder')}
              onInput={(value) =>
                setFormData({ ...formData(), name: String(value) })
              }
            />
            <FormItem
              label={t('common.description')}
              id="agent-description"
              value={formData().description}
              placeholder={t('agents.descriptionPlaceholder')}
              onInput={(value) =>
                setFormData({ ...formData(), description: String(value) })
              }
            />
            <Dropdown
              id="agent-role"
              label={t('common.role')}
              value={formData().role}
              items={AGENT_ROLES.map((role) => ({
                value: role,
                name: roleLabel(role),
              }))}
              onSelectChange={(value) =>
                setFormData({
                  ...formData(),
                  role: (value as OrganizationRole) || 'member',
                })
              }
            />
            <p class={styles.muted}>
              {t(`organization.roleDescriptions.${formData().role}`)}
            </p>
            <div class={styles.formActions}>
              <Button
                label={t('common.cancel')}
                color="secondary"
                onClick={() => setShowForm(false)}
              />
              <Button
                label={editingAgent() ? t('common.save') : t('common.create')}
                type="submit"
                color="primary"
                loading={saving()}
                disabled={formData().name.trim().length < 2}
              />
            </div>
          </form>
        </Modal>
      </Show>

      <Show when={secret()}>
        {(current) => (
          <Modal
            title={t('agents.secretTitle', { name: current().agent.name })}
            description={t('agents.secretWarning')}
            onClose={() => setSecret(null)}
          >
            <div class={styles.secretBox}>
              <code data-testid="agent-secret">{current().value}</code>
              <Button
                label={t('agents.copy')}
                color="primary"
                onClick={copySecret}
              />
            </div>
            <AgentIntegrationInstructions secret={current().value} />
            <div class={styles.formActions}>
              <Button
                label={t('agents.secretDone')}
                color="primary"
                onClick={() => setSecret(null)}
              />
            </div>
          </Modal>
        )}
      </Show>

      <ConfirmDialog
        show={pendingConfirm() !== null}
        title={confirmTexts().title}
        message={confirmTexts().message}
        onClose={() => setPendingConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default AgentsPage;
