/**
 * Offline Submission Store — CRUD for draft submissions in IndexedDB.
 *
 * When the user fills a form offline, submissions are saved here
 * with syncStatus=DRAFT or PENDING. When connectivity returns,
 * the SyncQueue picks them up and sends them to the server.
 */

import { getDB, type OfflineSubmission, type SubmissionSyncStatus } from './db';

/**
 * Generate a client-side UUID for offline submissions.
 */
function generateId(): string {
  return crypto.randomUUID();
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
  await db.put('submissions', submission);
  return submission;
}

/**
 * Update an existing offline submission's form data.
 */
export async function updateOfflineSubmission(
  id: string,
  data: Record<string, unknown>,
): Promise<OfflineSubmission | null> {
  const db = await getDB();
  const existing = await db.get('submissions', id);
  if (!existing) return null;

  const updated: OfflineSubmission = { ...existing, data };
  await db.put('submissions', updated);
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
  return db.getAllFromIndex('submissions', 'by-tenant', tenantId);
}

/**
 * Get offline submissions by campaign.
 */
export async function getSubmissionsByCampaign(
  campaignId: string,
): Promise<OfflineSubmission[]> {
  const db = await getDB();
  return db.getAllFromIndex('submissions', 'by-campaign', campaignId);
}

/**
 * Get offline submissions by sync status.
 */
export async function getSubmissionsByStatus(
  status: SubmissionSyncStatus,
): Promise<OfflineSubmission[]> {
  const db = await getDB();
  return db.getAllFromIndex('submissions', 'by-status', status);
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
  return db.get('submissions', id);
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
