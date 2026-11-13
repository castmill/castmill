import { Show } from 'solid-js';
import { JsonMedia } from '@castmill/player';

/**
 * Props for the MediaPreview component.
 *
 * @property media - The media object containing details about the preview, including files and metadata.
 * @property previewClass - An optional CSS class to apply custom styling to the preview container.
 * @property t - Translation function used for the placeholder text.
 */
interface MediaPreviewProps {
  media: JsonMedia;
  previewClass?: string;
  t?: (key: string, params?: Record<string, any>) => string;
}

export const MediaPreview = (props: MediaPreviewProps) => {
  const t = (key: string) => props.t?.(key) ?? key;
  const previewFile = () => props.media.files?.['preview'];

  // Check if the preview file is a video based on mimetype
  const isVideoPreview = () => !!previewFile()?.mimetype?.startsWith('video/');

  return (
    <div class={`preview ${props.previewClass || ''}`.trim()}>
      <Show
        when={previewFile()}
        fallback={
          <div class="placeholder">{t('medias.details.noPreview')}</div>
        }
      >
        {(file) => (
          <Show
            when={isVideoPreview()}
            fallback={
              <img
                class="preview-media image-preview"
                src={file().uri}
                alt={props.media.name}
              />
            }
          >
            <video
              class="preview-media video-preview"
              src={file().uri}
              controls
              playsinline
              preload="metadata"
            ></video>
          </Show>
        )}
      </Show>
    </div>
  );
};
