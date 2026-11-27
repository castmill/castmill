import { Component, Show, createSignal, onCleanup } from 'solid-js';
import { AiOutlineUpload } from 'solid-icons/ai';
import { IconWrapper, Modal, ModalRef } from '@castmill/ui-common';
import type { JsonMedia } from '@castmill/player';

import { UploadComponent } from '../../medias/components/upload';
import { AddonStore } from '../../common/interfaces/addon-store';
import { ResourcesService } from '../services/resources.service';

import './media-upload.scss';

/** How often an uploaded media is checked until it has been processed. */
export const MEDIA_POLL_INTERVAL_MS = 3000;
/** Stop checking after this many attempts (about 15 minutes). */
export const MEDIA_POLL_MAX_ATTEMPTS = 300;

const isProcessed = (media: JsonMedia) =>
  media.status === 'ready' || media.status === 'failed';

interface MediaUploadProps {
  store: AddonStore;
  baseUrl: string;
  organizationId: string;
  /** Only accept files of this kind, e.g. 'image' or 'video'. */
  mediaType?: string;
  /** Label of the link that opens the upload dialog. */
  label: string;
  /** Called with the new media as soon as it has been uploaded. */
  onUpload: (media: JsonMedia) => void;
  /** Called with the refreshed media once it has been processed. */
  onProcessed?: (media: JsonMedia) => void;
}

/**
 * MediaUpload
 *
 * A link that uploads a media in place, from a dialog on top of the current
 * one, so a widget can use a new image or video without leaving its settings.
 * The uploaded media is reported right away and again when processed, when
 * its thumbnail and other files are available.
 */
export const MediaUpload: Component<MediaUploadProps> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const [open, setOpen] = createSignal(false);
  let modal: ModalRef | undefined;
  let uploaded: JsonMedia | undefined;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  };

  onCleanup(() => {
    disposed = true;
    stopPolling();
  });

  const pollUntilProcessed = (id: JsonMedia['id'], attempt = 1) => {
    stopPolling();
    if (disposed || attempt > MEDIA_POLL_MAX_ATTEMPTS) return;
    pollTimer = setTimeout(async () => {
      pollTimer = undefined;
      try {
        const media = await ResourcesService.get<JsonMedia>(
          props.baseUrl,
          props.organizationId,
          'medias',
          id
        );
        if (disposed) return;
        if (isProcessed(media)) {
          props.onProcessed?.(media);
          return;
        }
      } catch (error) {
        console.warn('Failed to check the uploaded media:', error);
      }
      if (!disposed) pollUntilProcessed(id, attempt + 1);
    }, MEDIA_POLL_INTERVAL_MS);
  };

  const openDialog = () => {
    uploaded = undefined;
    setOpen(true);
  };

  return (
    <>
      <button type="button" class="media-upload-link" onClick={openDialog}>
        <IconWrapper icon={AiOutlineUpload} />
        <span>{props.label}</span>
      </button>
      <Show when={open()}>
        <Modal
          ref={(ref: ModalRef) => (modal = ref)}
          title={props.label}
          description={t('playlists.mediaUpload.description')}
          closeLabel={t('common.close')}
          onClose={() => setOpen(false)}
          contentClass="media-upload-modal"
        >
          <UploadComponent
            store={props.store}
            baseUrl={props.baseUrl}
            organizationId={props.organizationId}
            mediaType={props.mediaType}
            multiple={false}
            onFileUpload={(_fileName: string, media: JsonMedia) => {
              uploaded = media;
            }}
            onUploadComplete={() => {
              const media = uploaded;
              // Failed uploads keep the dialog open to show their errors.
              if (!media) return;
              modal?.close();
              props.onUpload(media);
              if (!isProcessed(media)) {
                pollUntilProcessed(media.id);
              }
            }}
            onCancel={() => modal?.close()}
          />
        </Modal>
      </Show>
    </>
  );
};
