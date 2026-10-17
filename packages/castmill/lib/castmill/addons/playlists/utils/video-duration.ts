import type { JsonMedia, JsonWidgetTemplate } from '@castmill/player';

type OptionsDict = Record<string, unknown>;

const PROBE_TIMEOUT_MS = 15000;
const PROBE_FILE_CONTEXTS = ['preview', 'poster', 'default'];
const OPTION_KEY_PATTERN = /^options\.([A-Za-z0-9_-]+)/;

/**
 * Returns the option names that provide the media of each video component in
 * a widget template. Only videos that define the widget's own length are
 * considered; videos inside scrollers, lists or layouts are not.
 */
export function findVideoOptionKeys(
  template: JsonWidgetTemplate | undefined | null
): string[] {
  if (!template) return [];

  const type: string = template.type;
  if (type === 'video') {
    const url = (template.opts as { url?: unknown } | undefined)?.url;
    const key =
      url && typeof url === 'object' ? (url as { key?: unknown }).key : null;
    const match = typeof key === 'string' ? OPTION_KEY_PATTERN.exec(key) : null;
    return match ? [match[1]] : [];
  }

  const components = (template as { components?: unknown }).components;
  if (type === 'group' && Array.isArray(components)) {
    return components.flatMap((component) =>
      findVideoOptionKeys(component as JsonWidgetTemplate)
    );
  }

  return [];
}

const isMedia = (value: unknown): value is JsonMedia =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as JsonMedia).files === 'object';

const validDuration = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;

function mediaVideoUri(media: JsonMedia): string | undefined {
  for (const context of PROBE_FILE_CONTEXTS) {
    const file = media.files?.[context];
    if (file?.uri && (!file.mimetype || file.mimetype.startsWith('video/'))) {
      return file.uri;
    }
  }
  return Object.values(media.files || {}).find((file) =>
    file?.mimetype?.startsWith('video/')
  )?.uri;
}

/**
 * Reads a video's duration (ms) from its metadata in the browser. Resolves to
 * undefined if the metadata cannot be loaded.
 */
export function probeVideoDuration(
  uri: string,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<number | undefined> {
  if (typeof document === 'undefined') return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const video = document.createElement('video');
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (duration?: number) => {
      if (timer !== undefined) clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
      video.removeAttribute('src');
      video.load();
      resolve(duration);
    };
    const onMetadata = () => finish(validDuration(video.duration * 1000));
    const onError = () => finish();

    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onError);
    timer = setTimeout(() => finish(), timeoutMs);
    video.preload = 'metadata';
    video.muted = true;
    video.src = uri;
  });
}

/**
 * Resolves the duration (ms) of a widget whose length is set by its video,
 * using the media's stored duration or its metadata.
 *
 * @returns the longest video duration, or undefined if the widget has no
 * video or its duration is unknown.
 */
export async function resolveVideoWidgetDuration(
  template: JsonWidgetTemplate | undefined | null,
  options: OptionsDict,
  probe: (uri: string) => Promise<number | undefined> = probeVideoDuration
): Promise<number | undefined> {
  const medias = findVideoOptionKeys(template)
    .map((key) => options[key])
    .filter(isMedia);

  const durations = await Promise.all(
    medias.map(async (media) => {
      const stored = validDuration(media.meta?.duration);
      if (stored) return stored;
      const uri = mediaVideoUri(media);
      return uri ? validDuration(await probe(uri)) : undefined;
    })
  );

  const known = durations.filter((duration): duration is number =>
    Boolean(duration)
  );
  return known.length ? Math.max(...known) : undefined;
}
