/**
 * Organization-level integration settings (e.g. the agency and office IDs that
 * every property listing widget of the organization uses). Only network admins
 * see and change them.
 */
import { Component, For, Show, createSignal, onMount } from 'solid-js';
import {
  Button,
  FormItem,
  HttpError,
  Modal,
  useToast,
} from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import {
  IntegrationSettingError,
  IntegrationSettingField,
  IntegrationSettings,
  IntegrationSettingValue,
  NetworkService,
  Organization,
} from '../../services/network.service';
import styles from './network.module.scss';

type FormValue = string | boolean;
type FormValues = Record<string, FormValue>;

/** Fields in declaration order (`order`, then name). */
export const orderedFields = (schema: IntegrationSettings['schema']) =>
  Object.entries(schema).sort(
    ([a, fa], [b, fb]) =>
      (fa.order ?? 1000) - (fb.order ?? 1000) || a.localeCompare(b)
  );

/** Converts stored settings to form values (lists become one value per line). */
export const toFormValues = (definition: IntegrationSettings): FormValues =>
  Object.fromEntries(
    orderedFields(definition.schema).map(([name, field]) => {
      const value = definition.settings[name];
      if (field.type === 'boolean') return [name, value === true];
      if (field.type === 'list')
        return [name, Array.isArray(value) ? value.join('\n') : ''];
      return [name, value === undefined || value === null ? '' : String(value)];
    })
  );

/** Converts form values to the settings payload. */
export const toSettings = (
  schema: IntegrationSettings['schema'],
  values: FormValues
): Record<string, IntegrationSettingValue> => {
  const settings: Record<string, IntegrationSettingValue> = {};
  for (const [name, field] of Object.entries(schema)) {
    const value = values[name];
    if (field.type === 'boolean') {
      settings[name] = value === true;
    } else if (field.type === 'list') {
      settings[name] = String(value ?? '')
        .split(/\r\n?|\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (field.type === 'number') {
      const text = String(value ?? '').trim();
      // Invalid numbers are sent as text so the server reports them.
      if (text !== '')
        settings[name] = isNaN(Number(text)) ? text : Number(text);
    } else {
      settings[name] = String(value ?? '');
    }
  }
  return settings;
};

interface OrganizationIntegrationSettingsProps {
  organization: Organization;
  onClose: () => void;
}

export const OrganizationIntegrationSettings: Component<
  OrganizationIntegrationSettingsProps
> = (props) => {
  const { t } = useI18n();
  const toast = useToast();
  const [definitions, setDefinitions] = createSignal<
    IntegrationSettings[] | null
  >(null);
  const [values, setValues] = createSignal<Record<string, FormValues>>({});
  const [errors, setErrors] = createSignal<
    Record<string, Record<string, IntegrationSettingError>>
  >({});
  const [saving, setSaving] = createSignal<string | null>(null);

  const text = (key: string, params?: Record<string, string | number>) =>
    t(`network.organizations.integrationSettings.${key}`, params);

  onMount(async () => {
    try {
      const list = await NetworkService.listIntegrationSettings(
        props.organization.id
      );
      setValues(Object.fromEntries(list.map((d) => [d.key, toFormValues(d)])));
      setDefinitions(list);
    } catch {
      toast.error(text('loadError'));
      setDefinitions([]);
    }
  });

  const setValue = (key: string, name: string, value: FormValue) =>
    setValues((all) => ({ ...all, [key]: { ...all[key], [name]: value } }));

  const hasSettings = (definition: IntegrationSettings) =>
    Object.keys(definition.settings || {}).length > 0;

  const replaceSettings = (
    key: string,
    settings: IntegrationSettings['settings']
  ) => {
    const updated = definitions()!.map((d) =>
      d.key === key ? { ...d, settings } : d
    );
    setDefinitions(updated);
    const definition = updated.find((d) => d.key === key)!;
    setValues((all) => ({ ...all, [key]: toFormValues(definition) }));
  };

  const save = async (definition: IntegrationSettings, event: Event) => {
    event.preventDefault();
    setSaving(definition.key);
    setErrors((all) => ({ ...all, [definition.key]: {} }));
    try {
      const settings = await NetworkService.updateIntegrationSettings(
        props.organization.id,
        definition.key,
        toSettings(definition.schema, values()[definition.key] || {})
      );
      replaceSettings(definition.key, settings);
      toast.success(text('saved'));
    } catch (error) {
      if (error instanceof HttpError && error.status === 422) {
        setErrors((all) => ({
          ...all,
          [definition.key]: (error.details || {}) as Record<
            string,
            IntegrationSettingError
          >,
        }));
        toast.error(text('invalid'));
      } else {
        toast.error(
          text('saveError', { message: (error as Error)?.message || '' })
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const remove = async (definition: IntegrationSettings) => {
    setSaving(definition.key);
    try {
      await NetworkService.deleteIntegrationSettings(
        props.organization.id,
        definition.key
      );
      replaceSettings(definition.key, {});
      setErrors((all) => ({ ...all, [definition.key]: {} }));
      toast.success(text('removed'));
    } catch (error) {
      toast.error(
        text('saveError', { message: (error as Error)?.message || '' })
      );
    } finally {
      setSaving(null);
    }
  };

  const fieldInput = (
    definition: IntegrationSettings,
    name: string,
    field: IntegrationSettingField
  ) => {
    const id = `integration-setting-${definition.key}-${name}`;
    const value = () => values()[definition.key]?.[name];
    const error = () => errors()[definition.key]?.[name];

    return (
      <FormItem
        id={id}
        label={`${field.label || name}${field.required ? ' *' : ''}`}
        type={field.type === 'list' ? 'textarea' : field.type}
        rows={field.type === 'list' ? 3 : undefined}
        step={field.type === 'number' ? 'any' : undefined}
        parseNumber={false}
        placeholder={field.placeholder}
        value={value() ?? (field.type === 'boolean' ? false : '')}
        onInput={(input) =>
          setValue(
            definition.key,
            name,
            typeof input === 'number' ? String(input) : input
          )
        }
        description={
          [field.description, field.type === 'list' ? text('listHelp') : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <Show when={error()}>
          <div class="error" role="alert">
            {text(`errors.${error()}`)}
          </div>
        </Show>
      </FormItem>
    );
  };

  return (
    <Modal
      title={text('title', { name: props.organization.name })}
      description={text('description')}
      onClose={props.onClose}
    >
      <div class={styles['settings-modal']}>
        <Show when={definitions()} fallback={<p>{t('common.loading')}</p>}>
          {(list) => (
            <Show
              when={list().length > 0}
              fallback={<p class={styles['settings-help']}>{text('empty')}</p>}
            >
              <For each={list()}>
                {(definition) => (
                  <form
                    class={styles['settings-section']}
                    data-testid={`integration-settings-${definition.key}`}
                    onSubmit={(event) => save(definition, event)}
                  >
                    <h3>{definition.name || definition.key}</h3>
                    <Show when={definition.description}>
                      <p class={styles['settings-help']}>
                        {definition.description}
                      </p>
                    </Show>
                    <For each={orderedFields(definition.schema)}>
                      {([name, field]) => fieldInput(definition, name, field)}
                    </For>
                    <div class={styles['settings-actions']}>
                      <Button
                        label={t('common.save')}
                        type="submit"
                        color="primary"
                        disabled={saving() !== null}
                      />
                      <Show when={hasSettings(definition)}>
                        <Button
                          label={text('remove')}
                          color="danger"
                          disabled={saving() !== null}
                          onClick={() => void remove(definition)}
                        />
                      </Show>
                    </div>
                  </form>
                )}
              </For>
            </Show>
          )}
        </Show>
      </div>
    </Modal>
  );
};
