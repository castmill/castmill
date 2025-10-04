import { createSignal, onCleanup, For, Show, JSX } from 'solid-js';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import './upload.scss';

import {
  AiOutlineUpload,
  AiOutlineDelete,
  AiOutlineCheck,
} from 'solid-icons/ai';
import { Button, IconButton, IconWrapper } from '@castmill/ui-common';
import { AddonStore } from '../../common/interfaces/addon-store';

interface UploadComponentProps {
  baseUrl: string;
  organizationId: string;
  store?: AddonStore;
  onFileUpload?: (fileName: string, result: any) => void;
  onCancel?: () => void;
  onUploadComplete?: () => void;
}

interface Progresses {
  [key: string]: number;
}

interface Messages {
  [key: string]: string | JSX.Element;
}

const supportedFileTypes = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
  'video/x-ms-wmv',
];

export const UploadComponent = (props: UploadComponentProps) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;

  const [files, setFiles] = createSignal<File[]>([]);
  const [messages, setMessages] = createSignal<Messages>({});
  const [progresses, setProgresses] = createSignal<Progresses>({});

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const selectedFiles = Array.from(target.files).filter((file) =>
        supportedFileTypes.includes(file.type)
      );
      console.log({ selectedFiles });
      setFiles(selectedFiles);
      setProgresses({});
      setMessages({});
    }
  };

  const handleUpload = async () => {
    const currentFiles = files();
    if (currentFiles.length === 0) {
      setMessages('Please select files first.');
      return;
    }

    currentFiles.forEach((file) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/medias`,
        true
      );
      xhr.withCredentials = true;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete =
            event.total > 0
              ? Math.round((event.loaded / event.total) * 100)
              : 0; // Ensuring division by zero is handled
          setProgresses((p) => ({ ...p, [file.name]: percentComplete }));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setMessages((m) => ({
            ...m,
            [file.name]: <IconWrapper icon={AiOutlineCheck} />,
          }));

          props.onFileUpload?.(file.name, response);

          if (Object.keys(messages()).length === files().length) {
            props.onUploadComplete?.();
          }
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setMessages((m) => ({
            ...m,
            [file.name]: `Upload failed: ${errorData.error}`,
          }));
        }
      };

      xhr.onerror = () => {
        setMessages((m) => ({ ...m, [file.name]: 'Error uploading file.' }));
      };

      xhr.send(formData);
    });
  };

  const [isDraggedOver, setIsDraggedOver] = createSignal(false);

  const setDropZoneElement = (dropZoneElement: HTMLDivElement) => {
    console.log('Creating drop zone effect', dropZoneElement);
    const cleanup = dropTargetForExternal({
      element: dropZoneElement,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: ({ source }) => {
        setIsDraggedOver(false);

        const droppedFiles = Array.from(source.items).filter(
          (file) =>
            file.kind === 'file' && supportedFileTypes.includes(file.type)
        );

        if (droppedFiles.length === 0) {
          alert('No supported files found in the dropped files.');
          return;
        }

        setFiles([
          ...files(),
          ...droppedFiles.map((file) => file.getAsFile()!),
        ]);
        setProgresses({});
        setMessages({});
      },
    });

    onCleanup(() => {
      cleanup();
    });
  };

  const onFileRemove = (file: File) => {
    setFiles(files().filter((f) => f !== file));
    setProgresses((p) => {
      delete p[file.name];
      return p;
    });
    setMessages((m) => {
      delete m[file.name];
      return m;
    });
  };

  return (
    <div class="upload-files">
      <div>
        <input
          type="file"
          id="file"
          class="file-input"
          multiple
          onChange={handleFileChange}
          accept={supportedFileTypes.join(',')}
        />
        <label for="file" class="file-label">
          Choose Files
        </label>
      </div>

      <div
        ref={setDropZoneElement}
        class="drop-zone"
        style={{
          'background-color': isDraggedOver() ? 'lightblue' : '#555',
        }}
        onDragOver={(e) => e.preventDefault()} // This is crucial for making the drop event work
      >
        Or Drag and drop files here...
      </div>
      <Show when={files().length}>
        <div class="files">
          <table>
            <thead>
              <tr>
                <th>{t('common.fileName')}</th>
                <th>{t('common.size')}</th>
                <th>{t('common.progress')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={files()}>
                {(file) => (
                  <tr class="file">
                    <td class="filename-cell" title={file.name}>
                      {file.name}
                    </td>

                    <td>{file.size} Bytes</td>
                    <td>
                      <Show
                        when={messages()[file.name]}
                        fallback={
                          <progress
                            value={progresses()[file.name] || 0}
                            max="100"
                          >
                            {progresses()[file.name]}%
                          </progress>
                        }
                      >
                        <div>{messages()[file.name]}</div>
                      </Show>
                    </td>
                    <td>
                      <IconButton
                        onClick={() => onFileRemove(file)}
                        icon={AiOutlineDelete}
                        color="primary"
                        disabled={progresses()[file.name] > 0}
                      />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
      <div class="buttons">
        <Show when={!!props.onCancel}>
          {/* Disable when files start to be uploaded */}
          <Button
            label={
              Object.keys(messages()).length === files().length
                ? 'Close'
                : 'Cancel'
            }
            onClick={() => props.onCancel?.()}
            color="secondary"
            disabled={
              Object.keys(messages()).length > 0 &&
              Object.keys(messages()).length !== files().length
            }
          />
        </Show>
        {/* Change label to "Close" when all files have been uploaded */}
        <Button
          disabled={Object.keys(messages()).length === files().length}
          label="Upload"
          onClick={handleUpload}
          icon={AiOutlineUpload}
          color="primary"
        />
      </div>
      <p>{messages().global}</p>
    </div>
  );
};
