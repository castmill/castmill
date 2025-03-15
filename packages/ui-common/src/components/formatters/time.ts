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
