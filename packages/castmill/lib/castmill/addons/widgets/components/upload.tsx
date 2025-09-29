import { createSignal, onCleanup, For, Show, JSX } from 'solid-js';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter';

import {
  AiOutlineUpload,
  AiOutlineDelete,
  AiOutlineCheck,
} from 'solid-icons/ai';
import { Button, IconButton } from '@castmill/ui-common';

interface UploadComponentProps {
  baseUrl: string;
  organizationId: string;
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
  'application/json',
  'text/json',
];

export const UploadComponent = (props: UploadComponentProps) => {
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
      const isValidType = supportedFileTypes.includes(file.type) || file.name.endsWith('.json');
      if (!isValidType) {
        setMessage(file.name, 'Invalid file type. Only JSON files are supported.');
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

  const uploadFile = async (file: File) => {
    try {
      // Read and validate JSON content
      const jsonContent = await file.text();
      const parsedJson = JSON.parse(jsonContent);
      
      // Basic validation for widget JSON structure
      if (!parsedJson.name || !parsedJson.template) {
        throw new Error('Invalid widget JSON: must contain "name" and "template" fields');
      }

      setProgress(file.name, 50);

      const formData = new FormData();
      formData.append('widget', file);

      const response = await fetch(
        `${props.baseUrl}/dashboard/organizations/${props.organizationId}/widgets`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Upload failed');
      }

      setProgress(file.name, 100);
      setMessage(file.name, <AiOutlineCheck color="green" />);
      
      const result = await response.json();
      props.onFileUpload?.(file.name, result);
    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage(file.name, `Error: ${error.message}`);
    }
  };

  const handleUpload = async () => {
    const uploadPromises = files().map((file) => uploadFile(file));
    await Promise.all(uploadPromises);
    
    // Check if all files were processed
    const allProcessed = files().every((file) => 
      messages()[file.name] !== undefined
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
        const files = source.items as File[];
        if (files) {
          addFiles(Array.from(files));
        }
      },
    });

    onCleanup(cleanup);
  }

  return (
    <div class="upload-widgets">
      <h2>Upload Widget</h2>
      
      <div class="upload-description">
        <p>Upload JSON files containing widget definitions. Each widget must include:</p>
        <ul>
          <li><strong>name</strong>: The widget name</li>
          <li><strong>template</strong>: The widget template configuration</li>
          <li><strong>description</strong> (optional): Widget description</li>
          <li><strong>options_schema</strong> (optional): Schema for widget options</li>
          <li><strong>data_schema</strong> (optional): Schema for widget data</li>
        </ul>
        
        <div class="json-example">
{`{
  "name": "My Widget",
  "description": "A sample widget",
  "template": {
    "type": "image",
    "name": "image",
    "opts": {
      "url": {"key": "options.image.files[@target].uri"}
    }
  },
  "options_schema": {
    "image": {
      "type": "ref",
      "required": true,
      "collection": "medias|type:image"
    }
  }
}`}
        </div>
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
          accept=".json,application/json"
          onChange={onFileChange}
        />
        <div class="upload-hint">
          Or drag and drop JSON files here...
        </div>
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
                        fallback="Ready"
                      >
                        <progress
                          value={progresses()[file.name] || 0}
                          max="100"
                        >
                          {progresses()[file.name]}%
                        </progress>
                      </Show>
                    }
                  >
                    <div class={typeof messages()[file.name] === 'string' && messages()[file.name].toString().startsWith('Error') ? 'error' : 'success'}>
                      {messages()[file.name]}
                    </div>
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

        <Button
          disabled={files().length === 0 || Object.keys(messages()).length === files().length}
          label="Upload"
          onClick={handleUpload}
          icon={AiOutlineUpload}
          color="primary"
        />
      </div>
    </div>
  );
};