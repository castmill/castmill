/**
 * Simple hash function based on the DJB2 algorithm.
 * Returns a hexadecimal string.
 */
export function simpleHash(message: string): string {
  let hash = 5381;
  for (let i = 0; i < message.length; i++) {
    hash = (hash * 33) ^ message.charCodeAt(i);
  }
  return (hash >>> 0).toString(16); // Convert to hexadecimal string
}
