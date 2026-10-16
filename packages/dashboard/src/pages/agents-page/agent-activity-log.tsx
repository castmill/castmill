import { Component, createEffect, createSignal, For, on, Show } from 'solid-js';
import { Dropdown, Pagination, useToast } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import {
  Agent,
  AgentAction,
  AgentsService,
  parseServerDate,
} from '../../services/agents.service';

import styles from './agents-page.module.scss';

const PAGE_SIZE = 25;

export const AgentActivityLog: Component<{
  organizationId: string;
  agents: Agent[];
  refreshKey?: number;
}> = (props) => {
  const { t, formatDate } = useI18n();
  const toast = useToast();

  const [actions, setActions] = createSignal<AgentAction[]>([]);
  const [count, setCount] = createSignal(0);
  const [page, setPage] = createSignal(1);
  const [agentId, setAgentId] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<'success' | 'error' | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [expanded, setExpanded] = createSignal<number | null>(null);
  let requestSequence = 0;
  let lastQueryKey = '';

  const load = async () => {
    const organizationId = props.organizationId;
    const query = {
      agentId: agentId() ?? undefined,
      status: status() ?? undefined,
      page: page(),
      pageSize: PAGE_SIZE,
    };
    const queryKey = JSON.stringify([
      organizationId,
      query.agentId,
      query.status,
      query.page,
    ]);
    const requestId = ++requestSequence;

    if (queryKey !== lastQueryKey) {
      lastQueryKey = queryKey;
      setActions([]);
      setCount(0);
      setExpanded(null);
    }

    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await AgentsService.listActions(organizationId, query);
      if (requestId !== requestSequence) return;
      setActions(result.data);
      setCount(result.count);
    } catch (error) {
      if (requestId === requestSequence) {
        toast.error(t('agents.errors.loadActionsFailed'));
      }
    } finally {
      if (requestId === requestSequence) {
        setLoading(false);
      }
    }
  };

  createEffect(
    on(
      () => [
        props.organizationId,
        props.refreshKey,
        agentId(),
        status(),
        page(),
      ],
      () => load()
    )
  );

  const formatTime = (value: string) =>
    formatDate(parseServerDate(value), 'Pp');

  return (
    <div class={styles.activityLog} data-testid="agent-activity-log">
      <div class={styles.filters}>
        <Dropdown
          label={t('agents.activity.agent')}
          value={agentId()}
          placeholder={t('agents.activity.allAgents')}
          clearable
          clearLabel={t('agents.activity.allAgents')}
          items={props.agents.map((agent) => ({
            value: agent.id,
            name: agent.name,
          }))}
          onSelectChange={(value) => {
            setPage(1);
            setAgentId(value || null);
          }}
        />
        <Dropdown
          label={t('agents.activity.status')}
          value={status()}
          placeholder={t('agents.activity.allStatuses')}
          clearable
          clearLabel={t('agents.activity.allStatuses')}
          items={[
            { value: 'success', name: t('agents.activity.success') },
            { value: 'error', name: t('agents.activity.error') },
          ]}
          onSelectChange={(value) => {
            setPage(1);
            setStatus((value as 'success' | 'error') || null);
          }}
        />
      </div>

      <Show
        when={actions().length > 0}
        fallback={
          <p class={styles.empty}>
            {loading() ? t('common.loading') : t('agents.activity.empty')}
          </p>
        }
      >
        <table class={styles.table}>
          <thead>
            <tr>
              <th>{t('common.time')}</th>
              <th>{t('agents.activity.agent')}</th>
              <th>{t('agents.activity.tool')}</th>
              <th>{t('agents.activity.request')}</th>
              <th>{t('agents.activity.status')}</th>
              <th>{t('agents.activity.duration')}</th>
            </tr>
          </thead>
          <tbody>
            <For each={actions()}>
              {(action) => (
                <>
                  <tr>
                    <td>{formatTime(action.inserted_at)}</td>
                    <td>{action.agent_name}</td>
                    <td>
                      <button
                        type="button"
                        class={styles.toolDisclosure}
                        aria-expanded={expanded() === action.id}
                        onClick={() =>
                          setExpanded(
                            expanded() === action.id ? null : action.id
                          )
                        }
                      >
                        <code>{action.tool}</code>
                      </button>
                    </td>
                    <td class={styles.requestCell}>
                      <Show when={action.method}>
                        <code>
                          {action.method} {action.path}
                        </code>
                      </Show>
                    </td>
                    <td>
                      <span
                        class={
                          action.status === 'success'
                            ? styles.statusSuccess
                            : styles.statusError
                        }
                      >
                        {action.status === 'success'
                          ? t('agents.activity.success')
                          : t('agents.activity.error')}
                        <Show when={action.http_status}>
                          {` (${action.http_status})`}
                        </Show>
                      </span>
                    </td>
                    <td>
                      <Show
                        when={
                          action.duration_ms !== null &&
                          action.duration_ms !== undefined
                        }
                      >
                        {`${action.duration_ms} ms`}
                      </Show>
                    </td>
                  </tr>
                  <Show when={expanded() === action.id}>
                    <tr class={styles.detailsRow}>
                      <td colSpan={6}>
                        <Show when={action.error}>
                          <p class={styles.errorText}>{action.error}</p>
                        </Show>
                        <div class={styles.label}>
                          {t('agents.activity.arguments')}
                        </div>
                        <pre>
                          {JSON.stringify(action.arguments ?? {}, null, 2)}
                        </pre>
                        <Show when={action.ip}>
                          <div class={styles.muted}>
                            {t('common.ip')}: {action.ip}
                          </div>
                        </Show>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
        <Show when={count() > PAGE_SIZE}>
          <Pagination
            totalItems={count()}
            itemsPerPage={PAGE_SIZE}
            currentPage={page()}
            onPageChange={setPage}
          />
        </Show>
      </Show>
    </div>
  );
};
