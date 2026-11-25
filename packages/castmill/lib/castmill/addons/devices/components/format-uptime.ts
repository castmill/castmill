/**
 * Formats seconds into a compact duration, e.g. "2d 3h 15m".
 */
export const formatUptime = (
  seconds: number,
  t: (key: string, params?: Record<string, any>) => string
): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${t('devices.telemetry.daysShort')}`);
  if (hours > 0) parts.push(`${hours}${t('devices.telemetry.hoursShort')}`);
  parts.push(`${minutes}${t('devices.telemetry.minutesShort')}`);
  return parts.join(' ');
};
