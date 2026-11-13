import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import {
  Column,
  Pagination,
  SelectionActionBar,
  Table,
  useToast,
} from '@castmill/ui-common';
import { BsLockFill, BsSearch } from 'solid-icons/bs';
import {
  NetworkService,
  NetworkWidgetAccess,
  NetworkWidgetOrganization,
} from '../../../services/network.service';
import { useI18n } from '../../../i18n';
import { ConfirmAccessChange, accessErrorMessage } from './access-ui';
import styles from './widget-access.module.scss';
import { useTableCardLabels } from '../../../hooks/useTableCardLabels';

export type StatusFilter = 'all' | 'enabled' | 'disabled';
type BulkAction = 'enable' | 'disable';

export const ORGANIZATIONS_PAGE_SIZE = 20;

export const WidgetOrganizations: Component<{
  widget: NetworkWidgetAccess;
  widgetLabel: string;
  reloadKey: number;
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  onWidgetChange: (widget: NetworkWidgetAccess) => void;
  onSavingChange: (saving: boolean) => void;
  /** Blocks changes while the parent saves the widget's access mode. */
  blocked?: boolean;
  ref?: (search: HTMLInputElement) => void;
}> = (props) => {
  const { t } = useI18n();
  const cardLabels = useTableCardLabels();
  const toast = useToast();
  const [searchInput, setSearchInput] = createSignal('');
  const [search, setSearch] = createSignal('');
  const status = () => props.status;
  const [page, setPage] = createSignal(1);
  const [rows, setRows] = createSignal<NetworkWidgetOrganization[]>([]);
  const [total, setTotal] = createSignal(0);
  const [counts, setCounts] = createSignal({ total: 0, enabled: 0 });
  const [loading, setLoading] = createSignal(true);
  const [resultsReady, setResultsReady] = createSignal(false);
  const [saving, setSaving] = createSignal<Set<string>>(new Set());
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = createSignal<{
    action: BulkAction;
    search: string;
    count: number;
  } | null>(null);
  const [bulkSaving, setBulkSaving] = createSignal(false);
  let clearTableSelection: (() => void) | undefined;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const mutationPending = () =>
    saving().size > 0 || bulkSaving() || !!props.blocked;
  const resultsPending = () =>
    loading() || !resultsReady() || searchInput().trim() !== search();

  onCleanup(() => clearTimeout(debounce));

  const clearSelection = () => {
    clearTableSelection?.();
    setSelected(new Set<string>());
  };

  const load = async () => {
    const current = ++generation;
    setLoading(true);
    setResultsReady(false);
    try {
      const result = await NetworkService.listWidgetOrganizations(
        props.widget.id,
        {
          page: page(),
          pageSize: ORGANIZATIONS_PAGE_SIZE,
          search: search() || undefined,
          status:
            status() === 'all'
              ? undefined
              : (status() as 'enabled' | 'disabled'),
        }
      );
      if (current !== generation) return;
      const lastPage = Math.max(
        1,
        Math.ceil(result.pagination.total_count / ORGANIZATIONS_PAGE_SIZE)
      );
      if (page() > lastPage) {
        setPage(lastPage);
        return;
      }
      setRows(result.data);
      setTotal(result.pagination.total_count);
      setCounts(result.counts);
      setResultsReady(true);
      clearSelection();
    } catch {
      if (current === generation) {
        toast.error(t('network.widgets.errors.loadOrganizations'));
      }
    } finally {
      if (current === generation) setLoading(false);
    }
  };

  createEffect(on([() => props.reloadKey, search, status, page], load));

  createEffect(() => props.onSavingChange(saving().size > 0 || bulkSaving()));

  const onSearchInput = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      setPage(1);
      setSearch(value.trim());
    }, 250);
  };

  const changeStatus = (value: StatusFilter) => {
    setPage(1);
    props.onStatusChange(value);
  };

  createEffect(on(status, () => setPage(1), { defer: true }));

  const setRowEnabled = (id: string, enabled: boolean) =>
    setRows((items) =>
      items.map((org) => (org.id === id ? { ...org, enabled } : org))
    );

  const markSaving = (id: string, value: boolean) =>
    setSaving((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const locked = (organization: NetworkWidgetOrganization) =>
    organization.enabled && organization.in_use;

  const toggle = async (organization: NetworkWidgetOrganization) => {
    if (mutationPending() || resultsPending() || locked(organization)) return;
    const enabled = !organization.enabled;

    markSaving(organization.id, true);
    setRowEnabled(organization.id, enabled);
    setCounts((current) => ({
      ...current,
      enabled: current.enabled + (enabled ? 1 : -1),
    }));

    try {
      const updated = await NetworkService.updateWidgetOrganizations(
        props.widget.id,
        enabled ? { enable: [organization.id] } : { disable: [organization.id] }
      );
      props.onWidgetChange(updated);
      await load();
    } catch (error) {
      toast.error(accessErrorMessage(error, t));
      // Results may have been replaced by another query meanwhile: reload the
      // current one rather than reverting the optimistic change against it.
      await load();
    } finally {
      markSaving(organization.id, false);
    }
  };

  const applyChanges = async (
    changes: Parameters<typeof NetworkService.updateWidgetOrganizations>[1]
  ) => {
    if (mutationPending()) return;
    setBulkSaving(true);
    try {
      const updated = await NetworkService.updateWidgetOrganizations(
        props.widget.id,
        changes
      );
      props.onWidgetChange(updated);
      await load();
    } catch (error) {
      toast.error(accessErrorMessage(error, t));
    } finally {
      setBulkSaving(false);
    }
  };

  const applySelected = (action: BulkAction) => {
    if (mutationPending() || resultsPending()) return;
    const ids = [...selected()];
    const pending = rows().filter(
      (org) => ids.includes(org.id) && org.enabled !== (action === 'enable')
    );
    if (pending.length === 0) {
      clearSelection();
      return;
    }
    const pendingIds = pending.map((org) => org.id);
    void applyChanges(
      action === 'enable' ? { enable: pendingIds } : { disable: pendingIds }
    );
  };

  const applyMatching = () => {
    const action = bulkAction();
    setBulkAction(null);
    if (!action) return;
    void applyChanges({
      all_matching: true,
      enabled: action.action === 'enable',
      search: action.search || undefined,
    });
  };

  const matchingCount = (action: BulkAction) =>
    action === 'enable' ? counts().total - counts().enabled : counts().enabled;

  const confirmMatching = (action: BulkAction) => {
    if (mutationPending() || resultsPending()) return;
    setBulkAction({ action, search: search(), count: matchingCount(action) });
  };

  const statusOptions = (): {
    value: StatusFilter;
    label: string;
    count: number;
  }[] => [
    {
      value: 'all',
      label: t('network.widgets.organizations.statusAll'),
      count: counts().total,
    },
    {
      value: 'enabled',
      label: t('network.widgets.organizations.statusEnabled'),
      count: counts().enabled,
    },
    {
      value: 'disabled',
      label: t('network.widgets.organizations.statusDisabled'),
      count: counts().total - counts().enabled,
    },
  ];

  const columns = (): Column<string, NetworkWidgetOrganization>[] => [
    {
      key: 'name',
      title: t('network.widgets.organizations.columnName'),
      render: (organization) => (
        <span class={styles['organization-name']}>{organization.name}</span>
      ),
    },
    {
      key: 'in_use',
      title: t('network.widgets.organizations.columnUsage'),
      render: (organization) => (
        <Show
          when={organization.in_use}
          fallback={<span class={styles['muted']}>—</span>}
        >
          <span
            class={styles['badge-in-use']}
            title={
              locked(organization)
                ? t('network.widgets.organizations.inUseHint')
                : undefined
            }
          >
            <Show when={locked(organization)}>
              <BsLockFill aria-hidden="true" />
            </Show>
            {t('network.widgets.organizations.inUse')}
          </span>
        </Show>
      ),
    },
    {
      key: 'enabled',
      title: t('network.widgets.organizations.columnAccess'),
      render: (organization) => (
        <button
          type="button"
          role="switch"
          class={styles['access-switch']}
          aria-checked={organization.enabled}
          aria-label={t('network.widgets.organizations.accessFor', {
            name: organization.name,
          })}
          title={
            locked(organization)
              ? t('network.widgets.organizations.inUseHint')
              : undefined
          }
          disabled={
            locked(organization) || mutationPending() || resultsPending()
          }
          onClick={() => void toggle(organization)}
        >
          <span class={styles['access-switch-track']} aria-hidden="true">
            <span class={styles['access-switch-thumb']} />
          </span>
          <span class={styles['access-switch-label']}>
            {organization.enabled
              ? t('network.widgets.organizations.statusEnabled')
              : t('network.widgets.organizations.statusDisabled')}
          </span>
        </button>
      ),
    },
  ];

  return (
    <section class={styles['organizations']}>
      <div class={styles['organizations-toolbar']}>
        <label class={styles['search-field']}>
          <BsSearch aria-hidden="true" />
          <input
            ref={props.ref}
            type="search"
            value={searchInput()}
            onInput={(event) => onSearchInput(event.currentTarget.value)}
            placeholder={t('network.widgets.organizations.search')}
            aria-label={t('network.widgets.organizations.search')}
          />
        </label>

        <div
          class={styles['segmented']}
          role="group"
          aria-label={t('network.widgets.organizations.title')}
        >
          <For each={statusOptions()}>
            {(option) => (
              <button
                type="button"
                class={styles['segment']}
                aria-pressed={status() === option.value}
                onClick={() => changeStatus(option.value)}
              >
                {option.label}
                <span class={styles['segment-count']}>{option.count}</span>
              </button>
            )}
          </For>
        </div>
      </div>

      <div class={styles['bulk-actions']}>
        <span class={styles['muted']}>
          {search()
            ? t('network.widgets.organizations.matching', {
                count: counts().total,
              })
            : t('network.widgets.organizations.enabledOf', {
                count: counts().enabled,
                total: counts().total,
              })}
        </span>
        <div class={styles['bulk-buttons']}>
          <button
            type="button"
            class={styles['text-button']}
            disabled={
              mutationPending() ||
              resultsPending() ||
              matchingCount('enable') === 0
            }
            onClick={() => confirmMatching('enable')}
          >
            {t('network.widgets.organizations.enableAll', {
              count: matchingCount('enable'),
            })}
          </button>
          <button
            type="button"
            class={`${styles['text-button']} ${styles['text-button-danger']}`}
            disabled={
              mutationPending() ||
              resultsPending() ||
              matchingCount('disable') === 0
            }
            onClick={() => confirmMatching('disable')}
          >
            {t('network.widgets.organizations.disableAll', {
              count: matchingCount('disable'),
            })}
          </button>
        </div>
      </div>

      <div
        class={styles['organization-table']}
        classList={{ [styles['organization-table-loading']]: loading() }}
        aria-busy={loading()}
      >
        <Show
          when={rows().length > 0 || loading()}
          fallback={
            <p class={styles['empty']}>
              {search() || status() !== 'all'
                ? t('network.widgets.organizations.none')
                : t('network.widgets.organizations.noOrganizations')}
            </p>
          }
        >
          <Table<string, NetworkWidgetOrganization>
            cardLayout
            cardLabels={cardLabels}
            columns={columns}
            data={rows()}
            onRowSelect={(ids) => setSelected(new Set(ids))}
            clearSelectionRef={(clear) => (clearTableSelection = clear)}
          />
        </Show>
      </div>

      <div class={styles['table-footer']}>
        <span class={styles['muted']}>
          <Show when={total() > 0}>
            {t('network.widgets.organizations.range', {
              from: (page() - 1) * ORGANIZATIONS_PAGE_SIZE + 1,
              to: Math.min(page() * ORGANIZATIONS_PAGE_SIZE, total()),
              total: total(),
            })}
          </Show>
        </span>
        <Show when={total() > ORGANIZATIONS_PAGE_SIZE}>
          <Pagination
            totalItems={total()}
            itemsPerPage={ORGANIZATIONS_PAGE_SIZE}
            currentPage={page()}
            onPageChange={setPage}
          />
        </Show>
      </div>

      <SelectionActionBar
        count={selected().size}
        label={t('network.widgets.organizations.selectedCount', {
          count: selected().size,
        })}
        onDeselectAll={clearSelection}
      >
        <button
          type="button"
          class={styles['text-button']}
          disabled={mutationPending() || resultsPending()}
          onClick={() => applySelected('enable')}
        >
          {t('network.widgets.organizations.enableSelected')}
        </button>
        <button
          type="button"
          class={`${styles['text-button']} ${styles['text-button-danger']}`}
          disabled={mutationPending() || resultsPending()}
          onClick={() => applySelected('disable')}
        >
          {t('network.widgets.organizations.disableSelected')}
        </button>
      </SelectionActionBar>

      <Show when={bulkAction()} keyed>
        {(action) => (
          <ConfirmAccessChange
            title={t(
              action.action === 'enable'
                ? 'network.widgets.confirm.enableAllTitle'
                : 'network.widgets.confirm.disableAllTitle',
              { count: action.count }
            )}
            message={t(
              action.action === 'enable'
                ? 'network.widgets.confirm.enableAllMessage'
                : 'network.widgets.confirm.disableAllMessage',
              { widget: props.widgetLabel }
            )}
            confirmLabel={t(
              action.action === 'enable'
                ? 'network.widgets.confirm.enableAction'
                : 'network.widgets.confirm.disableAction'
            )}
            cancelLabel={t('common.cancel')}
            danger={action.action === 'disable'}
            onConfirm={applyMatching}
            onClose={() => setBulkAction(null)}
          />
        )}
      </Show>
    </section>
  );
};
