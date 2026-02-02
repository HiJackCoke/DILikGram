import { v4 as uuid } from "uuid";

/**
 * Extract base key and ID from hyphen-separated key
 * @example parseKey('has-abc123') → { baseKey: 'has', id: 'abc123' }
 * @example parseKey('has') → { baseKey: 'has', id: null }
 */
export function parseKey(key: string): { baseKey: string; id: string | null } {
  const parts = key.split("-");
  if (parts.length > 1) {
    return { baseKey: parts[0], id: parts.slice(1).join("-") };
  }
  return { baseKey: key, id: null };
}

/**
 * Generate unique key with UUID
 * @param baseKey - Base key (e.g., 'has')
 * @returns Unique key with UUID (e.g., 'has-abc12345')
 */
export function generateKeyWithId(baseKey: string): string {
  const id = uuid().slice(0, 8); // Use first 8 characters of UUID
  return `${baseKey}-${id}`;
}
