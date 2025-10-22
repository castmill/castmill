import { createSignal, createEffect } from 'solid-js';

import { Button, FormItem, Timestamp } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonPlaylist } from '@castmill/player';
import { PlaylistUpdate } from '../services/playlists.service';
import { AddonStore } from '../../common/interfaces/addon-store';

import './playlist-details.scss';

export const PlaylistDetails = (props: {
  playlist: JsonPlaylist;
  store?: AddonStore;
  onSubmit: (playlistUpdate: Partial<PlaylistUpdate>) => Promise<boolean>;
}) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal(props.playlist.name);
  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    if (fieldId === 'name') {
      if (!value) {
        error = t('playlists.errors.nameRequired');
      } else if (value.length < 3) {
        error = t('playlists.errors.nameMinLength');
      }
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    const hasModifiedName = name() !== props.playlist.name;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    // Just check name validity and if form is modified
    const nameValue = name();
    const hasValidName = nameValue.trim() !== '' && nameValue.length >= 3;
    const hasNoErrors = ![...errors().values()].some((e) => e);
    return hasValidName && hasNoErrors && isFormModified();
  };

  return (
    <div class="playlist-details">
      <div class="info">
        {t('common.addedOn')}{' '}
        <Timestamp value={props.playlist.inserted_at} mode="relative" />.{' '}
        {t('common.lastUpdatedOn')}{' '}
        <Timestamp value={props.playlist.updated_at} mode="relative" />.
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          // Validate name before submission
          validateField('name', name());

          if (isFormValid()) {
            if (
              await props.onSubmit({
                name: name(),
                description: '',
              })
            ) {
              setIsFormModified(false);
            }
          }
        }}
      >
        <div class="form-inputs">
          <FormItem
            label={t('common.name')}
            id="name"
            value={name()}
            placeholder={t('playlists.enterPlaylistName')}
            onInput={(value: string | number | boolean) => {
              const strValue = String(value);
              setName(strValue);
              validateField('name', strValue);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </div>

        <div class="actions">
          <Button
            label={t('common.update')}
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label={t('common.reset')}
            onClick={() => {
              setName(props.playlist.name);
              setIsFormModified(false);
              setErrors(new Map());
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </div>
  );
};
