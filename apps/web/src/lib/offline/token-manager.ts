/**
 * Token Manager — JWT expiry detection for offline sessions.
 *
 * When a user stays offline for days, both access and refresh tokens expire.
 * Instead of marking sync items as FAILED (losing data), we keep them PENDING
 * and prompt the user to re-authenticate when they come back online.
 *
 * This module:
 *   - Decodes JWT exp without signature verification (client-side only)
 *   - Detects when refresh token is expired
 *   - Emits REAUTH_REQUIRED via BroadcastChannel so all tabs know
 *   - Tracks how long the user has been offline
 */

/* ------------------------------------------------------------------ */
/*  JWT decoding (no verification — client-side only)                  */
/* ------------------------------------------------------------------ */

interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

/**
 * Decode a JWT payload without verifying the signature.
 * Returns null if the token is malformed.
 */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired.
 * Returns true if the token is expired or cannot be decoded.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload?.exp) return true; // No exp claim → treat as expired
  // exp is in seconds, Date.now() is in ms
  return Date.now() >= payload.exp * 1000;
}

/**
 * Get the expiry date of a JWT token.
 * Returns null if the token cannot be decoded.
 */
export function getTokenExpiry(token: string): Date | null {
  const payload = decodeJwt(token);
  if (!payload?.exp) return null;
  return new Date(payload.exp * 1000);
}

/**
 * Get seconds until a token expires. Negative means already expired.
 */
export function getTokenTTL(token: string): number {
  const payload = decodeJwt(token);
  if (!payload?.exp) return -1;
  return Math.floor(payload.exp - Date.now() / 1000);
}

/* ------------------------------------------------------------------ */
/*  Refresh token check (reads from IndexedDB)                         */
/* ------------------------------------------------------------------ */

/**
 * Check if the stored refresh token is expired.
 * Returns { expired, daysExpired } or null if no token found.
 */
export async function checkRefreshTokenStatus(): Promise<{
  expired: boolean;
  daysExpired: number;
  expiresAt: Date | null;
} | null> {
  try {
    const { getAuthTokens } = await import('./db');
    const tokens = await getAuthTokens();
    if (!tokens?.refreshToken) return null;

    const expiry = getTokenExpiry(tokens.refreshToken);
    if (!expiry) return { expired: true, daysExpired: 0, expiresAt: null };

    const now = Date.now();
    const expired = now >= expiry.getTime();
    const daysExpired = expired
      ? Math.floor((now - expiry.getTime()) / (24 * 60 * 60 * 1000))
      : -Math.ceil((expiry.getTime() - now) / (24 * 60 * 60 * 1000));

    return { expired, daysExpired, expiresAt: expiry };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  BroadcastChannel for re-auth notification                          */
/* ------------------------------------------------------------------ */

const REAUTH_CHANNEL = 'aris-reauth';

export interface ReauthEvent {
  type: 'REAUTH_REQUIRED' | 'REAUTH_COMPLETED';
  pendingItems: number;
  daysExpired?: number;
}

/**
 * Emit a REAUTH_REQUIRED event to all open tabs.
 */
export function emitReauthRequired(pendingItems: number, daysExpired: number): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(REAUTH_CHANNEL);
    channel.postMessage({
      type: 'REAUTH_REQUIRED',
      pendingItems,
      daysExpired,
    } satisfies ReauthEvent);
    channel.close();
  } catch {
    // BroadcastChannel not available
  }
}

/**
 * Emit a REAUTH_COMPLETED event (after successful re-login).
 */
export function emitReauthCompleted(): void {
  try {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(REAUTH_CHANNEL);
    channel.postMessage({
      type: 'REAUTH_COMPLETED',
      pendingItems: 0,
    } satisfies ReauthEvent);
    channel.close();
  } catch {
    // BroadcastChannel not available
  }
}

/**
 * Listen for re-auth events across tabs.
 * Returns an unsubscribe function.
 */
export function onReauthEvent(handler: (event: ReauthEvent) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};

  const channel = new BroadcastChannel(REAUTH_CHANNEL);
  const listener = (e: MessageEvent<ReauthEvent>) => {
    handler(e.data);
  };
  channel.addEventListener('message', listener);
  return () => {
    channel.removeEventListener('message', listener);
    channel.close();
  };
}

/* ------------------------------------------------------------------ */
/*  Offline duration tracking                                          */
/* ------------------------------------------------------------------ */

const OFFLINE_START_KEY = 'aris-offline-start';

/**
 * Record when the user went offline.
 * Called by the offline indicator.
 */
export function recordOfflineStart(): void {
  try {
    if (!sessionStorage.getItem(OFFLINE_START_KEY)) {
      sessionStorage.setItem(OFFLINE_START_KEY, String(Date.now()));
    }
  } catch { /* ignore */ }
}

/**
 * Clear the offline start timestamp.
 * Called when back online.
 */
export function clearOfflineStart(): void {
  try {
    sessionStorage.removeItem(OFFLINE_START_KEY);
  } catch { /* ignore */ }
}

/**
 * Get the number of days the user has been offline.
 * Returns 0 if currently online or tracking not started.
 */
export function getOfflineDays(): number {
  try {
    const start = sessionStorage.getItem(OFFLINE_START_KEY);
    if (!start) return 0;
    return Math.floor((Date.now() - Number(start)) / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}
