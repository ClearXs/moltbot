/**
 * Idempotency key generation utilities
 */

/**
 * Generate a unique idempotency key using crypto.randomUUID
 * Fallback to custom implementation for older browsers
 */
export function generateIdempotencyKey(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: custom UUID v4 implementation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a prefixed idempotency key
 * @param prefix - Prefix for the key (e.g., 'msg', 'agent', 'session')
 */
export function generatePrefixedKey(prefix: string): string {
  const uuid = generateIdempotencyKey();
  return `${prefix}-${uuid}`;
}

/**
 * Generate a timestamp-based idempotency key (alternative approach)
 * Useful for debugging and ordering
 */
export function generateTimestampKey(prefix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 11);
  const key = `${timestamp}-${random}`;
  return prefix ? `${prefix}-${key}` : key;
}
