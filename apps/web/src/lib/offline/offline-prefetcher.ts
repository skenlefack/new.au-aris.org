/**
 * Offline Prefetcher — progressive background caching of data after login.
 *
 * Three priority levels, respecting bandwidth constraints:
 *   CRITICAL (immediate) — campaigns + assigned templates (needed for data entry)
 *   HIGH     (after 5s)  — species, diseases, breeds, geo admin1
 *   LOW      (idle time) — all other ref-data, geo admin2/3, dashboards
 *
 * Bandwidth detection:
 *   - 2g / slow-2g → CRITICAL only
 *   - 3g           → CRITICAL + HIGH
 *   - 4g / wifi    → all levels
 *   - saveData     → CRITICAL only
 *
 * All prefetch operations are fire-and-forget — they don't block the UI.
 * Data is cached in IndexedDB via the cache helpers.
 */

import { cacheRefData, cacheGeoEntities, cacheFormTemplates, cacheCampaigns, isRefDataFresh, isGeoFresh, isTemplatesFresh } from './ref-data-cache';
import { cacheDashboardData, dashboardCacheKey } from './dashboard-cache';
import { TTL } from './cache-policy';
import { requestPersistentStorage } from './quota-manager';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PrefetchContext {
  tenantId: string;
  tenantLevel: string;
  countryCode?: string;
  apiBaseUrl: string;
  accessToken: string;
}

export enum PrefetchPriority {
  /** Immediate — campaigns + form templates for active campaigns */
  CRITICAL = 0,
  /** After 5s idle — most-used ref-data + geo admin1 */
  HIGH = 1,
  /** requestIdleCallback — remaining ref-data, deep geo, dashboards */
  LOW = 2,
}

interface PrefetchTask {
  name: string;
  priority: PrefetchPriority;
  fn: (ctx: PrefetchContext) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Bandwidth detection                                                */
/* ------------------------------------------------------------------ */

type ConnectionSpeed = 'slow' | 'medium' | 'fast';

function detectConnectionSpeed(): ConnectionSpeed {
  const conn = (navigator as any).connection;
  if (!conn) return 'fast'; // Can't detect → assume fast

  // Respect data saver mode
  if (conn.saveData) return 'slow';

  const effectiveType = conn.effectiveType;
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
  if (effectiveType === '3g') return 'medium';
  return 'fast'; // 4g, wifi, etc.
}

/**
 * Get the maximum priority level to prefetch based on connection speed.
 */
function getMaxPriority(speed: ConnectionSpeed): PrefetchPriority {
  switch (speed) {
    case 'slow': return PrefetchPriority.CRITICAL;
    case 'medium': return PrefetchPriority.HIGH;
    case 'fast': return PrefetchPriority.LOW;
  }
}

/* ------------------------------------------------------------------ */
/*  API helper                                                         */
/* ------------------------------------------------------------------ */

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

/** HIGH priority — frequently used in forms */
const REF_DATA_HIGH = [
  { type: 'species', path: '/api/v1/master-data/species?limit=5000' },
  { type: 'diseases', path: '/api/v1/master-data/diseases?limit=5000' },
  { type: 'breeds', path: '/api/v1/master-data/ref/breeds/for-select' },
];

/** LOW priority — less frequently used */
const REF_DATA_LOW = [
  { type: 'age-groups', path: '/api/v1/master-data/ref/age-groups/for-select' },
  { type: 'vaccine-types', path: '/api/v1/master-data/ref/vaccine-types/for-select' },
  { type: 'control-measures', path: '/api/v1/master-data/ref/control-measures/for-select' },
  { type: 'units', path: '/api/v1/master-data/ref/units/for-select' },
];

async function prefetchRefDataBatch(
  ctx: PrefetchContext,
  batch: { type: string; path: string }[],
): Promise<void> {
  for (const { type, path } of batch) {
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

async function prefetchGeoAdmin1(ctx: PrefetchContext): Promise<void> {
  if (!ctx.countryCode) return;
  try {
    const fresh = await isGeoFresh(ctx.countryCode);
    if (fresh) return;

    // Only fetch COUNTRY + ADMIN1 for HIGH priority (lighter payload)
    const entities = await apiFetch<any[]>(
      ctx.apiBaseUrl,
      `/api/v1/master-data/geo/entities?countryCode=${ctx.countryCode}&level=COUNTRY,ADMIN1&limit=500`,
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

async function prefetchGeoFull(ctx: PrefetchContext): Promise<void> {
  if (!ctx.countryCode) return;
  try {
    // Fetch ALL levels including ADMIN2/3
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
/*  Form templates + Campaigns (CRITICAL)                              */
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
/*  Dashboard KPIs (LOW)                                               */
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
/*  Task registry                                                      */
/* ------------------------------------------------------------------ */

function buildTaskList(): PrefetchTask[] {
  return [
    // CRITICAL — needed for data entry immediately
    { name: 'Active campaigns', priority: PrefetchPriority.CRITICAL, fn: prefetchCampaigns },
    { name: 'Form templates',   priority: PrefetchPriority.CRITICAL, fn: prefetchTemplates },

    // HIGH — most used reference data + admin1
    { name: 'Species & diseases',   priority: PrefetchPriority.HIGH, fn: (ctx) => prefetchRefDataBatch(ctx, REF_DATA_HIGH) },
    { name: 'Admin divisions (L1)', priority: PrefetchPriority.HIGH, fn: prefetchGeoAdmin1 },

    // LOW — remaining data, fetched during idle time
    { name: 'Other reference data', priority: PrefetchPriority.LOW, fn: (ctx) => prefetchRefDataBatch(ctx, REF_DATA_LOW) },
    { name: 'Admin divisions (full)', priority: PrefetchPriority.LOW, fn: prefetchGeoFull },
    { name: 'Dashboard KPIs',      priority: PrefetchPriority.LOW, fn: prefetchDashboards },
  ];
}

/* ------------------------------------------------------------------ */
/*  Progress tracking                                                  */
/* ------------------------------------------------------------------ */

let prefetchInProgress = false;
let cancelled = false;

export interface PrefetchProgress {
  /** Total number of prefetch tasks */
  total: number;
  /** Number of completed tasks (success or fail) */
  completed: number;
  /** Name of the task currently running */
  currentTask: string;
  /** Whether the entire prefetch is done */
  done: boolean;
  /** Current priority level being processed */
  currentPriority: PrefetchPriority;
  /** Connection speed detected */
  connectionSpeed: ConnectionSpeed;
}

type ProgressListener = (progress: PrefetchProgress) => void;
const listeners = new Set<ProgressListener>();

export function onPrefetchProgress(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitProgress(progress: PrefetchProgress) {
  for (const fn of listeners) {
    try { fn(progress); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Idle scheduling helper                                             */
/* ------------------------------------------------------------------ */

function waitForIdle(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: timeoutMs });
    } else {
      // Fallback for Safari / older browsers
      setTimeout(resolve, 100);
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/*  Main prefetch orchestrator                                         */
/* ------------------------------------------------------------------ */

/**
 * Run the progressive offline prefetch pipeline.
 * Call this after successful login when online.
 *
 * Tasks are processed in priority order:
 *   CRITICAL → immediate
 *   HIGH     → after 5s idle
 *   LOW      → requestIdleCallback / after 30s
 *
 * Bandwidth detection limits which levels are fetched.
 */
export async function runOfflinePrefetch(ctx: PrefetchContext): Promise<void> {
  if (prefetchInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  prefetchInProgress = true;
  cancelled = false;

  const speed = detectConnectionSpeed();
  const maxPriority = getMaxPriority(speed);
  const allTasks = buildTaskList();
  const eligibleTasks = allTasks.filter((t) => t.priority <= maxPriority);

  const total = eligibleTasks.length;
  let completed = 0;

  emitProgress({
    total, completed: 0, currentTask: 'Starting...', done: false,
    currentPriority: PrefetchPriority.CRITICAL, connectionSpeed: speed,
  });

  try {
    // Request persistent storage
    await requestPersistentStorage();

    // Group tasks by priority
    const critical = eligibleTasks.filter((t) => t.priority === PrefetchPriority.CRITICAL);
    const high = eligibleTasks.filter((t) => t.priority === PrefetchPriority.HIGH);
    const low = eligibleTasks.filter((t) => t.priority === PrefetchPriority.LOW);

    // ── CRITICAL: run immediately ──
    for (const task of critical) {
      if (cancelled) break;
      emitProgress({
        total, completed, currentTask: task.name, done: false,
        currentPriority: PrefetchPriority.CRITICAL, connectionSpeed: speed,
      });
      try { await task.fn(ctx); } catch { /* non-blocking */ }
      completed++;
    }

    // ── HIGH: wait 5s then run ──
    if (high.length > 0 && !cancelled) {
      await delay(5000);
      for (const task of high) {
        if (cancelled) break;
        // Re-check connectivity
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        emitProgress({
          total, completed, currentTask: task.name, done: false,
          currentPriority: PrefetchPriority.HIGH, connectionSpeed: speed,
        });
        try { await task.fn(ctx); } catch { /* non-blocking */ }
        completed++;
      }
    }

    // ── LOW: wait for idle then run ──
    if (low.length > 0 && !cancelled) {
      await waitForIdle(30_000);
      for (const task of low) {
        if (cancelled) break;
        if (typeof navigator !== 'undefined' && !navigator.onLine) break;
        emitProgress({
          total, completed, currentTask: task.name, done: false,
          currentPriority: PrefetchPriority.LOW, connectionSpeed: speed,
        });
        try { await task.fn(ctx); } catch { /* non-blocking */ }
        completed++;
        // Small delay between LOW tasks to avoid saturating bandwidth
        await delay(500);
      }
    }

    emitProgress({
      total, completed, currentTask: '', done: true,
      currentPriority: PrefetchPriority.LOW, connectionSpeed: speed,
    });
    console.log(`[ARIS Offline] Prefetch complete — ${completed}/${total} tasks (${speed} connection)`);
  } catch (err) {
    console.warn('[ARIS Offline] Prefetch error:', err);
    emitProgress({
      total, completed, currentTask: 'Error', done: true,
      currentPriority: PrefetchPriority.LOW, connectionSpeed: speed,
    });
  } finally {
    prefetchInProgress = false;
  }
}

/**
 * Cancel an in-progress prefetch.
 * Already-running tasks will complete, but no new tasks will start.
 */
export function cancelPrefetch(): void {
  cancelled = true;
}

/**
 * Check if a prefetch is currently running.
 */
export function isPrefetching(): boolean {
  return prefetchInProgress;
}
