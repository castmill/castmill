import { createEffect, createSignal } from 'solid-js';

import { FormItem } from '@castmill/ui-common';
import { JsonPlaylist } from '@castmill/player';

import './playlist-details.scss';

const MIN_NAME_LENGTH = 3;

/**
 * Playlist name field that saves on blur or Enter (no save/reset buttons).
 * Escape, or leaving the field with an invalid name, restores the saved name.
 */
export const PlaylistNameField = (props: {
  playlist: JsonPlaylist;
  t: (key: string, params?: Record<string, any>) => string;
  onSubmit: (update: { name: string }) => Promise<boolean>;
}) => {
  const t = props.t;

  const [name, setName] = createSignal(props.playlist.name);
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  // Follow external renames while the user has no pending edit.
  let lastSavedName = props.playlist.name;
  createEffect(() => {
    const next = props.playlist.name;
    if (name() === lastSavedName) setName(next);
    lastSavedName = next;
  });

  const validate = (value: string) => {
    const trimmed = value.trim();
    const message = !trimmed
      ? t('playlists.errors.nameRequired')
      : trimmed.length < MIN_NAME_LENGTH
        ? t('playlists.errors.nameMinLength')
        : '';
    setError(message);
    return !message;
  };

  const revert = () => {
    setName(props.playlist.name);
    setError('');
  };

  const commit = async () => {
    if (saving()) return;
    const trimmed = name().trim();
    if (trimmed === props.playlist.name) {
      revert();
      return;
    }
    if (!validate(name())) {
      revert();
      return;
    }
    setSaving(true);
    try {
      if (await props.onSubmit({ name: trimmed })) setName(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      class="playlist-name-field"
      aria-busy={saving()}
      onFocusOut={() => void commit()}
      on:keydown={(event) => {
        const input = event.target as HTMLInputElement;
        if (event.key === 'Enter') {
          event.preventDefault();
          input.blur();
        } else if (event.key === 'Escape') {
          event.stopPropagation();
          revert();
          input.blur();
        }
      }}
    >
      <FormItem
        label={t('common.name')}
        id={`playlist-${props.playlist.id}-name`}
        value={name()}
        placeholder={t('playlists.enterPlaylistName')}
        disabled={saving()}
        onInput={(value: string | number | boolean) => {
          const next = String(value);
          setName(next);
          validate(next);
        }}
      >
        <div class="error">{error()}</div>
      </FormItem>
    </div>
  );
};
