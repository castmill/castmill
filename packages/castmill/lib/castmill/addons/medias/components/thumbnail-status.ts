import type { JsonMedia } from '@castmill/player';

export const getThumbnailProgress = (
  item: Pick<JsonMedia, 'status' | 'status_message'>
): number | null => {
  if (item.status !== 'uploading' && item.status !== 'transcoding') {
    return null;
  }

  const progress = Number.parseFloat(item.status_message || '');
  return Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
};
