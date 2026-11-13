import {
  Component,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import { BsPlus, BsEye } from 'solid-icons/bs';
import { AiOutlineDelete } from 'solid-icons/ai';
import {
  Button,
  Column,
  ConfirmDialog,
  FetchDataOptions,
  Modal,
  TableAction,
  TableView,
  TableViewRef,
  useToast,
} from '@castmill/ui-common';

import { store } from '../../store/store';
import { useI18n } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import {
  Automation,
  AutomationsService,
} from '../../services/automations.service';
import { parseServerDate } from '../../services/agents.service';
import { AutomationEditor } from './automation-editor';
import { EnabledToggle } from './enabled-toggle';
import { loadPlaylistNames, referencedPlaylistIds } from './playlist-names';
import { ruleSummary } from './registry';
import { useSummaryContext } from './summary-context';

import styles from './automations.module.scss';
import { useTableCardLabels } from '../../hooks/useTableCardLabels';

const ITEMS_PER_PAGE = 10;

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const AutomationsPage: Component = () => {
  const { t, locale } = useI18n();
  const cardLabels = useTableCardLabels();
  const { canPerformAction } = usePermissions();
  const toast = useToast();
  const summaryContext = useSummaryContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const orgId = () => store.organizations.selectedId;
  // Permissions load asynchronously; do not flash "no access" meanwhile.
  const canList = () =>
    !store.permissions?.loaded || canPerformAction('automations', 'list');
  const canCreate = () => canPerformAction('automations', 'create');
  const canUpdate = () => canPerformAction('automations', 'update');
  const canDelete = () => canPerformAction('automations', 'delete');

  const [serverSources, setServerSources] = createSignal<string[] | null>(null);
  const [serverActions, setServerActions] = createSignal<string[] | null>(null);
  const [editing, setEditing] = createSignal<Automation | null>(null);
  const [pendingDelete, setPendingDelete] = createSignal<Automation | null>(
    null
  );
  const [showCreate, setShowCreate] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [creating, setCreating] = createSignal(false);

  let tableRef: TableViewRef<number, Automation> | undefined;
  const reload = () => tableRef?.reloadData();

  createEffect(
    on(orgId, async (organizationId) => {
      setServerSources(null);
      setServerActions(null);
      setEditing(null);
      if (!organizationId) return;
      try {
        const registry = await AutomationsService.registry(organizationId);
        if (organizationId !== orgId()) return;
        if (registry?.sources?.length)
          setServerSources(registry.sources.map((s) => s.type));
        if (registry?.actions?.length)
          setServerActions(registry.actions.map((a) => a.type));
      } catch {
        // Fall back to every type registered in the dashboard.
      }
    })
  );

  createEffect(
    on(
      orgId,
      () => {
        reload();
      },
      { defer: true }
    )
  );

  const fetchData = async ({ page, search }: FetchDataOptions) => {
    const organizationId = orgId();
    if (!organizationId) return { data: [], count: 0 };
    try {
      const result = await AutomationsService.list(organizationId, {
        search,
        page: page.num,
        pageSize: page.size,
      });
      loadPlaylistNames(
        organizationId,
        result.data.flatMap((automation) =>
          referencedPlaylistIds(automation.rules || [])
        )
      );
      return result;
    } catch (error) {
      toast.error(t('automations.errors.loadFailed'));
      throw error;
    }
  };

  const applyUpdate = (automation: Automation) => {
    tableRef?.updateItem(automation.id, automation);
    if (editing()?.id === automation.id) setEditing(automation);
  };

  const toggleEnabled = async (automation: Automation, enabled: boolean) => {
    const organizationId = orgId();
    if (!organizationId) return;
    try {
      applyUpdate(
        await AutomationsService.update(organizationId, automation.id, {
          enabled,
        })
      );
    } catch (error) {
      toast.error(
        t('automations.errors.saveFailed', { error: errorText(error) })
      );
    }
  };

  const create = async (event: Event) => {
    event.preventDefault();
    const organizationId = orgId();
    const name = newName().trim();
    if (!organizationId || !name) return;
    setCreating(true);
    try {
      const automation = await AutomationsService.create(organizationId, {
        name,
        enabled: true,
        rules: [],
      });
      setShowCreate(false);
      setNewName('');
      toast.success(t('automations.created', { name }));
      await reload();
      setEditing(automation);
    } catch (error) {
      toast.error(
        t('automations.errors.saveFailed', { error: errorText(error) })
      );
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    const automation = pendingDelete();
    const organizationId = orgId();
    setPendingDelete(null);
    if (!automation || !organizationId) return;
    try {
      await AutomationsService.remove(organizationId, automation.id);
      toast.success(t('automations.deleted', { name: automation.name }));
      if (editing()?.id === automation.id) setEditing(null);
      await reload();
    } catch (error) {
      toast.error(
        t('automations.errors.deleteFailed', { error: errorText(error) })
      );
    }
  };

  const formatFiring = (value: string | null) => {
    if (!value) return t('automations.noUpcoming');
    const date = parseServerDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const rulesCell = (automation: Automation) => {
    const rules = automation.rules || [];
    if (rules.length === 0)
      return <span class={styles.muted}>{t('automations.noRules')}</span>;
    return (
      <div class={styles.rulesCell}>
        <span>{ruleSummary(rules[0], summaryContext())}</span>
        <Show when={rules.length > 1}>
          <span class={styles.muted}>
            {t('automations.moreRules', { count: rules.length - 1 })}
          </span>
        </Show>
      </div>
    );
  };

  const columns = (): Column<number, Automation>[] => [
    { key: 'name', title: () => t('common.name') },
    {
      key: 'rules',
      title: () => t('automations.columns.rules'),
      render: rulesCell,
    },
    {
      key: 'assignments',
      title: () => t('automations.columns.assignments'),
      render: (automation) => (
        <span
          title={t('automations.assignmentsDetail', {
            devices: automation.devices?.length || 0,
            channels: automation.channels?.length || 0,
          })}
        >
          {(automation.devices?.length || 0) +
            (automation.channels?.length || 0)}
        </span>
      ),
    },
    {
      key: 'enabled',
      title: () => t('automations.enabled'),
      render: (automation) => (
        <EnabledToggle
          checked={automation.enabled}
          label={t('automations.toggleEnabled', { name: automation.name })}
          disabled={!canUpdate()}
          onChange={(enabled) => toggleEnabled(automation, enabled)}
        />
      ),
    },
    {
      key: 'next_firing',
      title: () => t('automations.columns.nextFiring'),
      render: (automation) => (
        <span>
          {automation.enabled
            ? formatFiring(automation.next_firing)
            : t('automations.disabled')}
        </span>
      ),
    },
  ];

  const actions = (): TableAction<Automation>[] => [
    {
      icon: BsEye,
      label: () => t('common.view'),
      handler: (automation) => setEditing(automation),
    },
    ...(canDelete()
      ? [
          {
            icon: AiOutlineDelete,
            label: () => t('common.delete'),
            handler: (automation: Automation) => setPendingDelete(automation),
          },
        ]
      : []),
  ];

  onCleanup(() => setEditing(null));

  return (
    <div class={styles.page}>
      <Show
        when={canList()}
        fallback={
          <div class={styles.emptyState} data-testid="automations-no-access">
            <p>{t('automations.noAccess')}</p>
          </div>
        }
      >
        <p class={styles.pageDescription}>{t('automations.description')}</p>
        <TableView<number, Automation>
          title={t('automations.title')}
          resource="automations"
          params={[searchParams, setSearchParams]}
          fetchData={fetchData}
          ref={(ref) => (tableRef = ref)}
          toolbar={{
            searchPlaceholder: t('common.search'),
            mainAction: (
              <Button
                label={t('automations.new')}
                icon={BsPlus}
                color="primary"
                disabled={!canCreate()}
                onClick={() => setShowCreate(true)}
              />
            ),
          }}
          table={{
            cardLabels,
            columns,
            actions,
            actionsLabel: () => t('common.actions'),
            hideCheckboxes: true,
            defaultRowAction: {
              icon: BsEye,
              label: () => t('common.view'),
              handler: (automation: Automation) => setEditing(automation),
            },
          }}
          pagination={{ itemsPerPage: ITEMS_PER_PAGE }}
        />
      </Show>

      <Show when={showCreate()}>
        <Modal
          title={t('automations.new')}
          description={t('automations.newDescription')}
          onClose={() => setShowCreate(false)}
        >
          <form class={styles.form} onSubmit={create}>
            <label class={styles.field}>
              <span class={styles.fieldLabel}>{t('common.name')}</span>
              <input
                id="automation-name"
                type="text"
                value={newName()}
                maxLength={255}
                placeholder={t('automations.namePlaceholder')}
                onInput={(e) => setNewName(e.currentTarget.value)}
              />
            </label>
            <div class={styles.formActions}>
              <Button
                label={t('common.cancel')}
                color="secondary"
                onClick={() => setShowCreate(false)}
              />
              <Button
                label={t('common.create')}
                type="submit"
                color="primary"
                loading={creating()}
                disabled={!newName().trim()}
              />
            </div>
          </form>
        </Modal>
      </Show>

      <Show when={orgId() && editing()?.id} keyed>
        <AutomationEditor
          organizationId={orgId()!}
          automation={editing()!}
          canEdit={canUpdate()}
          serverSources={serverSources()}
          serverActions={serverActions()}
          onChange={applyUpdate}
          onClose={() => setEditing(null)}
        />
      </Show>

      <ConfirmDialog
        show={pendingDelete() !== null}
        title={t('automations.deleteTitle')}
        message={t('automations.deleteMessage', {
          name: pendingDelete()?.name || '',
        })}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default AutomationsPage;
