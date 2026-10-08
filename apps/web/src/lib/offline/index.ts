export { getDB, clearTenantData, clearAllData } from './db';
export type {
  RefDataItem, GeoEntity, FormTemplateCache, SyncQueueItem,
  OfflineSubmission, CampaignCache, DashboardCacheItem,
  SyncOperationType, SyncStatus, SubmissionSyncStatus,
} from './db';

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

export { runOfflinePrefetch, isPrefetching } from './offline-prefetcher';

export {
  createOfflineSubmission, updateOfflineSubmission, deleteOfflineSubmission,
  markSubmissionPending, markSubmissionSynced, markSubmissionFailed,
  getOfflineSubmissions, getSubmissionsByCampaign, getSubmissionsByStatus,
  getPendingSubmissions, getOfflineSubmission, countSubmissionsByStatus,
} from './submission-store';

export {
  enqueueSync, getSyncQueueStatus, getSyncQueue, removeSyncItem,
  retrySyncItem, discardSyncItem, processQueue, isSyncing,
  type SyncResult,
} from './sync-queue';
