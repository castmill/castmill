import { createSignal, onCleanup, For, Show, JSX } from 'solid-js';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { authFetch } from '../../common/services/auth-fetch';

import {
  AiOutlineUpload,
  AiOutlineDelete,
  AiOutlineCheck,
} from 'solid-icons/ai';
import { Button, IconButton } from '@castmill/ui-common';

interface UploadComponentProps {
  baseUrl: string;
  organizationId: string;
  t?: (key: string, params?: Record<string, any>) => string;
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

const supportedJsonTypes = ['application/json', 'text/json'];
const supportedZipTypes = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
];
const supportedFileTypes = [...supportedJsonTypes, ...supportedZipTypes];

export const UploadComponent = (props: UploadComponentProps) => {
  const t = (key: string, params?: Record<string, any>) =>
    props.t?.(key, params) || key;

  const [files, setFiles] = createSignal<File[]>([]);
  const [messages, setMessages] = createSignal<Messages>({});
  const [progresses, setProgresses] = createSignal<Progresses>({});
  const [isDraggedOver, setIsDraggedOver] = createSignal(false);

  let fileInputRef: HTMLInputElement | undefined;
  let dropZoneRef: HTMLDivElement | undefined;

  const setProgress = (fileName: string, progress: number) => {
    setProgresses((prev) => ({ ...prev, [fileName]: progress }));
  };

  const setMessage = (fileName: string, message: string | JSX.Element) => {
    setMessages((prev) => ({ ...prev, [fileName]: message }));
  };

  const onFileChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const newFiles = Array.from(target.files || []);
    addFiles(newFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter((file) => {
      const isValidType =
        supportedFileTypes.includes(file.type) ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.zip');
      if (!isValidType) {
        setMessage(file.name, t('widgets.upload.invalidFileType'));
      }
      return isValidType;
    });

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const onFileRemove = (file: File) => {
    setFiles((prev) => prev.filter((f) => f !== file));
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages[file.name];
      return newMessages;
    });
    setProgresses((prev) => {
      const newProgresses = { ...prev };
      delete newProgresses[file.name];
      return newProgresses;
    });
  };

  const isZipFile = (file: File): boolean => {
    return file.name.endsWith('.zip') || supportedZipTypes.includes(file.type);
  };

  const uploadFile = async (file: File) => {
    try {
      // For ZIP files, we skip client-side JSON validation
      // The server will extract and validate the widget.json from the ZIP
      if (!isZipFile(file)) {
        // Read and validate JSON content
        const jsonContent = await file.text();
        const parsedJson = JSON.parse(jsonContent);

        // Basic validation for widget JSON structure
        if (!parsedJson.name || !parsedJson.template) {
          throw new Error(t('widgets.upload.invalidWidgetJson'));
        }
      }

      setProgress(file.name, 50);

      const formData = new FormData();
      formData.append('widget', file);

      const response = await authFetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/widgets`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle Ecto changeset errors
        if (errorData.errors && typeof errorData.errors === 'object') {
          const changeset = errorData.errors;
          const errorMessages = [];

          // Extract errors from changeset
          for (const [field, errors] of Object.entries(changeset)) {
            if (Array.isArray(errors)) {
              errorMessages.push(`${field}: ${errors.join(', ')}`);
            }
          }

          throw new Error(
            errorMessages.length > 0
              ? errorMessages.join('; ')
              : t('widgets.upload.validationFailed')
          );
        }

        throw new Error(
          errorData.error ||
            errorData.message ||
            t('widgets.upload.uploadFailed')
        );
      }

      setProgress(file.name, 100);
      setMessage(
        file.name,
        <div style="display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <AiOutlineCheck />
          <span>{t('widgets.upload.uploadedSuccessfully')}</span>
        </div>
      );

      const result = await response.json();
      props.onFileUpload?.(file.name, result);
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage(
        file.name,
        <div style="color: #ef4444; font-size: 0.9em; line-height: 1.4;">
          {error.message || t('widgets.upload.uploadError')}
        </div>
      );
    }
  };

  const handleUpload = async () => {
    const uploadPromises = files().map((file) => uploadFile(file));
    await Promise.all(uploadPromises);

    // Check if all files were processed
    const allProcessed = files().every(
      (file) => messages()[file.name] !== undefined
    );

    if (allProcessed) {
      setTimeout(() => {
        props.onUploadComplete?.();
      }, 1000);
    }
  };

  // Set up drag and drop
  onCleanup(() => {
    if (dropZoneRef) {
      // Cleanup will be handled automatically by the dropTargetForExternal
    }
  });

  // Configure drop target
  if (typeof window !== 'undefined' && dropZoneRef) {
    const cleanup = dropTargetForExternal({
      element: dropZoneRef,
      onDragEnter: () => setIsDraggedOver(true),
      onDragLeave: () => setIsDraggedOver(false),
      onDrop: ({ source }) => {
        setIsDraggedOver(false);
        // Extract files from DataTransferItems
        const fileItems = Array.from(source.items)
          .filter((item: DataTransferItem) => item.kind === 'file')
          .map((item: DataTransferItem) => item.getAsFile())
          .filter((file): file is File => file !== null);

        if (fileItems.length > 0) {
          addFiles(fileItems);
        }
      },
    });

    onCleanup(cleanup);
  }

  return (
    <div class="upload-widgets">
      <h2>{t('widgets.uploadWidget')}</h2>

      <div class="upload-description">
        <p>{t('widgets.upload.jsonDescription')}</p>

        <div style="background: #1e3a5f; border-left: 3px solid #3b82f6; padding: 0.75rem 1rem; margin: 1rem 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 0.9em; color: #93c5fd;">
            <strong>{t('widgets.upload.requiredFields')}:</strong>{' '}
            <code style="background: #2d4a6e; color: #93c5fd; padding: 2px 6px; border-radius: 3px;">
              name
            </code>{' '}
            {t('widgets.upload.and')}{' '}
            <code style="background: #2d4a6e; color: #93c5fd; padding: 2px 6px; border-radius: 3px;">
              template
            </code>
          </p>
        </div>

        <p class="example-title">{t('widgets.upload.exampleFormat')}:</p>
        <pre class="json-example">
          <code>
            {JSON.stringify(
              {
                name: 'My Widget',
                description: 'A sample widget',
                template: {
                  type: 'image',
                  name: 'image',
                  opts: {
                    url: { key: 'options.image.files[@target].uri' },
                  },
                },
                options_schema: {
                  image: {
                    type: 'ref',
                    required: true,
                    collection: 'medias|type:image',
                  },
                },
                translations: {
                  en: {
                    name: 'My Widget',
                    description: 'A sample widget',
                  },
                  es: {
                    name: 'Mi Widget',
                    description: 'Un widget de ejemplo',
                  },
                  de: {
                    name: 'Mein Widget',
                    description: 'Ein Beispiel-Widget',
                  },
                },
              },
              null,
              2
            )}
          </code>
        </pre>
      </div>

      <div
        ref={dropZoneRef}
        class={`file-input-container ${isDraggedOver() ? 'drag-over' : ''}`}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json,.zip,application/json,application/zip"
          onChange={onFileChange}
        />
        <div class="upload-hint">{t('widgets.upload.dragAndDropHint')}</div>
      </div>

      <Show when={files().length}>
        <div class="files-list">
          <For each={files()}>
            {(file) => (
              <div class="file-item">
                <div class="file-info">
                  <div class="file-name" title={file.name}>
                    {file.name}
                  </div>
                  <div class="file-size">{file.size} bytes</div>
                </div>

                <div class="file-status">
                  <Show
                    when={messages()[file.name]}
                    fallback={
                      <Show
                        when={progresses()[file.name] > 0}
                        fallback={
                          <span style="color: #6b7280;">
                            {t('widgets.upload.ready')}
                          </span>
                        }
                      >
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <progress
                            value={progresses()[file.name] || 0}
                            max="100"
                            style="flex: 1;"
                          >
                            {progresses()[file.name]}%
                          </progress>
                          <span style="font-size: 0.85em; color: #6b7280;">
                            {progresses()[file.name]}%
                          </span>
                        </div>
                      </Show>
                    }
                  >
                    {messages()[file.name]}
                  </Show>
                </div>

                <IconButton
                  onClick={() => onFileRemove(file)}
                  icon={AiOutlineDelete}
                  color="primary"
                  disabled={progresses()[file.name] > 0}
                />
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="buttons">
        <Show when={!!props.onCancel}>
          <Button
            label={
              Object.keys(messages()).length === files().length
                ? t('common.close')
                : t('common.cancel')
            }
            onClick={() => props.onCancel?.()}
            color="secondary"
            disabled={
              Object.keys(messages()).length > 0 &&
              Object.keys(messages()).length !== files().length
            }
          />
        </Show>

        <Button
          disabled={
            files().length === 0 ||
            Object.keys(messages()).length === files().length
          }
          label={t('widgets.uploadWidget')}
          onClick={handleUpload}
          icon={AiOutlineUpload}
          color="primary"
        />
      </div>
    </div>
  );
};
