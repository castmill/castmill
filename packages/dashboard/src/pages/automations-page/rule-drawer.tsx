// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
import { Component, For, Show, createMemo, createSignal } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Button, Drawer } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import type { AutomationRule } from '../../services/automations.service';
import {
  availableActions,
  availableSources,
  getAction,
  getSource,
  newRule,
  normalizeRule,
  validateRule,
} from './registry';
import type { ActionDefinition, SourceDefinition } from './registry-types';

import styles from './automations.module.scss';

export interface RuleDrawerProps {
  organizationId: string;
  /** Rule to edit; undefined creates a new rule. */
  rule?: AutomationRule;
  /** Types supported by the server (`null` = unknown, show all). */
  serverSources: string[] | null;
  serverActions: string[] | null;
  onSave: (rule: AutomationRule) => Promise<void> | void;
  onClose: () => void;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const TypePicker = <D extends SourceDefinition | ActionDefinition>(props: {
  label: string;
  types: D[];
  selected: string;
  onSelect: (type: string) => void;
}) => {
  const { t } = useI18n();
  return (
    <div class={styles.typeCards} role="radiogroup" aria-label={props.label}>
      <For each={props.types}>
        {(definition) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.selected === definition.type}
            class={styles.typeCard}
            classList={{ [styles.active]: props.selected === definition.type }}
            onClick={() => props.onSelect(definition.type)}
          >
            <span class={styles.typeIcon} aria-hidden="true">
              <Dynamic component={definition.icon} />
            </span>
            <span class={styles.typeText}>
              <strong>{definition.label(t)}</strong>
              <span class={styles.hint}>{definition.description(t)}</span>
            </span>
          </button>
        )}
      </For>
    </div>
  );
};

export const RuleDrawer: Component<RuleDrawerProps> = (props) => {
  const { t } = useI18n();

  const initial = () => {
    if (props.rule) return clone(props.rule);
    const source = availableSources(props.serverSources)[0];
    const action = availableActions(props.serverActions)[0];
    return newRule(source?.type, action?.type);
  };

  const [draft, setDraft] = createSignal<AutomationRule>(initial());
  const [saving, setSaving] = createSignal(false);

  const source = () => getSource(draft().when.source);
  const action = () => getAction(draft().then.action);

  const sourceTypes = () => {
    const list = availableSources(props.serverSources);
    // Keep the rule's current type visible even if the server list omits it.
    const current = source();
    return current && !list.includes(current) ? [current, ...list] : list;
  };
  const actionTypes = () => {
    const list = availableActions(props.serverActions);
    const current = action();
    return current && !list.includes(current) ? [current, ...list] : list;
  };

  const sourceErrors = createMemo(() => {
    const definition = source();
    return definition ? definition.validate(draft().when.config) : [];
  });
  const actionErrors = createMemo(() => {
    const definition = action();
    return definition ? definition.validate(draft().then.config) : [];
  });
  const errors = createMemo(() => validateRule(draft()));

  const selectSource = (type: string) => {
    if (type === draft().when.source) return;
    const definition = getSource(type)!;
    setDraft({
      ...draft(),
      when: {
        source: type,
        condition: definition.conditions[0] ?? '',
        config: definition.defaultConfig(),
      },
    });
  };

  const selectAction = (type: string) => {
    if (type === draft().then.action) return;
    const definition = getAction(type)!;
    setDraft({
      ...draft(),
      then: { action: type, config: definition.defaultConfig() },
    });
  };

  const save = async () => {
    if (errors().length > 0) return;
    setSaving(true);
    try {
      await props.onSave(normalizeRule(draft()));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={
        props.rule ? t('automations.rules.edit') : t('automations.rules.add')
      }
      closeButtonTitle={t('common.close')}
      onClose={props.onClose}
      size="lg"
      footer={
        <div class={styles.drawerFooter}>
          <Button
            label={t('common.cancel')}
            color="secondary"
            onClick={props.onClose}
          />
          <Button
            label={t('automations.rules.save')}
            color="primary"
            loading={saving()}
            disabled={errors().length > 0}
            onClick={save}
          />
        </div>
      }
    >
      <div class={styles.ruleForm} data-testid="rule-drawer">
        <section class={styles.step}>
          <h3>
            <span class={styles.stepNumber}>1</span>
            {t('automations.rules.when')}
          </h3>
          <TypePicker
            label={t('automations.rules.chooseSource')}
            types={sourceTypes()}
            selected={draft().when.source}
            onSelect={selectSource}
          />
          <Show
            when={source()}
            keyed
            fallback={
              <p class={styles.hint}>
                {t('automations.summary.unknownType', {
                  type: draft().when.source,
                })}
              </p>
            }
          >
            {(definition) => (
              <Dynamic
                component={definition.editor}
                config={draft().when.config}
                condition={draft().when.condition}
                conditions={definition.conditions}
                organizationId={props.organizationId}
                errors={sourceErrors()}
                onConditionChange={(condition: string) =>
                  setDraft({
                    ...draft(),
                    when: { ...draft().when, condition },
                  })
                }
                onChange={(config: unknown) =>
                  setDraft({ ...draft(), when: { ...draft().when, config } })
                }
              />
            )}
          </Show>
        </section>

        <section class={styles.step}>
          <h3>
            <span class={styles.stepNumber}>2</span>
            {t('automations.rules.then')}
          </h3>
          <TypePicker
            label={t('automations.rules.chooseAction')}
            types={actionTypes()}
            selected={draft().then.action}
            onSelect={selectAction}
          />
          <Show
            when={action()}
            keyed
            fallback={
              <p class={styles.hint}>
                {t('automations.summary.unknownType', {
                  type: draft().then.action,
                })}
              </p>
            }
          >
            {(definition) => (
              <Dynamic
                component={definition.editor}
                config={draft().then.config}
                organizationId={props.organizationId}
                errors={actionErrors()}
                onChange={(config: unknown) =>
                  setDraft({ ...draft(), then: { ...draft().then, config } })
                }
              />
            )}
          </Show>
        </section>

        <section class={styles.step}>
          <h3>
            <span class={styles.stepNumber}>3</span>
            {t('automations.rules.options')}
          </h3>
          <label class={styles.field}>
            <span class={styles.fieldLabel}>
              {t('automations.rules.cooldown')}
            </span>
            <input
              type="number"
              min="0"
              value={draft().cooldown_seconds}
              onInput={(e) =>
                setDraft({
                  ...draft(),
                  cooldown_seconds:
                    e.currentTarget.value === ''
                      ? NaN
                      : Number(e.currentTarget.value),
                })
              }
            />
            <span class={styles.hint}>
              {t('automations.rules.cooldownHint')}
            </span>
          </label>
          <Show when={errors().includes('automations.validation.cooldown')}>
            <p class={styles.errorText} role="alert">
              {t('automations.validation.cooldown')}
            </p>
          </Show>
        </section>
      </div>
    </Drawer>
  );
};
