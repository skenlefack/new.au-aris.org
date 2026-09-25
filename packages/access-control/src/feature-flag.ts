/**
 * Environment variable name for the access-levels feature flag.
 * When set to 'true', the domain access level filtering is active.
 * When absent or 'false', legacy behavior is preserved (R8).
 */
export const ACCESS_LEVELS_ENV_KEY = 'ACCESS_LEVELS_ENABLED';

/**
 * Read the feature flag from process.env.
 * Returns true only when the env var is explicitly set to 'true'.
 */
export function isAccessLevelsEnabled(): boolean {
  return process.env[ACCESS_LEVELS_ENV_KEY] === 'true';
}

/**
 * Redis key prefix for user access contexts.
 * Full key: `accessContext:{userId}`
 */
export const ACCESS_CONTEXT_REDIS_PREFIX = 'accessContext:';

/**
 * Build the Redis key for a user's access context.
 */
export function accessContextKey(userId: string): string {
  return `${ACCESS_CONTEXT_REDIS_PREFIX}${userId}`;
}
