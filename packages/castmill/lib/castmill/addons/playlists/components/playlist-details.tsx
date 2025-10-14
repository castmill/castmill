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
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = 'Name is required';
        } else if (value.length < 3) {
          error = 'Name must be at least 3 characters';
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    const hasModifiedName = name() !== props.playlist.name;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
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
          if (isFormValid()) {
            if (await props.onSubmit({ name: name(), description: '' })) {
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
            placeholder="Enter playlist name"
            onInput={(value: string) => {
              setName(value);
              validateField('name', value);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </div>

        <div class="actions">
          <Button
            label="Update"
            type="submit"
            disabled={!isFormValid()}
            icon={BsCheckLg}
            color="success"
          />
          <Button
            label="Reset"
            onClick={() => {
              setName(props.playlist.name);
              setIsFormModified(false);
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </div>
  );
};
