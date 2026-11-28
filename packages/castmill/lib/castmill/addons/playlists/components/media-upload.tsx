import { Component, For, Show, createSignal, onCleanup } from 'solid-js';
import { AiOutlineUpload } from 'solid-icons/ai';
import { IconWrapper, Modal, ModalRef } from '@castmill/ui-common';
import type { JsonMedia } from '@castmill/player';

import { UploadComponent } from '../../medias/components/upload';
import { AddonStore } from '../../common/interfaces/addon-store';

import './media-upload.scss';

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
}

/**
 * MediaUpload
 *
 * A link that uploads a media in place, from a dialog on top of the current
 * one, so a widget can use a new image or video without leaving its settings.
 * The uploaded media is reported right away; its owning playlist view refreshes
 * it independently of this dialog's lifecycle.
 */
export const MediaUpload: Component<MediaUploadProps> = (props) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.store.i18n?.t(key, params) || key;

  const [open, setOpen] = createSignal(false);
  let modal: ModalRef | undefined;
  let uploaded: JsonMedia | undefined;
  let disposed = false;
  let dialogGeneration = 0;

  onCleanup(() => {
    disposed = true;
    dialogGeneration++;
  });

  const isCurrentDialog = (generation: number) =>
    !disposed && generation === dialogGeneration;

  const closeDialog = (generation: number) => {
    if (!isCurrentDialog(generation)) return;
    dialogGeneration++;
    uploaded = undefined;
    modal?.close();
    setOpen(false);
  };

  const openDialog = () => {
    uploaded = undefined;
    dialogGeneration++;
    setOpen(true);
  };

  return (
    <>
      <button type="button" class="media-upload-link" onClick={openDialog}>
        <IconWrapper icon={AiOutlineUpload} />
        <span>{props.label}</span>
      </button>
      <Show when={open()}>
        <For each={[dialogGeneration]}>
          {(generation) => {
            onCleanup(() => {
              if (dialogGeneration === generation) {
                dialogGeneration++;
                uploaded = undefined;
              }
            });

            return (
              <Modal
                ref={(ref: ModalRef) => (modal = ref)}
                title={props.label}
                description={t('playlists.mediaUpload.description')}
                closeLabel={t('common.close')}
                onCloseRequest={() => closeDialog(generation)}
                onClose={() => {
                  if (!isCurrentDialog(generation)) return;
                  dialogGeneration++;
                  uploaded = undefined;
                  setOpen(false);
                }}
                contentClass="media-upload-modal"
              >
                <UploadComponent
                  store={props.store}
                  baseUrl={props.baseUrl}
                  organizationId={props.organizationId}
                  mediaType={props.mediaType}
                  multiple={false}
                  onFileUpload={(_fileName: string, media: JsonMedia) => {
                    if (isCurrentDialog(generation)) uploaded = media;
                  }}
                  onUploadComplete={() => {
                    if (!isCurrentDialog(generation)) return;
                    const media = uploaded;
                    // Failed uploads keep the dialog open to show their errors.
                    if (!media) return;
                    props.onUpload(media);
                    closeDialog(generation);
                  }}
                  onCancel={() => closeDialog(generation)}
                />
              </Modal>
            );
          }}
        </For>
      </Show>
    </>
  );
};
