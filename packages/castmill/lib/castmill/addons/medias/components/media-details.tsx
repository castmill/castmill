import { createSignal, createEffect, JSX, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

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
  /**
   * Element (e.g. the Drawer footer) that receives the Save/Reset actions so
   * they stay visible while the details scroll. Rendered inline when unset.
   */
  actionsMount?: HTMLElement;
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
    const hasModifiedName = name() !== props.media.name;
    setIsFormModified(hasModifiedName);
  });

  const isFormValid = () => {
    return ![...errors().values()].some((e) => e) && isFormModified();
  };

  const formId = `media-details-${props.media.id}`;

  const actions = (): JSX.Element => (
    <div class="actions">
      <Button
        label={t('common.save')}
        type="submit"
        form={formId}
        disabled={!isFormValid()}
        icon={BsCheckLg}
        color="success"
      />
      <Button
        label={t('common.reset')}
        onClick={() => {
          setName(props.media.name);
          setIsFormModified(false);
        }}
        icon={BsX}
        color="danger"
      />
    </div>
  );

  return (
    <>
      <div class="info">
        <span>Added on </span>{' '}
        <Timestamp value={props.media.inserted_at} mode="relative" />.{' '}
        <span>Last updated on </span>
        <Timestamp value={props.media.updated_at} mode="relative" />
      </div>
      <form
        id={formId}
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
            onInput={(value: string | number | boolean) => {
              const nextValue = String(value);
              setName(nextValue);
              validateField('name', nextValue);
            }}
          >
            <div class="error">{errors().get('name')}</div>
          </FormItem>
        </div>

        <MediaPreview media={props.media} />

        <Show when={props.actionsMount} fallback={actions()}>
          {(mount) => <Portal mount={mount()}>{actions()}</Portal>}
        </Show>
      </form>
    </>
  );
};
