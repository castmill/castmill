import { createSignal, createEffect } from 'solid-js';

import { Button, FormItem, Timestamp } from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonMedia } from '@castmill/player';
import { MediasUpdate } from '../services/medias.service';
import { MediaPreview } from './media-preview';
import { AddonStore } from '../../common/interfaces/addon-store';

export const MediaDetails = (props: {
  media: JsonMedia;
  store?: AddonStore;
  onSubmit: (mediaUpdate: Partial<MediasUpdate>) => Promise<boolean>;
}) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [name, setName] = createSignal(props.media.name);

  const [isFormModified, setIsFormModified] = createSignal(false);
  const [errors, setErrors] = createSignal(new Map());

  const validateField = (fieldId: string, value: string) => {
    let error = '';
    switch (fieldId) {
      case 'name':
        if (!value) {
          error = 'Name is required';
        } else if (value.length < 5) {
          error = 'Name must be at least 5 characters';
        }
        break;
      default:
        error = '';
    }

    setErrors((prev) => new Map(prev).set(fieldId, error));
    return !error;
  };

  createEffect(() => {
    // We need to check both fields or create effect will not detect the dependencies.
    const hasModifiedName = name() !== props.media.name;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  return (
    <>
      <div class="info">
        <span>Added on </span> <Timestamp value={props.media.inserted_at} mode="relative" />.{' '}
        <span>Last updated on </span>
        <Timestamp value={props.media.updated_at} mode="relative" />
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isFormValid()) {
            if (await props.onSubmit({ name: name() })) {
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
            placeholder="Enter media name"
            onInput={(value: string) => {
              setName(value);
              validateField('name', value);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </div>

        <MediaPreview media={props.media} />

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
              setName(props.media.name);
              setIsFormModified(false);
            }}
            icon={BsX}
            color="danger"
          />
        </div>
      </form>
    </>
  );
};
