/**
 * Storage quota monitoring for offline data.
 * Provides usage info and eviction when quota is near-full.
 */

export interface StorageQuota {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  available: boolean;
}

const QUOTA_WARNING_THRESHOLD = 0.8; // 80%

/**
 * Get current storage usage and quota.
 */
export async function getStorageQuota(): Promise<StorageQuota> {
  if (!navigator.storage?.estimate) {
    return { usageBytes: 0, quotaBytes: 0, percentUsed: 0, available: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: quota > 0 ? usage / quota : 0,
      available: true,
    };
  } catch {
    return { usageBytes: 0, quotaBytes: 0, percentUsed: 0, available: false };
  }
}

/**
 * Check if storage usage exceeds the warning threshold.
 */
export async function isQuotaWarning(): Promise<boolean> {
  const quota = await getStorageQuota();
  return quota.available && quota.percentUsed > QUOTA_WARNING_THRESHOLD;
}

/**
 * Request persistent storage (prevents browser from evicting data).
 * Works in Chrome and Edge. Firefox grants it automatically for installed PWAs.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/**
 * Format bytes to human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
