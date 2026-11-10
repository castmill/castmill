import {
  Component,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from 'solid-js';
import { BsExclamationTriangle, BsX } from 'solid-icons/bs';
import { Button } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import {
  AssignableResource,
  Automation,
  AutomationAssignments,
  AutomationsService,
} from '../../services/automations.service';
import { useMissingCapabilityLabel } from './rules-tab';

import styles from './automations.module.scss';

export const SEARCH_DEBOUNCE_MS = 300;

type Kind = 'devices' | 'channels';

interface PickerProps {
  kind: Kind;
  organizationId: string;
  selected: AssignableResource[];
  disabled: boolean;
  onChange: (selected: AssignableResource[]) => void;
  renderExtra?: (item: AssignableResource) => any;
}

const ResourcePicker: Component<PickerProps> = (props) => {
  const { t } = useI18n();
  const [search, setSearch] = createSignal('');
  const [results, setResults] = createSignal<AssignableResource[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sequence = 0;

  const load = async (query: string) => {
    const current = ++sequence;
    setLoading(true);
    try {
      const result = await AutomationsService.searchAssignable(
        props.organizationId,
        props.kind,
        query
      );
      if (current !== sequence) return;
      setResults(result.data);
      setFailed(false);
    } catch {
      if (current === sequence) setFailed(true);
    } finally {
      if (current === sequence) setLoading(false);
    }
  };

  createEffect(
    on(search, (query, previous) => {
      clearTimeout(timer);
      if (previous === undefined) load(query);
      else timer = setTimeout(() => load(query), SEARCH_DEBOUNCE_MS);
    })
  );
  onCleanup(() => clearTimeout(timer));

  const isSelected = (item: AssignableResource) =>
    props.selected.some((s) => String(s.id) === String(item.id));

  const toggle = (item: AssignableResource, checked: boolean) => {
    if (checked && !isSelected(item))
      props.onChange([...props.selected, { id: item.id, name: item.name }]);
    else if (!checked)
      props.onChange(
        props.selected.filter((s) => String(s.id) !== String(item.id))
      );
  };

  const title = () => t(`automations.assignments.${props.kind}`);

  return (
    <section class={styles.picker} aria-label={title()}>
      <h4>
        {title()} <span class={styles.count}>{props.selected.length}</span>
      </h4>

      <Show
        when={props.selected.length > 0}
        fallback={
          <p class={styles.hint}>
            {t(`automations.assignments.none.${props.kind}`)}
          </p>
        }
      >
        <ul class={styles.selectedList}>
          <For each={props.selected}>
            {(item) => (
              <li>
                <span class={styles.selectedName}>{item.name}</span>
                {props.renderExtra?.(item)}
                <Show when={!props.disabled}>
                  <button
                    type="button"
                    class={styles.iconButton}
                    aria-label={t('automations.assignments.remove', {
                      name: item.name,
                    })}
                    onClick={() => toggle(item, false)}
                  >
                    <BsX />
                  </button>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={!props.disabled}>
        <input
          type="search"
          class={styles.searchInput}
          placeholder={t(`automations.assignments.search.${props.kind}`)}
          aria-label={t(`automations.assignments.search.${props.kind}`)}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
        <div class={styles.results} aria-busy={loading()}>
          <Show when={failed()}>
            <p class={styles.hint}>{t('automations.assignments.loadFailed')}</p>
          </Show>
          <Show when={!loading() && !failed() && results().length === 0}>
            <p class={styles.hint}>{t('automations.assignments.noResults')}</p>
          </Show>
          <For each={results()}>
            {(item) => (
              <label class={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={isSelected(item)}
                  onChange={(e) => toggle(item, e.currentTarget.checked)}
                />
                {item.name}
              </label>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
};

export interface AssignmentsTabProps {
  automation: Automation;
  organizationId: string;
  canEdit: boolean;
  onSave: (assignments: AutomationAssignments) => Promise<boolean>;
}

export const AssignmentsTab: Component<AssignmentsTabProps> = (props) => {
  const { t } = useI18n();
  const missingLabel = useMissingCapabilityLabel();

  const fromAutomation = () => ({
    devices: (props.automation.devices || []).map((d) => ({
      id: d.id,
      name: d.name,
    })),
    channels: (props.automation.channels || []).map((c) => ({
      id: c.id,
      name: c.name,
    })),
  });

  const [devices, setDevices] = createSignal<AssignableResource[]>(
    fromAutomation().devices
  );
  const [channels, setChannels] = createSignal<AssignableResource[]>(
    fromAutomation().channels
  );
  const [saving, setSaving] = createSignal(false);

  const key = (list: AssignableResource[]) =>
    list.map((item) => String(item.id)).join(',');

  const dirty = () =>
    key(devices()) !== key(fromAutomation().devices) ||
    key(channels()) !== key(fromAutomation().channels);

  // One entry per device and missing capability (warnings are per rule).
  const uniqueWarnings = () => {
    const seen = new Set<string>();
    return (props.automation.warnings || []).filter((warning) => {
      const id = `${warning.device_id}|${warning.missing}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const deviceWarnings = (deviceId: string | number) =>
    uniqueWarnings().filter(
      (warning) => String(warning.device_id) === String(deviceId)
    );

  const indirectWarnings = () =>
    uniqueWarnings().filter(
      (warning) =>
        !devices().some((d) => String(d.id) === String(warning.device_id))
    );

  const save = async () => {
    setSaving(true);
    try {
      await props.onSave({
        devices: devices().map((d) => String(d.id)),
        channels: channels().map((c) => Number(c.id)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class={styles.assignmentsTab}>
      <p class={styles.hint}>{t('automations.assignments.description')}</p>
      <div class={styles.pickers}>
        <ResourcePicker
          kind="devices"
          organizationId={props.organizationId}
          selected={devices()}
          disabled={!props.canEdit}
          onChange={setDevices}
          renderExtra={(item) => (
            <For each={deviceWarnings(item.id)}>
              {(warning) => (
                <span
                  class={styles.warningBadge}
                  title={t('automations.warnings.missing', {
                    device: warning.device_name,
                    capability: missingLabel(warning.missing),
                  })}
                >
                  <BsExclamationTriangle aria-hidden="true" />
                  {t('automations.warnings.unsupported', {
                    capability: missingLabel(warning.missing),
                  })}
                </span>
              )}
            </For>
          )}
        />
        <ResourcePicker
          kind="channels"
          organizationId={props.organizationId}
          selected={channels()}
          disabled={!props.canEdit}
          onChange={setChannels}
        />
      </div>

      <Show when={indirectWarnings().length > 0}>
        <div class={styles.warningBox} role="status">
          <h4>{t('automations.warnings.viaChannels')}</h4>
          <ul class={styles.warnings}>
            <For each={indirectWarnings()}>
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
        </div>
      </Show>

      <Show when={props.canEdit}>
        <div class={styles.tabFooter}>
          <Button
            label={t('automations.assignments.save')}
            color="primary"
            loading={saving()}
            disabled={!dirty()}
            onClick={save}
          />
        </div>
      </Show>
    </div>
  );
};
