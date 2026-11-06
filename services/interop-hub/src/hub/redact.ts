/**
 * Connection secrets (API keys, tokens, webhook secrets, passwords) are never
 * returned by the API: every `credentials` object in a response is replaced by
 * the same keys with a masked value, so clients can see what is configured.
 */
export const SECRET_MASK = '********';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Object.prototype.toString.call(v) === '[object Object]';
}

export function maskCredentials<T>(payload: T, depth = 0): T {
  if (depth > 8 || payload === null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    payload.forEach((v) => maskCredentials(v, depth + 1));
    return payload;
  }
  if (!isPlainObject(payload)) return payload;
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'credentials' && isPlainObject(value)) {
      (payload as Record<string, unknown>)[key] = Object.fromEntries(
        Object.keys(value).map((k) => [k, value[k] === null || value[k] === '' ? value[k] : SECRET_MASK]),
      );
    } else if (value && typeof value === 'object') {
      maskCredentials(value, depth + 1);
    }
  }
  return payload;
}

/**
 * Merges credentials sent in an update with the stored ones: masked values sent
 * back unchanged by a client keep the stored secret.
 */
export function mergeCredentials(
  stored: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(stored ?? {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === SECRET_MASK) continue;
    merged[k] = v;
  }
  return merged;
}
