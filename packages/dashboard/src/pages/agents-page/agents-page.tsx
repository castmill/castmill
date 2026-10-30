import { Component, createEffect, createSignal, on, Show } from 'solid-js';
import { BsPlus } from 'solid-icons/bs';
import {
  AiOutlineDelete,
  AiOutlineEdit,
  AiOutlineKey,
  AiOutlineStop,
} from 'solid-icons/ai';
import { TbRobot } from 'solid-icons/tb';
import {
  Button,
  Column,
  ConfirmDialog,
  Dropdown,
  FormItem,
  Modal,
  Table,
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
  let agentsRequestSequence = 0;

  const loadAgents = async (organizationId = orgId()) => {
    const requestSequence = ++agentsRequestSequence;
    if (!organizationId || !canView()) {
      setAgents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await AgentsService.list(organizationId);
      if (
        requestSequence === agentsRequestSequence &&
        organizationId === orgId() &&
        canView()
      ) {
        setAgents(result);
      }
    } catch (error) {
      if (
        requestSequence === agentsRequestSequence &&
        organizationId === orgId() &&
        canView()
      ) {
        toast.error(t('agents.errors.loadFailed'));
      }
    } finally {
      if (
        requestSequence === agentsRequestSequence &&
        organizationId === orgId() &&
        canView()
      ) {
        setLoading(false);
      }
    }
  };

  createEffect(
    on(
      () => [orgId(), canView()] as const,
      ([organizationId, permitted]) => {
        setAgents([]);
        if (permitted) {
          loadAgents(organizationId);
        } else {
          agentsRequestSequence += 1;
          setLoading(false);
        }
      }
    )
  );

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

  const columns = (): Column<string, Agent>[] => {
    const base: Column<string, Agent>[] = [
      {
        key: 'name',
        title: () => t('common.name'),
        render: (agent) => (
          <div class={styles.nameCell}>
            <span class={styles.agentName}>{agent.name}</span>
            <Show when={agent.description}>
              <span class={styles.agentDescription}>{agent.description}</span>
            </Show>
          </div>
        ),
      },
      {
        key: 'role',
        title: () => t('common.role'),
        render: (agent) => <>{roleLabel(agent.role)}</>,
      },
      {
        key: 'credentials',
        title: () => t('agents.credentials'),
        render: (agent) => (
          <Show
            when={agent.has_credentials}
            fallback={
              <span class={styles.badgeRevoked}>
                {t('agents.credentialsRevoked')}
              </span>
            }
          >
            <code class={styles.secretChip}>
              {`${agent.secret_prefix ?? ''}…`}
            </code>
          </Show>
        ),
      },
      {
        key: 'last_used_at',
        title: () => t('agents.lastUsed'),
        render: (agent) => (
          <div class={styles.lastUsed}>
            <span>
              {agent.last_used_at
                ? formatDate(parseServerDate(agent.last_used_at), 'Pp')
                : t('agents.neverUsed')}
            </span>
            <Show when={agent.last_ip}>
              <span class={styles.ip}>{agent.last_ip}</span>
            </Show>
          </div>
        ),
      },
    ];

    if (!canManage()) return base;

    // Rendered as a column (not Table actions) because revoke is conditional.
    return [
      ...base,
      {
        key: 'actions',
        title: () => t('common.actions'),
        render: (agent) => (
          <div class={styles.rowActions}>
            <button
              type="button"
              title={t('common.edit')}
              aria-label={`${t('common.edit')} ${agent.name}`}
              onClick={() => openEdit(agent)}
            >
              <AiOutlineEdit />
            </button>
            <button
              type="button"
              title={t('agents.rotate')}
              aria-label={`${t('agents.rotate')} ${agent.name}`}
              onClick={() => setPendingConfirm({ kind: 'rotate', agent })}
            >
              <AiOutlineKey />
            </button>
            <Show when={agent.has_credentials}>
              <button
                type="button"
                title={t('agents.revoke')}
                aria-label={`${t('agents.revoke')} ${agent.name}`}
                onClick={() => setPendingConfirm({ kind: 'revoke', agent })}
              >
                <AiOutlineStop />
              </button>
            </Show>
            <button
              type="button"
              title={t('common.delete')}
              aria-label={`${t('common.delete')} ${agent.name}`}
              onClick={() => setPendingConfirm({ kind: 'delete', agent })}
            >
              <AiOutlineDelete />
            </button>
          </div>
        ),
      },
    ];
  };

  const agentsTable = () => (
    <div class={styles.tabPanel}>
      <Show
        when={agents().length > 0}
        fallback={
          <div class={styles.emptyState}>
            <Show when={!loading()} fallback={<p>{t('common.loading')}</p>}>
              <TbRobot class={styles.emptyIcon} />
              <p>{t('agents.empty')}</p>
              <Show when={canManage()}>
                <Button
                  label={t('agents.newAgent')}
                  icon={BsPlus}
                  color="primary"
                  onClick={openCreate}
                />
              </Show>
            </Show>
          </div>
        }
      >
        <div data-testid="agents-table">
          <Table<string, Agent>
            columns={columns}
            data={agents()}
            hideCheckboxes
          />
        </div>
      </Show>
    </div>
  );

  return (
    <div class={styles.agentsPage}>
      <Show
        when={canView()}
        fallback={
          <div class={styles.emptyState} data-testid="agents-no-access">
            <p>{t('agents.noAccess')}</p>
          </div>
        }
      >
        <div class={styles.header}>
          <div class={styles.headerText}>
            <h1>{t('agents.title')}</h1>
            <p class={styles.description}>{t('agents.description')}</p>
          </div>
          <Show when={canManage()}>
            <div class={styles.headerAction}>
              <Button
                label={t('agents.newAgent')}
                icon={BsPlus}
                color="primary"
                onClick={openCreate}
              />
            </div>
          </Show>
        </div>

        <Tabs
          tabs={[
            { title: () => t('agents.tabs.agents'), content: agentsTable },
            {
              title: () => t('agents.tabs.activity'),
              // Keyed on the organization so filters and page reset on switch.
              content: () => (
                <div class={styles.tabPanel}>
                  <Show when={orgId()} keyed>
                    {(organizationId) => (
                      <AgentActivityLog
                        organizationId={organizationId}
                        agents={agents()}
                        refreshKey={refreshKey()}
                      />
                    )}
                  </Show>
                </div>
              ),
            },
            {
              title: () => t('agents.tabs.setup'),
              content: () => (
                <div class={styles.tabPanel}>
                  <AgentIntegrationInstructions />
                </div>
              ),
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
