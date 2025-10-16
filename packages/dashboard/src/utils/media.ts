export interface MediaPayload {
  data?: unknown;
  files?: MediaFiles;
  [key: string]: unknown;
}

export type MediaFiles =
  | Record<string, MediaFile | undefined>
  | MediaFile[]
  | undefined
  | null;

export interface MediaFile {
  uri?: string;
  [key: string]: unknown;
}

const PREFERRED_CONTEXTS = [
  'thumbnail',
  'main',
  'default',
  'square',
  'landscape',
];

function extractUriFromRecord(
  files: Record<string, MediaFile | undefined>
): string | null {
  for (const context of PREFERRED_CONTEXTS) {
    const candidate = files[context]?.uri;
    if (candidate) return candidate;
  }

  for (const file of Object.values(files)) {
    if (file?.uri) {
      return file.uri;
    }
  }

  return null;
}

function extractUriFromArray(files: MediaFile[]): string | null {
  for (const context of PREFERRED_CONTEXTS) {
    const candidate = files.find(
      (file) => (file as any)?.context === context
    )?.uri;
    if (candidate) return candidate;
  }

  for (const file of files) {
    const uri = file?.uri ?? (file as any)?.file?.uri;
    if (uri) {
      return uri;
    }
  }

  return null;
}

/**
 * Extract the best candidate URL from a media payload returned by the backend.
 */
export function extractMediaFileUrl(payload: unknown): string | null {
  if (!payload) return null;

  const data = (payload as MediaPayload).data ?? payload;
  const files = (data as MediaPayload)?.files;

  if (!files) {
    return null;
  }

  if (Array.isArray(files)) {
    return extractUriFromArray(files);
  }

  if (typeof files === 'object') {
    return extractUriFromRecord(files as Record<string, MediaFile | undefined>);
  }

  return null;
}
