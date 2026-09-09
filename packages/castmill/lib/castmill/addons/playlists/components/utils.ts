/**
 * Safely stringify an object, handling circular references.
 * Returns a fingerprint string for dependency tracking purposes.
 *
 * Use case: This function is primarily used for SolidJS effect dependency tracking,
 * where we need to serialize nested objects to detect deep changes. Circular references
 * can occur in complex widget configurations (e.g., layout references, nested playlists).
 *
 * Performance notes:
 * - First attempts standard JSON.stringify (fast path for non-circular data)
 * - Falls back to circular-reference-safe version only when needed
 * - The fast path avoids WeakSet allocation for the common case
 *
 * @param obj - The object to stringify
 * @returns JSON string representation, with '[Circular]' for circular references
 */
export function safeStringify(obj: unknown): string {
  // Fast path: try standard JSON.stringify first
  // This handles the common case without WeakSet overhead
  try {
    return JSON.stringify(obj);
  } catch (error) {
    // If we get a circular reference error, fall back to safe version
    if (error instanceof TypeError && error.message.includes('circular')) {
      const seen = new WeakSet();
      return JSON.stringify(obj, (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        return value;
      });
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Safely deep clone an object, handling circular references.
 * Circular references are replaced with undefined.
 */
export function safeDeepClone<T>(obj: T): T {
  const seen = new WeakSet();
  const clone = (value: any): any => {
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value)) return undefined; // Skip circular references
    seen.add(value);
    if (Array.isArray(value)) return value.map(clone);
    const result: Record<string, any> = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = clone(value[key]);
      }
    }
    return result;
  };
  return clone(obj);
}
