import { Component, For, Show, createSignal } from 'solid-js';
import {
  AiOutlineArrowDown,
  AiOutlineArrowUp,
  AiOutlineDelete,
  AiOutlineEdit,
} from 'solid-icons/ai';
import { BsPlayFill, BsPlus, BsExclamationTriangle } from 'solid-icons/bs';
import { RiEditorDraggable } from 'solid-icons/ri';
import { Button, ConfirmDialog, useCoarsePointer } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import type {
  Automation,
  AutomationRule,
  AutomationWarning,
} from '../../services/automations.service';
import { getAction, getSource, thenSummary, whenSummary } from './registry';
import { RuleDrawer } from './rule-drawer';
import { useSummaryContext } from './summary-context';

import styles from './automations.module.scss';

export interface RulesTabProps {
  automation: Automation;
  organizationId: string;
  canEdit: boolean;
  serverSources: string[] | null;
  serverActions: string[] | null;
  /** Persists the new rule list; resolves to false on failure. */
  onRulesChange: (rules: AutomationRule[]) => Promise<boolean>;
  onRun: (rule: AutomationRule) => Promise<void>;
}

/** Moves the item at `from` to index `to`. */
export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.min(to, next.length), 0, item);
  return next;
};

/** Human readable label for a "missing" capability such as "automation_sources:clock". */
export const useMissingCapabilityLabel = () => {
  const { t } = useI18n();
  return (missing: string) => {
    const [kind, type] = missing.split(':');
    const definition =
      kind === 'automation_sources' ? getSource(type) : getAction(type);
    return definition ? definition.label(t) : type || missing;
  };
};

export const RulesTab: Component<RulesTabProps> = (props) => {
  const { t } = useI18n();
  const summaryContext = useSummaryContext();
  const missingLabel = useMissingCapabilityLabel();
  // HTML5 drag-and-drop is unavailable on touch; the move buttons remain.
  const coarsePointer = useCoarsePointer();
  const canDrag = () => props.canEdit && !coarsePointer();

  const [editing, setEditing] = createSignal<{
    index: number | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = createSignal<number | null>(null);
  const [dragIndex, setDragIndex] = createSignal<number | null>(null);
  const [dropIndex, setDropIndex] = createSignal<number | null>(null);
  const [running, setRunning] = createSignal<string | null>(null);
  const [announcement, setAnnouncement] = createSignal('');

  const rules = () => props.automation.rules || [];

  const warningsFor = (rule: AutomationRule): AutomationWarning[] =>
    (props.automation.warnings || []).filter(
      (warning) => rule.id && warning.rule_id === rule.id
    );

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= rules().length || from === to) return;
    if (!(await props.onRulesChange(moveItem(rules(), from, to)))) return;
    setAnnouncement(
      t('automations.rules.moved', { from: from + 1, to: to + 1 })
    );
  };

  const saveRule = async (rule: AutomationRule) => {
    const current = editing();
    if (!current) return;
    const next =
      current.index === null
        ? [...rules(), rule]
        : rules().map((r, i) => (i === current.index ? rule : r));
    if (await props.onRulesChange(next)) setEditing(null);
  };

  const confirmDelete = async () => {
    const index = pendingDelete();
    setPendingDelete(null);
    if (index === null) return;
    await props.onRulesChange(rules().filter((_, i) => i !== index));
  };

  const run = async (rule: AutomationRule) => {
    if (!rule.id) return;
    setRunning(rule.id);
    try {
      await props.onRun(rule);
    } finally {
      setRunning(null);
    }
  };

  const onDrop = (index: number) => {
    const from = dragIndex();
    setDragIndex(null);
    setDropIndex(null);
    if (from !== null) move(from, index);
  };

  return (
    <div class={styles.rulesTab}>
      <span class={styles.visuallyHidden} aria-live="polite">
        {announcement()}
      </span>
      <Show
        when={rules().length > 0}
        fallback={
          <div class={styles.emptyState}>
            <p>{t('automations.rules.empty')}</p>
          </div>
        }
      >
        <ol class={styles.ruleList} aria-label={t('automations.rules.title')}>
          <For each={rules()}>
            {(rule, index) => (
              <li
                class={styles.ruleCard}
                classList={{
                  [styles.dragging]: dragIndex() === index(),
                  [styles.dropTarget]:
                    dropIndex() === index() && dragIndex() !== index(),
                }}
                data-testid="rule-card"
                draggable={canDrag()}
                onDragStart={(e) => {
                  setDragIndex(index());
                  e.dataTransfer?.setData('text/plain', String(index()));
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragIndex() === null) return;
                  e.preventDefault();
                  setDropIndex(index());
                }}
                onDragLeave={() => setDropIndex(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  onDrop(index());
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
              >
                <Show when={canDrag()}>
                  <span class={styles.dragHandle} aria-hidden="true">
                    <RiEditorDraggable />
                  </span>
                </Show>
                <div class={styles.ruleBody}>
                  <p class={styles.ruleLine}>
                    <span class={styles.ruleKeyword}>
                      {t('automations.rules.when')}
                    </span>
                    <span>{whenSummary(rule, summaryContext())}</span>
                  </p>
                  <p class={styles.ruleLine}>
                    <span class={styles.ruleKeyword}>
                      {t('automations.rules.then')}
                    </span>
                    <span>{thenSummary(rule, summaryContext())}</span>
                  </p>
                  <Show when={rule.cooldown_seconds > 0}>
                    <p class={styles.hint}>
                      {t('automations.summary.cooldown', {
                        seconds: rule.cooldown_seconds,
                      })}
                    </p>
                  </Show>
                  <Show when={warningsFor(rule).length > 0}>
                    <ul class={styles.warnings}>
                      <For each={warningsFor(rule)}>
                        {(warning) => (
                          <li>
                            <BsExclamationTriangle aria-hidden="true" />
                            {t('automations.warnings.missing', {
                              device: warning.device_name,
                              capability: missingLabel(warning.missing),
                            })}
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
                <div class={styles.ruleActions}>
                  <Show when={props.canEdit}>
                    <button
                      type="button"
                      class={styles.iconButton}
                      title={t('automations.rules.moveUp')}
                      aria-label={t('automations.rules.moveUpN', {
                        n: index() + 1,
                      })}
                      disabled={index() === 0}
                      onClick={() => move(index(), index() - 1)}
                    >
                      <AiOutlineArrowUp />
                    </button>
                    <button
                      type="button"
                      class={styles.iconButton}
                      title={t('automations.rules.moveDown')}
                      aria-label={t('automations.rules.moveDownN', {
                        n: index() + 1,
                      })}
                      disabled={index() === rules().length - 1}
                      onClick={() => move(index(), index() + 1)}
                    >
                      <AiOutlineArrowDown />
                    </button>
                  </Show>
                  <button
                    type="button"
                    class={styles.iconButton}
                    title={t('automations.rules.runNow')}
                    aria-label={t('automations.rules.runNowN', {
                      n: index() + 1,
                    })}
                    disabled={
                      !props.automation.enabled ||
                      !rule.id ||
                      running() === rule.id
                    }
                    onClick={() => run(rule)}
                  >
                    <BsPlayFill />
                  </button>
                  <Show when={props.canEdit}>
                    <button
                      type="button"
                      class={styles.iconButton}
                      title={t('common.edit')}
                      aria-label={t('automations.rules.editN', {
                        n: index() + 1,
                      })}
                      onClick={() => setEditing({ index: index() })}
                    >
                      <AiOutlineEdit />
                    </button>
                    <button
                      type="button"
                      class={styles.iconButton}
                      title={t('common.delete')}
                      aria-label={t('automations.rules.deleteN', {
                        n: index() + 1,
                      })}
                      onClick={() => setPendingDelete(index())}
                    >
                      <AiOutlineDelete />
                    </button>
                  </Show>
                </div>
              </li>
            )}
          </For>
        </ol>
      </Show>

      <Show when={props.canEdit}>
        <div class={styles.tabFooter}>
          <Button
            label={t('automations.rules.add')}
            icon={BsPlus}
            color="primary"
            onClick={() => setEditing({ index: null })}
          />
        </div>
      </Show>

      <Show when={editing()} keyed>
        {(current) => (
          <RuleDrawer
            organizationId={props.organizationId}
            rule={current.index === null ? undefined : rules()[current.index]}
            serverSources={props.serverSources}
            serverActions={props.serverActions}
            onSave={saveRule}
            onClose={() => setEditing(null)}
          />
        )}
      </Show>

      <ConfirmDialog
        show={pendingDelete() !== null}
        title={t('automations.rules.deleteTitle')}
        message={t('automations.rules.deleteMessage')}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
