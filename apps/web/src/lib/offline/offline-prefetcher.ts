/**
 * Offline Prefetcher — orchestrates background caching of data after login.
 *
 * On login (when online), prefetches:
 *   1. Reference data (species, diseases, breeds, etc.)
 *   2. Geo entities for the user's country
 *   3. Form templates for the user's tenant
 *   4. Active campaigns
 *   5. Dashboard KPIs
 *
 * All prefetch operations are fire-and-forget — they don't block the UI.
 * Data is cached in IndexedDB via the cache helpers.
 */

import { cacheRefData, cacheGeoEntities, cacheFormTemplates, cacheCampaigns, isRefDataFresh, isGeoFresh, isTemplatesFresh } from './ref-data-cache';
import { cacheDashboardData, dashboardCacheKey } from './dashboard-cache';
import { TTL } from './cache-policy';
import { requestPersistentStorage } from './quota-manager';

interface PrefetchContext {
  tenantId: string;
  tenantLevel: string;
  countryCode?: string;
  apiBaseUrl: string;
  accessToken: string;
}

/**
 * Fetch JSON from the API with auth header.
 */
async function apiFetch<T>(
  baseUrl: string,
  path: string,
  token: string,
): Promise<T | null> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Reference data prefetch                                            */
/* ------------------------------------------------------------------ */

const REF_DATA_ENDPOINTS = [
  { type: 'species', path: '/api/v1/master-data/species?limit=5000' },
  { type: 'diseases', path: '/api/v1/master-data/diseases?limit=5000' },
  { type: 'breeds', path: '/api/v1/master-data/ref/breeds/for-select' },
  { type: 'age-groups', path: '/api/v1/master-data/ref/age-groups/for-select' },
  { type: 'vaccine-types', path: '/api/v1/master-data/ref/vaccine-types/for-select' },
  { type: 'control-measures', path: '/api/v1/master-data/ref/control-measures/for-select' },
  { type: 'units', path: '/api/v1/master-data/ref/units/for-select' },
];

async function prefetchRefData(ctx: PrefetchContext): Promise<void> {
  for (const { type, path } of REF_DATA_ENDPOINTS) {
    try {
      const fresh = await isRefDataFresh(type, ctx.tenantId);
      if (fresh) continue;

      const items = await apiFetch<any[]>(ctx.apiBaseUrl, path, ctx.accessToken);
      if (!items || !Array.isArray(items)) continue;

      await cacheRefData(type, ctx.tenantId, items.map((item, i) => ({
        type,
        itemId: item.id || item.value || String(i),
        code: item.code || item.value || '',
        name: typeof item.name === 'object' ? item.name : { en: item.label || item.name || '' },
        metadata: item,
        tenantId: ctx.tenantId,
        sortOrder: item.sortOrder ?? i,
      })));
    } catch {
      // Skip this type, continue with others
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Geo entities prefetch                                              */
/* ------------------------------------------------------------------ */

async function prefetchGeo(ctx: PrefetchContext): Promise<void> {
  if (!ctx.countryCode) return;

  try {
    const fresh = await isGeoFresh(ctx.countryCode);
    if (fresh) return;

    // Fetch admin divisions for the user's country
    const entities = await apiFetch<any[]>(
      ctx.apiBaseUrl,
      `/api/v1/master-data/geo/entities?countryCode=${ctx.countryCode}&limit=10000`,
      ctx.accessToken,
    );
    if (!entities || !Array.isArray(entities)) return;

    await cacheGeoEntities(ctx.countryCode, entities.map((e) => ({
      id: e.id,
      code: e.code || '',
      name: typeof e.name === 'object' ? e.name : { en: e.name || '' },
      level: e.level || 'ADMIN1',
      countryCode: ctx.countryCode!,
      parentId: e.parentId || null,
      latitude: e.latitude,
      longitude: e.longitude,
    })));
  } catch {
    // Silently fail
  }
}

/* ------------------------------------------------------------------ */
/*  Form templates prefetch                                            */
/* ------------------------------------------------------------------ */

async function prefetchTemplates(ctx: PrefetchContext): Promise<void> {
  try {
    const fresh = await isTemplatesFresh(ctx.tenantId);
    if (fresh) return;

    const templates = await apiFetch<any[]>(
      ctx.apiBaseUrl,
      '/api/v1/form-builder/templates?limit=100&status=PUBLISHED',
      ctx.accessToken,
    );
    if (!templates || !Array.isArray(templates)) return;

    await cacheFormTemplates(ctx.tenantId, templates.map((t) => ({
      id: t.id,
      tenantId: ctx.tenantId,
      name: typeof t.name === 'string' ? t.name : (t.name?.en || ''),
      nameI18n: typeof t.name === 'object' ? t.name : { en: t.name || '' },
      domain: t.domain || '',
      formType: t.formType || 'CAMPAIGN',
      schema: t.schema || {},
      uiSchema: t.uiSchema,
      version: t.version || 1,
      status: t.status || 'PUBLISHED',
    })));
  } catch {
    // Silently fail
  }
}

/* ------------------------------------------------------------------ */
/*  Campaigns prefetch                                                 */
/* ------------------------------------------------------------------ */

async function prefetchCampaigns(ctx: PrefetchContext): Promise<void> {
  try {
    const campaigns = await apiFetch<any[]>(
      ctx.apiBaseUrl,
      '/api/v1/collecte/campaigns?limit=100&status=ACTIVE,IN_PROGRESS',
      ctx.accessToken,
    );
    if (!campaigns || !Array.isArray(campaigns)) return;

    await cacheCampaigns(ctx.tenantId, campaigns.map((c) => ({
      id: c.id,
      tenantId: ctx.tenantId,
      name: typeof c.name === 'object' ? c.name : { en: c.name || '' },
      domain: c.domain || '',
      status: c.status || '',
      templateId: c.templateId || '',
      startDate: c.startDate || '',
      endDate: c.endDate || '',
    })));
  } catch {
    // Silently fail
  }
}

/* ------------------------------------------------------------------ */
/*  Dashboard KPIs prefetch                                            */
/* ------------------------------------------------------------------ */

async function prefetchDashboards(ctx: PrefetchContext): Promise<void> {
  const kpiEndpoints = [
    '/api/v1/analytics/continental/kpis',
    '/api/v1/analytics/dashboard/charts',
  ];

  for (const path of kpiEndpoints) {
    try {
      const key = dashboardCacheKey(path, ctx.tenantId);
      const data = await apiFetch<unknown>(ctx.apiBaseUrl, path, ctx.accessToken);
      if (data) {
        await cacheDashboardData(key, ctx.tenantId, data, TTL.DASHBOARD);
      }
    } catch {
      // Continue with next
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Main prefetch orchestrator                                         */
/* ------------------------------------------------------------------ */

let prefetchInProgress = false;

/**
 * Run the full offline prefetch pipeline.
 * Call this after successful login when online.
 * All operations are fire-and-forget — won't block the UI.
 */
export async function runOfflinePrefetch(ctx: PrefetchContext): Promise<void> {
  if (prefetchInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  prefetchInProgress = true;

  try {
    // Request persistent storage (prevents browser from evicting our data)
    await requestPersistentStorage();

    // Run prefetch operations in parallel
    await Promise.allSettled([
      prefetchRefData(ctx),
      prefetchGeo(ctx),
      prefetchTemplates(ctx),
      prefetchCampaigns(ctx),
      prefetchDashboards(ctx),
    ]);

    console.log('[ARIS Offline] Prefetch complete');
  } catch (err) {
    console.warn('[ARIS Offline] Prefetch error:', err);
  } finally {
    prefetchInProgress = false;
  }
}

/**
 * Check if a prefetch is currently running.
 */
export function isPrefetching(): boolean {
  return prefetchInProgress;
}
