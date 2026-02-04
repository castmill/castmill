/**
 * Formats a byte value into a human-readable string with appropriate units.
 * 
 * @param bytes - The number of bytes to format (must be non-negative)
 * @returns A formatted string like "1.5 MB" or "256 KB"
 * 
 * @example
 * formatBytes(1024) // "1 KB"
 * formatBytes(1536) // "1.5 KB"
 * formatBytes(1048576) // "1 MB"
 * formatBytes(0) // "0 B"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0) {
    throw new Error('formatBytes: bytes must be non-negative');
  }
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${size} ${sizes[i]}`;
}
