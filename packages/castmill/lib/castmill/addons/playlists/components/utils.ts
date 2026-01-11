/**
 * Safely stringify an object, handling circular references.
 * Returns a fingerprint string for dependency tracking purposes.
 */
export function safeStringify(obj: unknown): string {
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
