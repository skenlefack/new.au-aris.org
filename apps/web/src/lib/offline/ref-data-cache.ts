/**
 * Reference data cache — IndexedDB read/write for master data.
 *
 * Covers: species, diseases, breeds, age-groups, vaccines, control-measures,
 *         units, countries, and other dropdown/referential data.
 */

import { getDB, type RefDataItem, type GeoEntity } from './db';
import { isCacheFresh, markCacheRefreshed, TTL } from './cache-policy';

/* ------------------------------------------------------------------ */
/*  Reference Data (species, diseases, etc.)                           */
/* ------------------------------------------------------------------ */

/**
 * Store a batch of reference data items (replaces all items of that type for a tenant).
 */
export async function cacheRefData(
  type: string,
  tenantId: string,
  items: Omit<RefDataItem, 'syncedAt'>[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('ref-data', 'readwrite');
  const store = tx.objectStore('ref-data');

  // Delete existing items of this type for this tenant
  const idx = store.index('by-type');
  let cursor = await idx.openCursor(type);
  while (cursor) {
    const item = cursor.value;
    if (item.tenantId === tenantId) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }

  // Insert new items
  const now = Date.now();
  for (const item of items) {
    await store.put({ ...item, syncedAt: now });
  }
  await tx.done;

  await markCacheRefreshed(`ref-data:${type}:${tenantId}`, TTL.REF_DATA);
}

/**
 * Get all cached items of a given type for a tenant.
 */
export async function getCachedRefData(
  type: string,
  tenantId: string,
): Promise<RefDataItem[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('ref-data', 'by-type', type);
  return all
    .filter((item) => item.tenantId === tenantId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Check if ref data of a given type is still fresh.
 */
export async function isRefDataFresh(type: string, tenantId: string): Promise<boolean> {
  return isCacheFresh(`ref-data:${type}:${tenantId}`);
}

/* ------------------------------------------------------------------ */
/*  Geo Entities (admin divisions)                                     */
/* ------------------------------------------------------------------ */

/**
 * Store geo entities for a country (replaces all for that country).
 */
export async function cacheGeoEntities(
  countryCode: string,
  entities: Omit<GeoEntity, 'syncedAt'>[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('geo-entities', 'readwrite');
  const store = tx.objectStore('geo-entities');

  // Delete existing entities for this country
  const idx = store.index('by-country');
  let cursor = await idx.openCursor(countryCode);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  // Insert new
  const now = Date.now();
  for (const entity of entities) {
    await store.put({ ...entity, syncedAt: now });
  }
  await tx.done;

  await markCacheRefreshed(`geo:${countryCode}`, TTL.GEO);
}

/**
 * Get cached geo entities for a country, optionally filtered by level.
 */
export async function getCachedGeoEntities(
  countryCode: string,
  level?: GeoEntity['level'],
): Promise<GeoEntity[]> {
  const db = await getDB();

  if (level) {
    return db.getAllFromIndex('geo-entities', 'by-level', [countryCode, level]);
  }

  return db.getAllFromIndex('geo-entities', 'by-country', countryCode);
}

/**
 * Get children of a parent geo entity.
 */
export async function getCachedGeoChildren(parentId: string): Promise<GeoEntity[]> {
  const db = await getDB();
  return db.getAllFromIndex('geo-entities', 'by-parent', parentId);
}

/**
 * Check if geo data for a country is still fresh.
 */
export async function isGeoFresh(countryCode: string): Promise<boolean> {
  return isCacheFresh(`geo:${countryCode}`);
}

/* ------------------------------------------------------------------ */
/*  Form Templates                                                     */
/* ------------------------------------------------------------------ */

import type { FormTemplateCache } from './db';

/**
 * Store form templates for a tenant.
 */
export async function cacheFormTemplates(
  tenantId: string,
  templates: Omit<FormTemplateCache, 'syncedAt'>[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('form-templates', 'readwrite');
  const store = tx.objectStore('form-templates');

  // Delete existing for this tenant
  const idx = store.index('by-tenant');
  let cursor = await idx.openCursor(tenantId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  const now = Date.now();
  for (const tpl of templates) {
    await store.put({ ...tpl, syncedAt: now });
  }
  await tx.done;

  await markCacheRefreshed(`templates:${tenantId}`, TTL.TEMPLATES);
}

/**
 * Get cached form templates for a tenant, optionally filtered by domain.
 */
export async function getCachedFormTemplates(
  tenantId: string,
  domain?: string,
): Promise<FormTemplateCache[]> {
  const db = await getDB();

  if (domain) {
    return db.getAllFromIndex('form-templates', 'by-domain', [tenantId, domain]);
  }

  return db.getAllFromIndex('form-templates', 'by-tenant', tenantId);
}

/**
 * Get a single cached form template by ID.
 */
export async function getCachedFormTemplate(
  id: string,
): Promise<FormTemplateCache | undefined> {
  const db = await getDB();
  return db.get('form-templates', id);
}

/**
 * Check if templates for a tenant are still fresh.
 */
export async function isTemplatesFresh(tenantId: string): Promise<boolean> {
  return isCacheFresh(`templates:${tenantId}`);
}

/* ------------------------------------------------------------------ */
/*  Campaigns                                                          */
/* ------------------------------------------------------------------ */

import type { CampaignCache } from './db';

/**
 * Store campaigns for a tenant.
 */
export async function cacheCampaigns(
  tenantId: string,
  campaigns: Omit<CampaignCache, 'syncedAt'>[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('campaigns', 'readwrite');
  const store = tx.objectStore('campaigns');

  const idx = store.index('by-tenant');
  let cursor = await idx.openCursor(tenantId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

  const now = Date.now();
  for (const c of campaigns) {
    await store.put({ ...c, syncedAt: now });
  }
  await tx.done;

  await markCacheRefreshed(`campaigns:${tenantId}`, TTL.CAMPAIGNS);
}

/**
 * Get cached campaigns for a tenant.
 */
export async function getCachedCampaigns(
  tenantId: string,
): Promise<CampaignCache[]> {
  const db = await getDB();
  return db.getAllFromIndex('campaigns', 'by-tenant', tenantId);
}
