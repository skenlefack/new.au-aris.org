/**
 * Offline Submission Store — CRUD for draft submissions in IndexedDB.
 *
 * When the user fills a form offline, submissions are saved here
 * with syncStatus=DRAFT or PENDING. When connectivity returns,
 * the SyncQueue picks them up and sends them to the server.
 */

import { getDB, type OfflineSubmission, type SubmissionSyncStatus } from './db';
import { encryptValue, decryptValue, isEncryptionReady } from './crypto';

/**
 * Generate a client-side UUID for offline submissions.
 */
function generateId(): string {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------------ */
/*  Encryption helpers for submission data                             */
/* ------------------------------------------------------------------ */

/**
 * Encrypt the `data` field of a submission before storing.
 */
async function encryptSubmission(sub: OfflineSubmission): Promise<OfflineSubmission> {
  if (!isEncryptionReady()) return sub;
  const encryptedData = await encryptValue(sub.data);
  return { ...sub, data: encryptedData as Record<string, unknown> };
}

/**
 * Decrypt the `data` field of a submission after reading.
 */
async function decryptSubmission(sub: OfflineSubmission): Promise<OfflineSubmission> {
  const decrypted = await decryptValue<Record<string, unknown>>(sub.data);
  if (decrypted === null) return sub; // Can't decrypt — return as-is
  return { ...sub, data: decrypted };
}

/**
 * Decrypt an array of submissions.
 */
async function decryptSubmissions(subs: OfflineSubmission[]): Promise<OfflineSubmission[]> {
  return Promise.all(subs.map(decryptSubmission));
}

/* ------------------------------------------------------------------ */
/*  CRUD operations                                                    */
/* ------------------------------------------------------------------ */

/**
 * Create a new offline submission (draft).
 */
export async function createOfflineSubmission(
  input: Omit<OfflineSubmission, 'id' | 'offlineCreatedAt' | 'syncStatus'>,
): Promise<OfflineSubmission> {
  const db = await getDB();
  const submission: OfflineSubmission = {
    ...input,
    id: generateId(),
    offlineCreatedAt: Date.now(),
    syncStatus: 'DRAFT',
  };
  const toStore = await encryptSubmission(submission);
  await db.put('submissions', toStore);
  return submission; // Return the unencrypted version to the caller
}

/**
 * Update an existing offline submission's form data.
 */
export async function updateOfflineSubmission(
  id: string,
  data: Record<string, unknown>,
): Promise<OfflineSubmission | null> {
  const db = await getDB();
  const raw = await db.get('submissions', id);
  if (!raw) return null;

  const existing = await decryptSubmission(raw);
  const updated: OfflineSubmission = { ...existing, data };
  const toStore = await encryptSubmission(updated);
  await db.put('submissions', toStore);
  return updated;
}

/**
 * Mark a submission as ready to sync (DRAFT → PENDING).
 */
export async function markSubmissionPending(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('submissions', id);
  if (!existing) return;
  await db.put('submissions', { ...existing, syncStatus: 'PENDING' as SubmissionSyncStatus });
}

/**
 * Mark a submission as synced (server accepted it).
 */
export async function markSubmissionSynced(id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get('submissions', id);
  if (!existing) return;
  await db.put('submissions', {
    ...existing,
    syncStatus: 'SYNCED' as SubmissionSyncStatus,
    syncedAt: Date.now(),
  });
}

/**
 * Mark a submission as failed (server rejected it).
 */
export async function markSubmissionFailed(
  id: string,
  errors?: string,
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('submissions', id);
  if (!existing) return;
  await db.put('submissions', {
    ...existing,
    syncStatus: 'FAILED' as SubmissionSyncStatus,
    serverErrors: errors,
  });
}

/**
 * Delete an offline submission.
 */
export async function deleteOfflineSubmission(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('submissions', id);
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Get all offline submissions for a tenant.
 */
export async function getOfflineSubmissions(
  tenantId: string,
): Promise<OfflineSubmission[]> {
  const db = await getDB();
  const raw = await db.getAllFromIndex('submissions', 'by-tenant', tenantId);
  return decryptSubmissions(raw);
}

/**
 * Get offline submissions by campaign.
 */
export async function getSubmissionsByCampaign(
  campaignId: string,
): Promise<OfflineSubmission[]> {
  const db = await getDB();
  const raw = await db.getAllFromIndex('submissions', 'by-campaign', campaignId);
  return decryptSubmissions(raw);
}

/**
 * Get offline submissions by sync status.
 */
export async function getSubmissionsByStatus(
  status: SubmissionSyncStatus,
): Promise<OfflineSubmission[]> {
  const db = await getDB();
  const raw = await db.getAllFromIndex('submissions', 'by-status', status);
  return decryptSubmissions(raw);
}

/**
 * Get all submissions pending sync (PENDING status).
 */
export async function getPendingSubmissions(): Promise<OfflineSubmission[]> {
  return getSubmissionsByStatus('PENDING');
}

/**
 * Get a single offline submission by ID.
 */
export async function getOfflineSubmission(
  id: string,
): Promise<OfflineSubmission | undefined> {
  const db = await getDB();
  const raw = await db.get('submissions', id);
  if (!raw) return undefined;
  return decryptSubmission(raw);
}

/**
 * Count submissions by status for a tenant.
 */
export async function countSubmissionsByStatus(
  tenantId: string,
): Promise<Record<SubmissionSyncStatus, number>> {
  const all = await getOfflineSubmissions(tenantId);
  const counts: Record<SubmissionSyncStatus, number> = {
    DRAFT: 0, PENDING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0,
  };
  for (const s of all) {
    counts[s.syncStatus] = (counts[s.syncStatus] || 0) + 1;
  }
  return counts;
}
