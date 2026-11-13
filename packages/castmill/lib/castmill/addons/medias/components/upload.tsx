import {
  createSignal,
  onCleanup,
  For,
  Show,
  JSX,
  onMount,
  createEffect,
  createUniqueId,
} from 'solid-js';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';
import { authFetch, getAuthToken } from '../../common/services/auth-fetch';
import './upload.scss';

import {
  AiOutlineUpload,
  AiOutlineDelete,
  AiOutlineCheck,
  AiOutlineWarning,
  AiOutlineCamera,
} from 'solid-icons/ai';

import {
  Button,
  IconButton,
  IconWrapper,
  useToast,
  formatBytes,
} from '@castmill/ui-common';
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

// Some mobile pickers (notably older Android browsers) report an empty or
// generic MIME type, so fall back to the file extension.
const mimeTypesByExtension: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  wmv: 'video/x-ms-wmv',
};

export const resolveSupportedFile = (file: File): File | undefined => {
  if (supportedFileTypes.includes(file.type)) {
    return file;
  }
  if (file.type && file.type !== 'application/octet-stream') {
    return undefined;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const type = mimeTypesByExtension[extension];
  return type
    ? new File([file], file.name, { type, lastModified: file.lastModified })
    : undefined;
};

export const partitionSupportedFiles = (candidates: File[]) => {
  const supported: File[] = [];
  let skipped = 0;
  candidates.forEach((file) => {
    const resolved = resolveSupportedFile(file);
    if (resolved) {
      supported.push(resolved);
    } else {
      skipped++;
    }
  });
  return { supported, skipped };
};

export const UploadComponent = (props: UploadComponentProps) => {
  // Get i18n functions from store
  const t = (key: string, params?: Record<string, any>) =>
    props.store?.i18n?.t(key, params) || key;
  const toast = useToast();
  const fileInputId = `upload-files-${createUniqueId()}`;
  const cameraInputId = `upload-camera-${createUniqueId()}`;

  const [files, setFiles] = createSignal<File[]>([]);
  const [messages, setMessages] = createSignal<Messages>({});
  const [progresses, setProgresses] = createSignal<Progresses>({});
  const [validations, setValidations] = createSignal<FileValidations>({});
  const [isUploading, setIsUploading] = createSignal(false);
  const [maxUploadSize, setMaxUploadSize] = createSignal<number>(
    2048 * 1024 * 1024
  ); // Default 2GB in bytes

  // Fetch quota information on mount
  onMount(async () => {
    try {
      const response = await authFetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/quotas`
      );
      if (response.ok) {
        const quotas = await response.json();
        const maxUploadQuota = quotas.find(
          (q: any) => q.resource === 'max_upload_size'
        );
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
          }),
        };
      } else if (file.size > softLimitSize) {
        newValidations[file.name] = {
          valid: true,
          warning: t('medias.upload.largeFileWarning', {
            fileSize: formatBytes(file.size),
          }),
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
    return files().filter((file) => currentValidations[file.name]?.valid)
      .length;
  };

  // Helper to get count of completed file uploads (excluding global messages)
  const getCompletedFilesCount = () => {
    const msgs = messages();
    return Object.keys(msgs).filter((key) => key !== 'global').length;
  };

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      const { supported, skipped } = partitionSupportedFiles(
        Array.from(target.files)
      );
      if (skipped > 0) {
        toast.warning(
          t('medias.upload.unsupportedSkipped', { count: skipped })
        );
      }
      // The camera input appends captures so several shots can be queued.
      setFiles(
        target.dataset.append === 'true'
          ? [...files(), ...supported]
          : supported
      );
      setProgresses({});
      setMessages({});
      // Allow picking the same file (or taking another photo) again
      target.value = '';
    }
  };

  const handleUpload = async () => {
    if (isUploading()) {
      return;
    }

    const currentFiles = files();
    const currentValidations = validations();

    // Filter out invalid files
    const validFiles = currentFiles.filter(
      (file) => currentValidations[file.name]?.valid
    );

    if (validFiles.length === 0) {
      setMessages((m) => ({ ...m, global: t('medias.upload.noValidFiles') }));
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;
    const totalToUpload = validFiles.length;
    const markUploadCompleted = () => {
      uploadedCount++;
      if (uploadedCount === totalToUpload) {
        setIsUploading(false);
        props.onUploadComplete?.();
      }
    };

    validFiles.forEach((file) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/medias`,
        true
      );

      // Attach Bearer token for authentication (cookies are no longer used)
      const token = getAuthToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

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
        try {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            setMessages((m) => ({
              ...m,
              [file.name]: <IconWrapper icon={AiOutlineCheck} />,
            }));

            props.onFileUpload?.(file.name, response);

            // Complete the onboarding step for media upload
            props.store?.onboarding?.completeStep?.('upload_media');
          } else {
            let errorMessage: string;
            try {
              const errorData = JSON.parse(xhr.responseText);
              errorMessage =
                errorData.error ||
                errorData.message ||
                xhr.statusText ||
                t('medias.upload.unknownError');
            } catch {
              errorMessage =
                xhr.statusText ||
                t('medias.upload.serverError', { status: xhr.status });
            }
            setMessages((m) => ({
              ...m,
              [file.name]: t('medias.upload.uploadFailed', {
                error: errorMessage,
              }),
            }));
          }
        } catch {
          setMessages((m) => ({
            ...m,
            [file.name]: t('medias.upload.uploadError'),
          }));
        } finally {
          markUploadCompleted();
        }
      };

      xhr.onerror = () => {
        setMessages((m) => ({
          ...m,
          [file.name]: t('medias.upload.uploadError'),
        }));
        markUploadCompleted();
      };

      xhr.onabort = () => {
        setMessages((m) => ({
          ...m,
          [file.name]: t('medias.upload.uploadError'),
        }));
        markUploadCompleted();
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

        const { supported, skipped } = partitionSupportedFiles(
          Array.from(source.items)
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((file): file is File => !!file)
        );

        if (supported.length === 0) {
          toast.error(t('medias.upload.noSupportedFiles'));
          return;
        }
        if (skipped > 0) {
          toast.warning(
            t('medias.upload.unsupportedSkipped', { count: skipped })
          );
        }

        setFiles([...files(), ...supported]);
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
      <div class="file-pickers">
        <input
          type="file"
          id={fileInputId}
          class="file-input"
          multiple
          onChange={handleFileChange}
          accept={supportedFileTypes.join(',')}
        />
        <label for={fileInputId} class="file-label">
          {t('medias.upload.chooseFiles')}
        </label>
        {/* Opens the camera directly on phones and tablets */}
        <input
          type="file"
          id={cameraInputId}
          class="file-input"
          data-append="true"
          capture="environment"
          onChange={handleFileChange}
          accept="image/*,video/*"
        />
        <label for={cameraInputId} class="file-label camera-label">
          <IconWrapper icon={AiOutlineCamera} />
          {t('medias.upload.takePhotoOrVideo')}
        </label>
      </div>

      <div
        ref={setDropZoneElement}
        class="drop-zone"
        style={{
          'background-color': isDraggedOver()
            ? 'rgba(var(--cm-primary-rgb), 0.25)'
            : 'var(--cm-bg-tertiary)',
        }}
        onDragOver={(e) => e.preventDefault()} // This is crucial for making the drop event work
      >
        {t('medias.upload.dropFiles')}
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
                  const hasError = !!validation && !validation.valid;
                  const hasWarning =
                    !!validation && validation.valid && !!validation.warning;

                  return (
                    <tr
                      class="file"
                      classList={{
                        'file-error': hasError,
                        'file-warning': hasWarning,
                      }}
                    >
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
                            <div class="progress-cell">
                              <progress
                                value={progresses()[file.name] || 0}
                                max="100"
                                aria-label={file.name}
                              >
                                {progresses()[file.name] || 0}%
                              </progress>
                              <span class="progress-value" aria-hidden="true">
                                {progresses()[file.name] || 0}%
                              </span>
                            </div>
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
              getCompletedFilesCount() === getValidFilesCount()
                ? t('common.close')
                : t('common.cancel')
            }
            onClick={() => props.onCancel?.()}
            color="secondary"
            disabled={
              getCompletedFilesCount() > 0 &&
              getCompletedFilesCount() !== getValidFilesCount()
            }
          />
        </Show>
        {/* Change label to "Close" when all files have been uploaded */}
        <Button
          disabled={
            isUploading() || getCompletedFilesCount() === getValidFilesCount()
          }
          label={t('medias.upload.upload')}
          onClick={handleUpload}
          icon={AiOutlineUpload}
          color="primary"
        />
      </div>
      <p>{messages().global}</p>
    </div>
  );
};
