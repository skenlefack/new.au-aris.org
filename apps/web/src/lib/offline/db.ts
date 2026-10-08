/**
 * ARIS Offline Database — IndexedDB schema using `idb`.
 *
 * Database: aris-offline-v1
 * Stores:
 *   - meta          — cache TTL tracking
 *   - ref-data      — reference/master data (species, diseases, breeds, etc.)
 *   - geo-entities  — admin divisions (countries, admin1, admin2)
 *   - form-templates — form schemas for offline data entry
 *   - submissions   — offline draft submissions
 *   - sync-queue    — outbound mutations waiting to sync
 *   - campaigns     — collection campaigns
 *   - dashboard-cache — cached dashboard/KPI data
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/* ------------------------------------------------------------------ */
/*  Schema types                                                       */
/* ------------------------------------------------------------------ */

export interface CacheMeta {
  key: string;
  lastRefreshed: number;
  ttlMs: number;
}

export interface RefDataItem {
  type: string;
  itemId: string;
  code: string;
  name: Record<string, string>;
  metadata?: Record<string, unknown>;
  tenantId: string;
  sortOrder: number;
  syncedAt: number;
}

export interface GeoEntity {
  id: string;
  code: string;
  name: Record<string, string>;
  level: 'COUNTRY' | 'ADMIN1' | 'ADMIN2' | 'ADMIN3';
  countryCode: string;
  parentId: string | null;
  latitude?: number;
  longitude?: number;
  syncedAt: number;
}

export interface FormTemplateCache {
  id: string;
  tenantId: string;
  name: string;
  nameI18n: Record<string, string>;
  domain: string;
  formType: string;
  schema: unknown;
  uiSchema?: unknown;
  version: number;
  status: string;
  syncedAt: number;
}

export type SyncOperationType =
  | 'CREATE_SUBMISSION'
  | 'UPDATE_SUBMISSION'
  | 'CREATE_EVENT';

export type SyncStatus = 'PENDING' | 'IN_FLIGHT' | 'FAILED' | 'CONFLICT';

export interface SyncQueueItem {
  id?: number; // auto-increment
  type: SyncOperationType;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: unknown;
  tenantId: string;
  userId: string;
  createdAt: number;
  retryCount: number;
  status: SyncStatus;
  lastError?: string;
  serverResponse?: unknown;
}

export type SubmissionSyncStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SYNCED'
  | 'FAILED'
  | 'CONFLICT';

export interface OfflineSubmission {
  id: string; // client-generated UUID
  tenantId: string;
  campaignId: string;
  templateId: string;
  data: Record<string, unknown>;
  domain: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  offlineCreatedAt: number;
  syncStatus: SubmissionSyncStatus;
  syncedAt?: number;
  serverErrors?: string;
}

export interface CampaignCache {
  id: string;
  tenantId: string;
  name: Record<string, string>;
  domain: string;
  status: string;
  templateId: string;
  startDate: string;
  endDate: string;
  syncedAt: number;
}

export interface DashboardCacheItem {
  cacheKey: string;
  tenantId: string;
  data: unknown;
  cachedAt: number;
  ttlMs: number;
}

/* ------------------------------------------------------------------ */
/*  IDB Schema                                                         */
/* ------------------------------------------------------------------ */

interface ArisOfflineDB extends DBSchema {
  'meta': {
    key: string;
    value: CacheMeta;
  };
  'ref-data': {
    key: [string, string]; // [type, itemId]
    value: RefDataItem;
    indexes: {
      'by-type': string;
      'by-tenant': string;
    };
  };
  'geo-entities': {
    key: string;
    value: GeoEntity;
    indexes: {
      'by-country': string;
      'by-level': [string, string];
      'by-parent': string;
    };
  };
  'form-templates': {
    key: string;
    value: FormTemplateCache;
    indexes: {
      'by-tenant': string;
      'by-domain': [string, string];
    };
  };
  'submissions': {
    key: string;
    value: OfflineSubmission;
    indexes: {
      'by-campaign': string;
      'by-status': SubmissionSyncStatus;
      'by-tenant': string;
    };
  };
  'sync-queue': {
    key: number;
    value: SyncQueueItem;
    indexes: {
      'by-status': SyncStatus;
      'by-created': number;
    };
  };
  'campaigns': {
    key: string;
    value: CampaignCache;
    indexes: {
      'by-tenant': string;
      'by-status': [string, string];
    };
  };
  'dashboard-cache': {
    key: string;
    value: DashboardCacheItem;
    indexes: {
      'by-tenant': string;
    };
  };
}

/* ------------------------------------------------------------------ */
/*  Database singleton                                                 */
/* ------------------------------------------------------------------ */

const DB_NAME = 'aris-offline-v1';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ArisOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ArisOfflineDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }

  if (!dbPromise) {
    dbPromise = openDB<ArisOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // ── meta ──
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        // ── ref-data ──
        if (!db.objectStoreNames.contains('ref-data')) {
          const refStore = db.createObjectStore('ref-data', {
            keyPath: ['type', 'itemId'],
          });
          refStore.createIndex('by-type', 'type');
          refStore.createIndex('by-tenant', 'tenantId');
        }

        // ── geo-entities ──
        if (!db.objectStoreNames.contains('geo-entities')) {
          const geoStore = db.createObjectStore('geo-entities', {
            keyPath: 'id',
          });
          geoStore.createIndex('by-country', 'countryCode');
          geoStore.createIndex('by-level', ['countryCode', 'level']);
          geoStore.createIndex('by-parent', 'parentId');
        }

        // ── form-templates ──
        if (!db.objectStoreNames.contains('form-templates')) {
          const tplStore = db.createObjectStore('form-templates', {
            keyPath: 'id',
          });
          tplStore.createIndex('by-tenant', 'tenantId');
          tplStore.createIndex('by-domain', ['tenantId', 'domain']);
        }

        // ── submissions ──
        if (!db.objectStoreNames.contains('submissions')) {
          const subStore = db.createObjectStore('submissions', {
            keyPath: 'id',
          });
          subStore.createIndex('by-campaign', 'campaignId');
          subStore.createIndex('by-status', 'syncStatus');
          subStore.createIndex('by-tenant', 'tenantId');
        }

        // ── sync-queue ──
        if (!db.objectStoreNames.contains('sync-queue')) {
          const syncStore = db.createObjectStore('sync-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncStore.createIndex('by-status', 'status');
          syncStore.createIndex('by-created', 'createdAt');
        }

        // ── campaigns ──
        if (!db.objectStoreNames.contains('campaigns')) {
          const campStore = db.createObjectStore('campaigns', {
            keyPath: 'id',
          });
          campStore.createIndex('by-tenant', 'tenantId');
          campStore.createIndex('by-status', ['tenantId', 'status']);
        }

        // ── dashboard-cache ──
        if (!db.objectStoreNames.contains('dashboard-cache')) {
          const dashStore = db.createObjectStore('dashboard-cache', {
            keyPath: 'cacheKey',
          });
          dashStore.createIndex('by-tenant', 'tenantId');
        }
      },
    });
  }

  return dbPromise;
}

/**
 * Clear all offline data for a specific tenant.
 * Used on logout to remove sensitive/confidential data.
 */
export async function clearTenantData(tenantId: string): Promise<void> {
  const db = await getDB();

  const stores: (keyof ArisOfflineDB)[] = [
    'submissions', 'sync-queue', 'campaigns', 'dashboard-cache',
  ];

  for (const storeName of stores) {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const idx = store.index('by-tenant' as string);
    let cursor = await idx.openCursor(tenantId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}

/**
 * Clear all offline data (full wipe).
 */
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const storeNames = Array.from(db.objectStoreNames);
  for (const name of storeNames) {
    const tx = db.transaction(name, 'readwrite');
    await tx.objectStore(name).clear();
    await tx.done;
  }
}
