import { createSignal, createEffect, JSX, Show, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';

import {
  Button,
  DetailsSummary,
  DetailsSummaryChip,
  FormItem,
  SectionCard,
  formatBytes,
  formatDuration,
  formatRelativeTimeLocalized,
  formatTimestamp,
  useToast,
} from '@castmill/ui-common';

import { BsCheckLg, BsX } from 'solid-icons/bs';
import { JsonMedia } from '@castmill/player';
import { MediasUpdate } from '../services/medias.service';
import { MediaPreview } from './media-preview';
import { AddonStore } from '../../common/interfaces/addon-store';
import {
  MediaDimensions,
  metaDimensions,
  metaDuration,
  probeDimensions,
} from './media-dimensions';

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
          error = t('medias.details.nameRequired');
        } else if (value.length < 5) {
          error = t('medias.details.nameTooShort');
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

  const toast = useToast();
  const locale = () => props.store?.i18n?.locale?.();

  const [dimensions, setDimensions] = createSignal<MediaDimensions | undefined>(
    metaDimensions(props.media)
  );
  if (!dimensions()) {
    onCleanup(probeDimensions(props.media, setDimensions));
  }

  const typeLabel = () => {
    const mimetype = props.media.mimetype || '';
    if (mimetype.startsWith('image/')) return t('medias.details.types.image');
    if (mimetype.startsWith('video/')) return t('medias.details.types.video');
    return mimetype || t('common.notAvailable');
  };

  const relative = (value: string) =>
    formatRelativeTimeLocalized(value, locale());

  const chips = (): DetailsSummaryChip[] => {
    const result: DetailsSummaryChip[] = [];
    if (props.media.size !== undefined && props.media.size !== null) {
      result.push({
        label: formatBytes(props.media.size),
        title: t('common.size'),
      });
    }
    const size = dimensions();
    if (size) {
      result.push({
        label: `${size.width} × ${size.height}`,
        title: t('medias.details.dimensions'),
      });
    }
    const duration = metaDuration(props.media);
    if (duration) {
      result.push({
        label: formatDuration(duration),
        title: t('medias.details.duration'),
      });
    }
    if (props.media.inserted_at) {
      result.push({
        label: t('medias.details.added', {
          time: relative(props.media.inserted_at),
        }),
        title: `${t('common.addedOn')} ${formatTimestamp(props.media.inserted_at)}`,
      });
    }
    return result;
  };

  const updatedNote = () =>
    props.media.updated_at
      ? t('medias.details.updated', { time: relative(props.media.updated_at) })
      : undefined;

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
    <div class="media-details">
      <DetailsSummary
        class="media-summary"
        label={t('medias.details.summary')}
        pills={[
          {
            label: typeLabel(),
            title: props.media.mimetype,
            tone: 'info',
          },
        ]}
        note={updatedNote()}
        chips={chips()}
        copy={{
          value: String(props.media.id),
          label: t('medias.details.copyId'),
          prefix: t('common.id'),
          copiedMessage: t('medias.details.copied'),
          onError: () => toast.error(t('medias.details.copyFailed')),
        }}
      />

      <div class="media-details-layout">
        <MediaPreview
          media={props.media}
          previewClass="media-details-preview"
          t={t}
        />

        <SectionCard class="media-details-form" title={t('common.details')}>
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
                placeholder={t('medias.details.namePlaceholder')}
                onInput={(value: string | number | boolean) => {
                  const nextValue = String(value);
                  setName(nextValue);
                  validateField('name', nextValue);
                }}
              >
                <div class="error">{errors().get('name')}</div>
              </FormItem>
            </div>

            <Show when={props.actionsMount} fallback={actions()}>
              {(mount) => <Portal mount={mount()}>{actions()}</Portal>}
            </Show>
          </form>
        </SectionCard>
      </div>
    </div>
  );
};
