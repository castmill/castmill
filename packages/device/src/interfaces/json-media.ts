import { JsonFile } from './json-file';

export interface JsonMedia {
  id: number;
  mimetype: string;
  name: string;
  status: 'uploading' | 'transcoding' | 'ready' | 'failed';
  status_message: string | null;
  meta: any;
  files: { [context: string]: JsonFile };
  inserted_at: string;
  updated_at: string;
}
