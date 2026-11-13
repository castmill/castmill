import { Component, Show, createEffect, createSignal, on } from 'solid-js';
import { Drawer, Tabs, useToast } from '@castmill/ui-common';
import { BsDisplay, BsListCheck } from 'solid-icons/bs';

import { useI18n } from '../../i18n';
import {
  Automation,
  AutomationAssignments,
  AutomationAttrs,
  AutomationRule,
  AutomationsService,
} from '../../services/automations.service';
import { AssignmentsTab } from './assignments-tab';
import { EnabledToggle } from './enabled-toggle';
import { loadPlaylistNames, referencedPlaylistIds } from './playlist-names';
import { RulesTab } from './rules-tab';

import styles from './automations.module.scss';

export interface AutomationEditorProps {
  organizationId: string;
  automation: Automation;
  canEdit: boolean;
  serverSources: string[] | null;
  serverActions: string[] | null;
  onChange: (automation: Automation) => void;
  onClose: () => void;
}

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const AutomationEditor: Component<AutomationEditorProps> = (props) => {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = createSignal(props.automation.name);
  const [saving, setSaving] = createSignal(false);
  let mutationQueue = Promise.resolve();
  let pendingMutations = 0;

  createEffect(
    on(
      () => props.automation.name,
      (value) => setName(value)
    )
  );

  createEffect(
    on(
      () => props.automation.rules,
      (rules) =>
        loadPlaylistNames(props.organizationId, referencedPlaylistIds(rules))
    )
  );

  const serializeMutation = <T,>(mutation: () => Promise<T>): Promise<T> => {
    pendingMutations++;
    setSaving(true);
    const result = mutationQueue.then(mutation, mutation);
    const finish = () => {
      pendingMutations--;
      setSaving(pendingMutations > 0);
    };
    mutationQueue = result.then(finish, finish);
    return result;
  };

  const update = (attrs: AutomationAttrs): Promise<boolean> =>
    serializeMutation(async () => {
      try {
        const updated = await AutomationsService.update(
          props.organizationId,
          props.automation.id,
          attrs
        );
        props.onChange(updated);
        return true;
      } catch (error) {
        toast.error(
          t('automations.errors.saveFailed', { error: errorText(error) })
        );
        return false;
      }
    });

  const saveName = async () => {
    const value = name().trim();
    if (!value) {
      setName(props.automation.name);
      return;
    }
    if (value === props.automation.name) return;
    if (await update({ name: value })) toast.success(t('automations.saved'));
  };

  const saveRules = async (rules: AutomationRule[]) => {
    const ok = await update({ rules });
    if (ok) toast.success(t('automations.rules.saved'));
    return ok;
  };

  const saveAssignments = (assignments: AutomationAssignments) =>
    serializeMutation(async () => {
      try {
        const updated = await AutomationsService.setAssignments(
          props.organizationId,
          props.automation.id,
          assignments
        );
        props.onChange(updated);
        toast.success(t('automations.assignments.saved'));
        return true;
      } catch (error) {
        toast.error(
          t('automations.errors.saveFailed', { error: errorText(error) })
        );
        return false;
      }
    });

  const runRule = async (rule: AutomationRule) => {
    if (!rule.id) return;
    try {
      const result = await AutomationsService.runRule(
        props.organizationId,
        props.automation.id,
        rule.id
      );
      toast.success(
        t('automations.rules.runSuccess', { count: result.devices })
      );
    } catch (error) {
      toast.error(
        t('automations.errors.runFailed', { error: errorText(error) })
      );
    }
  };

  return (
    <Drawer
      title={props.automation.name}
      description={t('automations.editorDescription')}
      closeButtonTitle={t('common.close')}
      onClose={props.onClose}
      size="lg"
    >
      <div class={styles.editorHeader}>
        <label class={styles.field}>
          <span class={styles.fieldLabel}>{t('common.name')}</span>
          <input
            type="text"
            value={name()}
            disabled={!props.canEdit || saving()}
            maxLength={255}
            onInput={(e) => setName(e.currentTarget.value)}
            onChange={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <EnabledToggle
          checked={props.automation.enabled}
          label={t('automations.enabled')}
          showLabel
          disabled={!props.canEdit || saving()}
          onChange={(enabled) => update({ enabled })}
        />
      </div>

      <Show when={!props.automation.enabled}>
        <p class={styles.hint}>{t('automations.disabledHint')}</p>
      </Show>

      <Tabs
        ariaLabel={t('common.sections')}
        tabs={[
          {
            icon: BsListCheck,
            title: () =>
              t('automations.tabs.rules', {
                count: props.automation.rules.length,
              }),
            content: () => (
              <RulesTab
                automation={props.automation}
                organizationId={props.organizationId}
                canEdit={props.canEdit && !saving()}
                serverSources={props.serverSources}
                serverActions={props.serverActions}
                onRulesChange={saveRules}
                onRun={runRule}
              />
            ),
          },
          {
            icon: BsDisplay,
            title: () =>
              t('automations.tabs.assignments', {
                count:
                  (props.automation.devices?.length || 0) +
                  (props.automation.channels?.length || 0),
              }),
            content: () => (
              <AssignmentsTab
                automation={props.automation}
                organizationId={props.organizationId}
                canEdit={props.canEdit && !saving()}
                onSave={saveAssignments}
              />
            ),
          },
        ]}
      />
    </Drawer>
  );
};
