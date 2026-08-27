/**
 * Digests a string into a SHA-256 hash.
 */
export async function digestText(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
}

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
