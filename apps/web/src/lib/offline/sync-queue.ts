/**
 * Sync Queue Manager — manages outbound mutations for offline sync.
 *
 * When the user performs a mutation while offline (create submission, etc.),
 * the operation is enqueued here. When connectivity returns, the queue
 * processes operations in order with retry logic.
 *
 * Modeled on the mobile app's SyncRepository pattern.
 */

import { getDB, type SyncQueueItem, type SyncStatus } from './db';
import {
  getPendingSubmissions,
  markSubmissionSynced,
  markSubmissionFailed,
} from './submission-store';

/* ------------------------------------------------------------------ */
/*  Retry config                                                       */
/* ------------------------------------------------------------------ */

const MAX_RETRIES = 5;
const RETRY_DELAYS = [0, 30_000, 120_000, 600_000, 3_600_000]; // 0s, 30s, 2min, 10min, 1h
const BATCH_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Queue operations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Enqueue a mutation for later sync.
 */
export async function enqueueSync(
  item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retryCount' | 'status'>,
): Promise<number> {
  const db = await getDB();
  const entry: SyncQueueItem = {
    ...item,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'PENDING',
  };
  const id = await db.add('sync-queue', entry);
  return id as number;
}

/**
 * Get the current sync queue status.
 */
export async function getSyncQueueStatus(): Promise<{
  pending: number;
  inFlight: number;
  failed: number;
  conflict: number;
  total: number;
}> {
  const db = await getDB();
  const all = await db.getAll('sync-queue');
  const counts = { pending: 0, inFlight: 0, failed: 0, conflict: 0, total: all.length };
  for (const item of all) {
    if (item.status === 'PENDING') counts.pending++;
    else if (item.status === 'IN_FLIGHT') counts.inFlight++;
    else if (item.status === 'FAILED') counts.failed++;
    else if (item.status === 'CONFLICT') counts.conflict++;
  }
  return counts;
}

/**
 * Get all items in the sync queue.
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('sync-queue', 'by-created');
}

/**
 * Remove a sync queue item (after successful sync or user discard).
 */
export async function removeSyncItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('sync-queue', id);
}

/**
 * Retry a failed sync queue item.
 */
export async function retrySyncItem(id: number): Promise<void> {
  const db = await getDB();
  const item = await db.get('sync-queue', id);
  if (!item) return;
  await db.put('sync-queue', { ...item, status: 'PENDING' as SyncStatus, retryCount: 0 });
}

/**
 * Discard a failed or conflicted item.
 */
export async function discardSyncItem(id: number): Promise<void> {
  await removeSyncItem(id);
}

/* ------------------------------------------------------------------ */
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) return JSON.parse(raw)?.state?.accessToken ?? null;
  } catch { /* ignore */ }
  return null;
}

function getRefreshToken(): string | null {
  try {
    const raw = localStorage.getItem('aris-auth');
    if (raw) return JSON.parse(raw)?.state?.refreshToken ?? null;
  } catch { /* ignore */ }
  return null;
}

/**
 * Attempt to refresh the access token before syncing.
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/v1/credential/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data?.accessToken ?? data?.data?.accessToken;
    if (newToken) {
      // Update the stored token
      try {
        const raw = localStorage.getItem('aris-auth');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.state.accessToken = newToken;
          if (data?.refreshToken || data?.data?.refreshToken) {
            parsed.state.refreshToken = data.refreshToken ?? data.data.refreshToken;
          }
          localStorage.setItem('aris-auth', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
    }
    return newToken;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Process queue                                                      */
/* ------------------------------------------------------------------ */

let processing = false;

export interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
}

/**
 * Process all pending items in the sync queue.
 * Call this when connectivity returns.
 */
export async function processQueue(): Promise<SyncResult> {
  if (processing) return { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };
  }

  processing = true;
  const result: SyncResult = { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };

  try {
    // 1. Ensure we have a valid token
    let token = getAccessToken();
    if (!token) {
      token = await refreshAccessToken();
      if (!token) {
        console.warn('[ARIS Sync] No valid token — sync deferred');
        return result;
      }
    }

    // 2. Process sync queue items
    const db = await getDB();
    const pending = await db.getAllFromIndex('sync-queue', 'by-status', 'PENDING' as SyncStatus);

    for (const item of pending.slice(0, BATCH_SIZE)) {
      result.processed++;

      // Mark as in-flight
      await db.put('sync-queue', { ...item, status: 'IN_FLIGHT' as SyncStatus });

      try {
        const res = await fetch(item.endpoint, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(item.payload),
        });

        if (res.ok) {
          result.succeeded++;
          await removeSyncItem(item.id!);

          // If this was a submission, mark it as synced
          const payload = item.payload as any;
          if (payload?.submissionId) {
            await markSubmissionSynced(payload.submissionId);
          }
        } else if (res.status === 401) {
          // Token expired — try to refresh
          token = await refreshAccessToken();
          if (token) {
            // Retry this item with new token
            await db.put('sync-queue', { ...item, status: 'PENDING' as SyncStatus });
          } else {
            await db.put('sync-queue', {
              ...item,
              status: 'FAILED' as SyncStatus,
              lastError: 'Authentication expired — please log in again',
            });
            result.failed++;
          }
        } else if (res.status === 409) {
          // Conflict
          let serverData: unknown;
          try { serverData = await res.json(); } catch { /* ignore */ }
          await db.put('sync-queue', {
            ...item,
            status: 'CONFLICT' as SyncStatus,
            serverResponse: serverData,
          });
          result.conflicts++;
        } else {
          // Other error — increment retry
          const newRetryCount = item.retryCount + 1;
          if (newRetryCount >= MAX_RETRIES) {
            let errMsg: string;
            try { errMsg = (await res.json())?.message ?? `HTTP ${res.status}`; } catch { errMsg = `HTTP ${res.status}`; }
            await db.put('sync-queue', {
              ...item,
              status: 'FAILED' as SyncStatus,
              retryCount: newRetryCount,
              lastError: errMsg,
            });
            if (item.type === 'CREATE_SUBMISSION') {
              const payload = item.payload as any;
              if (payload?.submissionId) {
                await markSubmissionFailed(payload.submissionId, errMsg);
              }
            }
            result.failed++;
          } else {
            await db.put('sync-queue', {
              ...item,
              status: 'PENDING' as SyncStatus,
              retryCount: newRetryCount,
            });
          }
        }
      } catch (err) {
        // Network error — put back as pending for retry
        await db.put('sync-queue', {
          ...item,
          status: 'PENDING' as SyncStatus,
          retryCount: item.retryCount + 1,
          lastError: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    // 3. Also sync pending offline submissions not yet in queue
    await syncPendingSubmissions(token);

  } finally {
    processing = false;
  }

  return result;
}

/**
 * Sync offline submissions that are marked PENDING but not in the queue.
 */
async function syncPendingSubmissions(token: string): Promise<void> {
  const pending = await getPendingSubmissions();
  if (pending.length === 0) return;

  for (const sub of pending.slice(0, BATCH_SIZE)) {
    try {
      const res = await fetch(`/api/v1/form-builder/templates/${sub.templateId}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: sub.data,
          status: 'SUBMITTED',
          campaignId: sub.campaignId || undefined,
          geoLocation: sub.gpsLat ? {
            latitude: sub.gpsLat,
            longitude: sub.gpsLng,
            accuracy: sub.gpsAccuracy,
          } : undefined,
        }),
      });

      if (res.ok) {
        await markSubmissionSynced(sub.id);
      } else {
        let errMsg: string;
        try { errMsg = (await res.json())?.message ?? `HTTP ${res.status}`; } catch { errMsg = `HTTP ${res.status}`; }
        await markSubmissionFailed(sub.id, errMsg);
      }
    } catch {
      // Network error — leave as PENDING for next sync attempt
    }
  }
}

/**
 * Check if sync is currently processing.
 */
export function isSyncing(): boolean {
  return processing;
}
