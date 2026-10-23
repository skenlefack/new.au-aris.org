export { getDB, clearTenantData, clearAllData, storeAuthTokens, getAuthTokens, clearAuthTokens } from './db';
export type {
  RefDataItem, GeoEntity, FormTemplateCache, SyncQueueItem,
  OfflineSubmission, CampaignCache, DashboardCacheItem, AuthTokens,
  SyncOperationType, SyncStatus, SubmissionSyncStatus,
} from './db';

export {
  initEncryption, destroyEncryption, isEncryptionReady, hasCryptoSupport,
  encryptValue, decryptValue, isEncrypted,
} from './crypto';

export { TTL, isCacheFresh, markCacheRefreshed, getLastRefresh, invalidateCache } from './cache-policy';

export {
  getStorageQuota, isQuotaWarning, requestPersistentStorage, formatBytes,
  type StorageQuota,
} from './quota-manager';

export {
  cacheRefData, getCachedRefData, isRefDataFresh,
  cacheGeoEntities, getCachedGeoEntities, getCachedGeoChildren, isGeoFresh,
  cacheFormTemplates, getCachedFormTemplates, getCachedFormTemplate, isTemplatesFresh,
  cacheCampaigns, getCachedCampaigns,
} from './ref-data-cache';

export { cacheDashboardData, getCachedDashboardData, dashboardCacheKey, clearDashboardCache } from './dashboard-cache';

export { withOfflineCache, withRefDataCache, withDashboardCache } from './query-offline';

export {
  runOfflinePrefetch, isPrefetching, cancelPrefetch,
  onPrefetchProgress, PrefetchPriority,
  type PrefetchProgress,
} from './offline-prefetcher';

export {
  createOfflineSubmission, updateOfflineSubmission, deleteOfflineSubmission,
  markSubmissionPending, markSubmissionSynced, markSubmissionFailed,
  getOfflineSubmissions, getSubmissionsByCampaign, getSubmissionsByStatus,
  getPendingSubmissions, getOfflineSubmission, countSubmissionsByStatus,
} from './submission-store';

export {
  enqueueSync, getSyncQueueStatus, getSyncQueue, removeSyncItem,
  retrySyncItem, discardSyncItem, processQueue, isSyncing,
  requestBackgroundSync, requestPeriodicSync,
  SYNC_TAG, PERIODIC_SYNC_TAG,
  type SyncResult,
} from './sync-queue';

export {
  isTokenExpired, getTokenExpiry, getTokenTTL,
  checkRefreshTokenStatus,
  emitReauthRequired, emitReauthCompleted, onReauthEvent,
  recordOfflineStart, clearOfflineStart, getOfflineDays,
  type ReauthEvent,
} from './token-manager';
