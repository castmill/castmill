import { createSignal, onCleanup, For, Show, JSX, onMount, createEffect } from 'solid-js';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import './upload.scss';

import {
  AiOutlineUpload,
  AiOutlineDelete,
  AiOutlineCheck,
  AiOutlineWarning,
} from 'solid-icons/ai';

import { Button, IconButton, IconWrapper, useToast, formatBytes } from '@castmill/ui-common';
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

interface FileValidation {
  valid: boolean;
  warning?: string;
  error?: string;
}

interface FileValidations {
  [key: string]: FileValidation;
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
  const toast = useToast();

  const [files, setFiles] = createSignal<File[]>([]);
  const [messages, setMessages] = createSignal<Messages>({});
  const [progresses, setProgresses] = createSignal<Progresses>({});
  const [validations, setValidations] = createSignal<FileValidations>({});
  const [maxUploadSize, setMaxUploadSize] = createSignal<number>(2048 * 1024 * 1024); // Default 2GB in bytes

  // Fetch quota information on mount
  onMount(async () => {
    try {
      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/quotas`,
        {
          credentials: 'include',
        }
      );
      if (response.ok) {
        const quotas = await response.json();
        const maxUploadQuota = quotas.find((q: any) => q.resource === 'max_upload_size');
        if (maxUploadQuota) {
          // Quota is stored in MB, convert to bytes
          setMaxUploadSize(maxUploadQuota.max * 1024 * 1024);
        }
      }
    } catch (error) {
      console.error('Failed to fetch quotas:', error);
    }
  });

  // Validate file sizes whenever files or max upload size changes
  createEffect(() => {
    const currentFiles = files();
    const maxSize = maxUploadSize();
    const softLimitSize = Math.floor(maxSize / 2); // 50% of max size
    
    const newValidations: FileValidations = {};
    currentFiles.forEach((file) => {
      if (file.size > maxSize) {
        newValidations[file.name] = {
          valid: false,
          error: t('medias.upload.fileTooLarge', {
            fileSize: formatBytes(file.size),
            maxSize: formatBytes(maxSize),
          })
        };
      } else if (file.size > softLimitSize) {
        newValidations[file.name] = {
          valid: true,
          warning: t('medias.upload.largeFileWarning', {
            fileSize: formatBytes(file.size),
          })
        };
      } else {
        newValidations[file.name] = { valid: true };
      }
    });
    
    setValidations(newValidations);
  });

  // Helper to get count of valid files that can be uploaded
  const getValidFilesCount = () => {
    const currentValidations = validations();
    return files().filter((file) => currentValidations[file.name]?.valid).length;
  };

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const selectedFiles = Array.from(target.files).filter((file) =>
        supportedFileTypes.includes(file.type)
      );
      setFiles(selectedFiles);
      setProgresses({});
      setMessages({});
    }
  };

  const handleUpload = async () => {
    const currentFiles = files();
    const currentValidations = validations();
    
    // Filter out invalid files
    const validFiles = currentFiles.filter((file) => currentValidations[file.name]?.valid);
    
    if (validFiles.length === 0) {
      setMessages((m) => ({ ...m, global: t('medias.upload.noValidFiles') }));
      return;
    }

    // Track how many files we're uploading for completion check
    let uploadedCount = 0;
    const totalToUpload = validFiles.length;

    validFiles.forEach((file) => {
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

          // Complete the onboarding step for media upload
          props.store?.onboarding?.completeStep?.('upload_media');

          uploadedCount++;
          if (uploadedCount === totalToUpload) {
            props.onUploadComplete?.();
          }
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setMessages((m) => ({
            ...m,
            [file.name]: `Upload failed: ${errorData.error}`,
          }));
          
          uploadedCount++;
          if (uploadedCount === totalToUpload) {
            props.onUploadComplete?.();
          }
        }
      };

      xhr.onerror = () => {
        setMessages((m) => ({ ...m, [file.name]: t('medias.upload.uploadError') }));
        
        uploadedCount++;
        if (uploadedCount === totalToUpload) {
          props.onUploadComplete?.();
        }
      };

      xhr.send(formData);
    });
  };

  const [isDraggedOver, setIsDraggedOver] = createSignal(false);

  const setDropZoneElement = (dropZoneElement: HTMLDivElement) => {
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
          toast.error('No supported files found in the dropped files.');
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
      const newP = { ...p };
      delete newP[file.name];
      return newP;
    });
    setMessages((m) => {
      const newM = { ...m };
      delete newM[file.name];
      return newM;
    });
    setValidations((v) => {
      const newV = { ...v };
      delete newV[file.name];
      return newV;
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
                {(file) => {
                  const validation = validations()[file.name];
                  const hasError = validation && !validation.valid;
                  const hasWarning = validation && validation.valid && validation.warning;
                  
                  return (
                    <tr class="file" classList={{ 'file-error': hasError, 'file-warning': hasWarning }}>
                      <td class="filename-cell" title={file.name}>
                        {file.name}
                        <Show when={hasError || hasWarning}>
                          <div class="validation-message">
                            <Show when={hasError}>
                              <span class="error">
                                <IconWrapper icon={AiOutlineWarning} />
                                {validation.error}
                              </span>
                            </Show>
                            <Show when={hasWarning}>
                              <span class="warning">
                                <IconWrapper icon={AiOutlineWarning} />
                                {validation.warning}
                              </span>
                            </Show>
                          </div>
                        </Show>
                      </td>

                      <td>{formatBytes(file.size)}</td>
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
                  );
                }}
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
              Object.keys(messages()).length === getValidFilesCount()
                ? 'Close'
                : 'Cancel'
            }
            onClick={() => props.onCancel?.()}
            color="secondary"
            disabled={
              Object.keys(messages()).length > 0 &&
              Object.keys(messages()).length !== getValidFilesCount()
            }
          />
        </Show>
        {/* Change label to "Close" when all files have been uploaded */}
        <Button
          disabled={Object.keys(messages()).length === getValidFilesCount()}
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
