import { Show } from 'solid-js';
import { JsonMedia } from '@castmill/player';

interface MediaPreviewProps {
  media: JsonMedia;
  previewClass?: string;
}

export const MediaPreview = (props: MediaPreviewProps) => {
  // Check if the preview file is a video based on mimetype
  const isVideoPreview = () => {
    const previewFile = props.media.files['preview'];
    return previewFile && previewFile.mimetype && previewFile.mimetype.startsWith('video/');
  };

  return (
    <div class={`preview ${props.previewClass || ''}`}>
      <Show
        when={props.media.files['preview']}
        fallback={<div class="placeholder">No preview available</div>}
      >
        <Show
          when={isVideoPreview()}
          fallback={
            <div
              class="image"
              style={{
                'background-image': `url(${props.media.files['preview'].uri})`,
              }}
            ></div>
          }
        >
          <video 
            src={props.media.files['preview'].uri} 
            controls 
            class="video-preview"
          ></video>
        </Show>
      </Show>
    </div>
  );
};