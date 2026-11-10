import { Component, For, Show, createEffect, on } from 'solid-js';
import { A } from '@solidjs/router';
import { ComboBox } from '@castmill/ui-common';

import { baseUrl } from '../../../env';
import { useI18n } from '../../../i18n';
import { ChannelsService } from '../../../services/channels.service';
import type {
  InterruptConfig,
  InterruptPriority,
  InterruptStart,
} from '../../../services/automations.service';
import type { TypeEditorProps } from '../registry-types';
import {
  loadPlaylistNames,
  playlistName,
  rememberPlaylist,
} from '../playlist-names';
import {
  DEFAULT_MAX_WAIT_SECONDS,
  MAX_PLAYS,
  MAX_WAIT_LIMIT_SECONDS,
} from './interrupt-logic';

import styles from '../automations.module.scss';

const START_MODES: InterruptStart[] = ['immediately', 'after_current_item'];
const PRIORITIES: InterruptPriority[] = ['normal', 'high'];

const toInt = (value: string) => (value === '' ? NaN : Number(value));

interface PlaylistOption {
  id: number;
  name: string;
}

export const InterruptEditor: Component<TypeEditorProps<InterruptConfig>> = (
  props
) => {
  const { t } = useI18n();
  const id = `interrupt-${Math.random().toString(36).slice(2, 8)}`;

  const update = (patch: Partial<InterruptConfig>) =>
    props.onChange({ ...props.config, ...patch });

  createEffect(
    on(
      () => props.config.playlist_id,
      (playlistId) => {
        if (playlistId) loadPlaylistNames(props.organizationId, [playlistId]);
      }
    )
  );

  const selectedPlaylist = (): PlaylistOption | undefined => {
    const playlistId = props.config.playlist_id;
    if (!playlistId) return undefined;
    return {
      id: playlistId,
      name:
        playlistName(playlistId) ??
        t('automations.summary.playlistFallback', { id: playlistId }),
    };
  };

  const fetchPlaylists = async (
    page: number,
    pageSize: number,
    search: string
  ) => {
    const service = new ChannelsService(baseUrl, props.organizationId);
    const result = await service.fetchPlaylists({
      page: { num: page, size: pageSize },
      sortOptions: { key: 'name', direction: 'ascending' },
      search,
    });
    return {
      count: result.count,
      data: result.data.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
      })),
    };
  };

  return (
    <div class={styles.editor} data-testid="interrupt-editor">
      <div class={styles.field}>
        <ComboBox<PlaylistOption>
          id={`${id}-playlist`}
          label={t('automations.interrupt.playlist')}
          placeholder={t('automations.interrupt.choosePlaylist')}
          value={selectedPlaylist()}
          fetchItems={fetchPlaylists}
          renderItem={(item) => <span>{item.name}</span>}
          onSelect={(item) => {
            rememberPlaylist(item.id, item.name);
            update({ playlist_id: item.id });
          }}
        />
        <A
          class={styles.linkButton}
          href={`/org/${props.organizationId}/content/playlists`}
        >
          {t('automations.interrupt.createPlaylist')}
        </A>
      </div>

      <fieldset class={styles.fieldset}>
        <legend class={styles.fieldLabel}>
          {t('automations.interrupt.start')}
        </legend>
        <For each={START_MODES}>
          {(mode) => (
            <label class={styles.radioOption}>
              <input
                type="radio"
                name={`${id}-start`}
                value={mode}
                checked={props.config.start === mode}
                onChange={() =>
                  update(
                    mode === 'after_current_item'
                      ? {
                          start: mode,
                          max_wait_seconds:
                            props.config.max_wait_seconds ??
                            DEFAULT_MAX_WAIT_SECONDS,
                        }
                      : { start: mode }
                  )
                }
              />
              <span>
                <strong>{t(`automations.interrupt.startModes.${mode}`)}</strong>
                <span class={styles.hint}>
                  {t(`automations.interrupt.startHints.${mode}`)}
                </span>
              </span>
            </label>
          )}
        </For>
      </fieldset>

      <Show when={props.config.start === 'after_current_item'}>
        <label class={styles.field}>
          <span class={styles.fieldLabel}>
            {t('automations.interrupt.maxWait')}
          </span>
          <input
            type="number"
            min="0"
            max={MAX_WAIT_LIMIT_SECONDS}
            value={props.config.max_wait_seconds ?? DEFAULT_MAX_WAIT_SECONDS}
            onInput={(e) =>
              update({ max_wait_seconds: toInt(e.currentTarget.value) })
            }
          />
          <span class={styles.hint}>
            {t('automations.interrupt.maxWaitHint')}
          </span>
        </label>
      </Show>

      <label class={styles.field}>
        <span class={styles.fieldLabel}>
          {t('automations.interrupt.plays')}
        </span>
        <input
          type="number"
          min="1"
          max={MAX_PLAYS}
          value={props.config.plays}
          onInput={(e) => update({ plays: toInt(e.currentTarget.value) })}
        />
        <span class={styles.hint}>{t('automations.interrupt.playsHint')}</span>
      </label>

      <fieldset class={styles.fieldset}>
        <legend class={styles.fieldLabel}>
          {t('automations.interrupt.priority')}
        </legend>
        <For each={PRIORITIES}>
          {(priority) => (
            <label class={styles.radioOption}>
              <input
                type="radio"
                name={`${id}-priority`}
                value={priority}
                checked={props.config.priority === priority}
                onChange={() => update({ priority })}
              />
              <span>
                <strong>
                  {t(`automations.interrupt.priorities.${priority}`)}
                </strong>
                <span class={styles.hint}>
                  {t(`automations.interrupt.priorityHints.${priority}`)}
                </span>
              </span>
            </label>
          )}
        </For>
      </fieldset>

      <Show when={props.errors.length > 0}>
        <ul class={styles.errors} role="alert">
          <For each={props.errors}>{(error) => <li>{t(error)}</li>}</For>
        </ul>
      </Show>
    </div>
  );
};
