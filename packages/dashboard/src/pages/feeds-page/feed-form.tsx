import { Component, For, Show, createSignal } from 'solid-js';
import { Button, Dropdown, FormItem } from '@castmill/ui-common';

import { useI18n } from '../../i18n';
import {
  FeedAttrs,
  FeedMediaField,
  FeedMode,
} from '../../services/feeds.service';
import styles from './feeds-page.module.scss';

export interface FeedFormValues {
  name: string;
  description: string;
  mode: FeedMode;
  keep: number;
  schema: string;
  media_fields: FeedMediaField[];
}

export const emptyFeedForm = (): FeedFormValues => ({
  name: '',
  description: '',
  mode: 'list',
  keep: 10,
  schema: '',
  media_fields: [],
});

/**
 * Converts form values to API attributes, or returns an error key when the
 * schema is not a JSON object.
 */
export const feedFormToAttrs = (
  values: FeedFormValues
): { attrs: FeedAttrs } | { error: string } => {
  let schema: Record<string, unknown> | null = null;
  if (values.schema.trim() !== '') {
    try {
      const parsed = JSON.parse(values.schema);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'feeds.schemaInvalid' };
      }
      schema = parsed;
    } catch {
      return { error: 'feeds.schemaInvalid' };
    }
  }
  return {
    attrs: {
      name: values.name.trim(),
      description: values.description.trim() || null,
      mode: values.mode,
      keep: values.keep,
      schema,
      media_fields: values.media_fields
        .map((field) => ({
          path: field.path.trim(),
          mode: field.mode || 'copy',
        }))
        .filter((field) => field.path !== ''),
    },
  };
};

interface FeedFormProps {
  initial: FeedFormValues;
  submitLabel: string;
  saving?: boolean;
  disabled?: boolean;
  onSubmit: (attrs: FeedAttrs) => void;
  onCancel?: () => void;
}

/** Settings of a feed: name, type, entries to keep, schema and media fields. */
export const FeedForm: Component<FeedFormProps> = (props) => {
  const { t } = useI18n();
  const [values, setValues] = createSignal<FeedFormValues>({
    ...props.initial,
    media_fields: props.initial.media_fields.map((field) => ({ ...field })),
  });
  const [error, setError] = createSignal<string | null>(null);

  const update = (patch: Partial<FeedFormValues>) =>
    setValues({ ...values(), ...patch });

  const updateField = (index: number, patch: Partial<FeedMediaField>) =>
    update({
      media_fields: values().media_fields.map((field, i) =>
        i === index ? { ...field, ...patch } : field
      ),
    });

  const submit = (event: Event) => {
    event.preventDefault();
    const result = feedFormToAttrs(values());
    if ('error' in result) {
      setError(t(result.error));
      return;
    }
    setError(null);
    props.onSubmit(result.attrs);
  };

  return (
    <form class={styles.form} onSubmit={submit}>
      <FormItem
        label={t('common.name')}
        id="feed-name"
        value={values().name}
        disabled={props.disabled}
        onInput={(value) => update({ name: String(value) })}
      />
      <FormItem
        label={t('common.description')}
        id="feed-description"
        value={values().description}
        disabled={props.disabled}
        onInput={(value) => update({ description: String(value) })}
      />
      <Dropdown
        id="feed-mode"
        label={t('feeds.mode')}
        value={values().mode}
        items={[
          { value: 'list', name: t('feeds.modes.list') },
          { value: 'document', name: t('feeds.modes.document') },
        ]}
        onSelectChange={(value) =>
          update({ mode: (value as FeedMode) || 'list' })
        }
      />
      <p class={styles.muted}>{t(`feeds.modeHelp.${values().mode}`)}</p>

      <Show when={values().mode === 'list'}>
        <FormItem
          label={t('feeds.keep')}
          id="feed-keep"
          type="number"
          value={values().keep}
          disabled={props.disabled}
          onInput={(value) => update({ keep: Number(value) })}
        />
        <p class={styles.muted}>{t('feeds.keepHelp')}</p>
      </Show>

      <label class={styles.fieldLabel} for="feed-schema">
        {t('feeds.schema')}
      </label>
      <textarea
        id="feed-schema"
        class={styles.code}
        rows={5}
        value={values().schema}
        disabled={props.disabled}
        placeholder={'{ "title": "string", "image": "url" }'}
        onInput={(event) => update({ schema: event.currentTarget.value })}
      />
      <p class={styles.muted}>{t('feeds.schemaHelp')}</p>

      <fieldset class={styles.mediaFields}>
        <legend>{t('feeds.mediaFields')}</legend>
        <p class={styles.muted}>{t('feeds.mediaFieldsHelp')}</p>
        <For each={values().media_fields}>
          {(field, index) => (
            <div class={styles.mediaField}>
              <input
                type="text"
                aria-label={t('feeds.mediaPath')}
                placeholder="photos[].url"
                value={field.path}
                disabled={props.disabled}
                onInput={(event) =>
                  updateField(index(), { path: event.currentTarget.value })
                }
              />
              <select
                aria-label={t('feeds.mediaMode')}
                value={field.mode || 'copy'}
                disabled={props.disabled}
                onChange={(event) =>
                  updateField(index(), {
                    mode: event.currentTarget.value as 'copy' | 'link',
                  })
                }
              >
                <option value="copy">{t('feeds.mediaModes.copy')}</option>
                <option value="link">{t('feeds.mediaModes.link')}</option>
              </select>
              <Button
                label={t('common.remove')}
                color="secondary"
                disabled={props.disabled}
                onClick={() =>
                  update({
                    media_fields: values().media_fields.filter(
                      (_, i) => i !== index()
                    ),
                  })
                }
              />
            </div>
          )}
        </For>
        <Button
          label={t('feeds.addMediaField')}
          color="secondary"
          disabled={props.disabled}
          onClick={() =>
            update({
              media_fields: [
                ...values().media_fields,
                { path: '', mode: 'copy' },
              ],
            })
          }
        />
      </fieldset>

      <Show when={error()}>
        <p class={styles.error} role="alert">
          {error()}
        </p>
      </Show>

      <div class={styles.formActions}>
        <Show when={props.onCancel}>
          <Button
            label={t('common.cancel')}
            color="secondary"
            onClick={() => props.onCancel?.()}
          />
        </Show>
        <Button
          label={props.submitLabel}
          type="submit"
          color="primary"
          loading={props.saving}
          disabled={props.disabled || values().name.trim().length === 0}
        />
      </div>
    </form>
  );
};
