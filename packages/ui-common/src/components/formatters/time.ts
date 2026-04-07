/**
 * Formats a duration in milliseconds to a string in the format "mm:ss".
 * @param ms The duration in milliseconds.
 * @returns The formatted duration.
 */
export const formatDuration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

/**
 * Formats a timestamp (ISO string or Date) to a human-readable absolute format.
 * @param timestamp ISO date string or Date object
 * @returns Formatted date string like "May 10, 2025, 08:39 UTC"
 */
export const formatTimestamp = (timestamp: string | Date): string => {
  if (!timestamp) {
    return '-';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return '-';
  }

  // Format: "MMM d, yyyy, HH:mm UTC"
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false, // Use 24-hour format
    timeZone: 'UTC',
    timeZoneName: 'short',
  };

  return new Intl.DateTimeFormat('en-US', options).format(date);
};

/**
 * Formats a timestamp as relative time (e.g., "2 hours ago", "5 minutes ago").
 * @param timestamp ISO date string or Date object
 * @returns Relative time string
 */
export const formatRelativeTime = (timestamp: string | Date): string => {
  if (!timestamp) {
    return '-';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return '-';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Future dates
  if (diffInSeconds < 0) {
    const absDiff = Math.abs(diffInSeconds);
    if (absDiff < 60) return 'in a few seconds';
    if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)} minutes`;
    if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)} hours`;
    if (absDiff < 2592000) return `in ${Math.floor(absDiff / 86400)} days`;
    if (absDiff < 31536000) return `in ${Math.floor(absDiff / 2592000)} months`;
    return `in ${Math.floor(absDiff / 31536000)} years`;
  }

  // Past dates
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
};

/**
 * Formats a timestamp as relative time in a specific locale.
 * Falls back to the legacy English formatter when locale is missing or English.
 * @param timestamp ISO date string or Date object
 * @param locale BCP-47 locale code (e.g. 'sv', 'en-US')
 * @returns Relative time string
 */
export const formatRelativeTimeLocalized = (
  timestamp: string | Date,
  locale?: string
): string => {
  if (!locale || locale.toLowerCase().startsWith('en')) {
    return formatRelativeTime(timestamp);
  }

  if (!timestamp) {
    return '-';
  }

  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  if (isNaN(date.getTime())) {
    return '-';
  }

  const now = Date.now();
  const diffInSeconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffInSeconds);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (abs < 60) return rtf.format(diffInSeconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  if (abs < 2592000)
    return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  if (abs < 31536000)
    return rtf.format(Math.round(diffInSeconds / 2592000), 'month');
  return rtf.format(Math.round(diffInSeconds / 31536000), 'year');
};
