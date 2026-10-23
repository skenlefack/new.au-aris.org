/**
 * ARIS 4.0 — Service Worker (Workbox + Next.js App Router aware)
 *
 * Key insight: Next.js App Router uses RSC (React Server Components) for
 * client-side navigation. When clicking a link, Next.js fetches the new
 * page's RSC payload (same URL, with RSC:1 header). This is NOT a
 * `navigate` request — it's a regular fetch. The SW must cache these
 * RSC responses too, otherwise offline navigation breaks completely.
 *
 * Caching strategies:
 *   - Cache-first:  static assets (images, fonts, CSS, JS chunks)
 *   - StaleWhileRevalidate: RSC payloads (Next.js client-side navigation)
 *   - StaleWhileRevalidate: API GET requests (ref data, dashboards, etc.)
 *   - NetworkFirst: full-page HTML navigation (initial load / hard refresh)
 *   - NetworkOnly: mutations (POST/PUT/PATCH/DELETE)
 */

/* global importScripts, workbox */
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
} catch (e) {
  console.warn('[ARIS SW] Workbox CDN unreachable, using basic offline mode');
}

// ── Version ──
const SW_VERSION = 'aris-sw-v5';
const STATIC_CACHE = 'aris-static-v2';
const PAGES_CACHE = 'aris-pages-v2';
const RSC_CACHE = 'aris-rsc-v1';
const API_CACHE = 'aris-api-v2';

// ── Background Sync tags ──
const SYNC_TAG = 'aris-sync-queue';
const PERIODIC_SYNC_TAG = 'aris-periodic-sync';

// ── Skip waiting + claim ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) =>
            // Clean ALL old caches from previous SW versions
            k === 'aris-v4' ||
            k === 'aris-static-v1' || k === 'aris-chunks-v1' || k === 'aris-styles-v1' ||
            k === 'aris-pages-v1' || k === 'aris-refdata-v1' || k === 'aris-templates-v1' ||
            k === 'aris-dashboard-v1' || k === 'aris-collecte-v1'
          )
          .map((k) => caches.delete(k)),
      ),
    )
    .then(() => caches.open(PAGES_CACHE))
    .then((cache) =>
      Promise.allSettled([
        cache.add('/home'),
        cache.add('/offline'),
        cache.add('/'),
      ]),
    )
    .then(() => self.clients.claim()),
  );
});

// ═══════════════════════════════════════════════════════════════════
//  Helper: detect Next.js RSC request
// ═══════════════════════════════════════════════════════════════════

function isRscRequest(request) {
  // Next.js App Router client-side navigation sends RSC:1 header
  return request.headers.get('RSC') === '1' ||
         request.headers.get('Next-Router-State-Tree') !== null;
}

function isNextDataRequest(url) {
  // Next.js internal data fetches
  return url.pathname.startsWith('/_next/data/');
}

// ═══════════════════════════════════════════════════════════════════
//  ROUTING — Workbox available
// ═══════════════════════════════════════════════════════════════════

if (typeof workbox !== 'undefined') {
  workbox.setConfig({ debug: false });
  const { routing, strategies, cacheableResponse, expiration } = workbox;

  // ── 1. Static assets: Cache-first ──
  routing.registerRoute(
    ({ request }) =>
      request.destination === 'image' ||
      request.destination === 'font' ||
      request.destination === 'style',
    new strategies.CacheFirst({
      cacheName: STATIC_CACHE,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new expiration.ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 }),
      ],
    }),
  );

  // ── 2. Next.js JS/CSS chunks: Cache-first ──
  routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/_next/static/'),
    new strategies.CacheFirst({
      cacheName: STATIC_CACHE,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new expiration.ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 3600 }),
      ],
    }),
  );

  // ── 3. Next.js RSC requests: StaleWhileRevalidate ──
  // This is THE critical route for offline navigation in App Router.
  // When user clicks a link, Next.js fetches the RSC payload for the target page.
  // We cache it so subsequent offline clicks serve the cached RSC payload.
  routing.registerRoute(
    ({ request, url }) =>
      request.method === 'GET' &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/_next/static/') &&
      url.pathname !== '/sw.js' &&
      !url.pathname.includes('/manifest') &&
      (isRscRequest(request) || isNextDataRequest(url)),
    new strategies.StaleWhileRevalidate({
      cacheName: RSC_CACHE,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new expiration.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 3600 }),
      ],
    }),
  );

  // ── 4. API GET requests: StaleWhileRevalidate ──
  routing.registerRoute(
    ({ url, request }) =>
      request.method === 'GET' && url.pathname.startsWith('/api/'),
    new strategies.StaleWhileRevalidate({
      cacheName: API_CACHE,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 3600 }),
      ],
    }),
  );

  // ── 5. HTML full-page navigation: NetworkFirst ──
  routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new strategies.NetworkFirst({
      cacheName: PAGES_CACHE,
      networkTimeoutSeconds: 4,
      plugins: [
        new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new expiration.ExpirationPlugin({ maxEntries: 60 }),
      ],
    }),
  );

  // ── 6. Offline fallback ──
  routing.setCatchHandler(async ({ event, request }) => {
    // For RSC requests: try serving cached RSC for /home so the app shell renders
    if (request && isRscRequest(request)) {
      // Try exact match first
      const cachedRsc = await caches.match(request);
      if (cachedRsc) return cachedRsc;

      // Serve /home RSC as fallback (app shell with client-side routing)
      const homeUrl = new URL('/home', self.location.origin);
      // Search the RSC cache for any /home entry
      const rscCache = await caches.open(RSC_CACHE);
      const rscKeys = await rscCache.keys();
      for (const key of rscKeys) {
        if (new URL(key.url).pathname === '/home') {
          const homeRsc = await rscCache.match(key);
          if (homeRsc) return homeRsc;
        }
      }
    }

    // For navigation requests
    if (event.request.mode === 'navigate') {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const appShell = await caches.match('/home');
      if (appShell) return appShell;
      const offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ARIS — Offline</title></head>' +
        '<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa">' +
        '<div style="text-align:center;max-width:400px;padding:2rem">' +
        '<h1 style="color:#1B5E20;font-size:1.5rem">ARIS — Offline</h1>' +
        '<p style="color:#666;margin:1rem 0">You are currently offline.</p>' +
        '<button onclick="location.reload()" style="background:#1B5E20;color:white;border:none;padding:0.75rem 1.5rem;border-radius:0.5rem;cursor:pointer">Retry</button>' +
        '</div></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } },
      );
    }

    return Response.error();
  });

  // ── Never intercept SW or manifest ──
  routing.registerRoute(
    ({ url }) => url.pathname === '/sw.js' || url.pathname.includes('/manifest'),
    new strategies.NetworkOnly(),
  );

} else {
  // ═══════════════════════════════════════════════════════════════════
  //  FALLBACK — Workbox not available
  // ═══════════════════════════════════════════════════════════════════

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (!req.url.startsWith(self.location.origin)) return;
    if (req.url.includes('/sw.js') || req.url.includes('/manifest')) return;

    const url = new URL(req.url);

    // Cache-first for static assets
    if (req.destination === 'image' || req.destination === 'font' || req.destination === 'style' ||
        url.pathname.startsWith('/_next/static/')) {
      event.respondWith(
        caches.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
            }
            return res;
          }).catch(() => new Response('', { status: 504 }));
        }),
      );
      return;
    }

    // StaleWhileRevalidate for RSC + API
    if (isRscRequest(req) || url.pathname.startsWith('/api/')) {
      const cacheName = isRscRequest(req) ? RSC_CACHE : API_CACHE;
      event.respondWith(
        caches.match(req).then((cached) => {
          const networkFetch = fetch(req).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(cacheName).then((c) => c.put(req, clone));
            }
            return res;
          }).catch(() => cached || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } }));
          return cached || networkFetch;
        }),
      );
      return;
    }

    // Network-first for navigation
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(PAGES_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('/home').then((home) =>
              home || new Response('<h1>ARIS — Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } }),
            ),
          ),
        ),
      );
      return;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
//  BACKGROUND SYNC — process offline queue even when app is closed
// ═══════════════════════════════════════════════════════════════════

/**
 * Open the aris-offline IndexedDB directly from the Service Worker.
 * Returns the raw IDBDatabase (not the `idb` wrapper — it's not available here).
 */
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('aris-offline-v1', 2);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    // If the DB hasn't been upgraded yet, create the auth-tokens store
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('auth-tokens')) {
        db.createObjectStore('auth-tokens', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Read auth tokens from IndexedDB.
 */
async function getTokensFromIDB() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('auth-tokens', 'readonly');
      const store = tx.objectStore('auth-tokens');
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Update auth tokens in IndexedDB after a refresh.
 */
async function updateTokensInIDB(accessToken, refreshToken) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('auth-tokens', 'readwrite');
      const store = tx.objectStore('auth-tokens');
      store.put({ key: 'current', accessToken, refreshToken, updatedAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Read all PENDING items from the sync-queue in IndexedDB.
 */
async function getPendingFromIDB() {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sync-queue', 'readonly');
      const store = tx.objectStore('sync-queue');
      const idx = store.index('by-status');
      const req = idx.getAll('PENDING');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Update a sync-queue item's status in IndexedDB.
 */
async function updateSyncItemInIDB(item) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sync-queue', 'readwrite');
      const store = tx.objectStore('sync-queue');
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Remove a sync-queue item from IndexedDB.
 */
async function removeSyncItemFromIDB(id) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('sync-queue', 'readwrite');
      const store = tx.objectStore('sync-queue');
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Mark an offline submission as SYNCED in IndexedDB.
 */
async function markSubmissionSyncedInIDB(submissionId) {
  try {
    const db = await openOfflineDB();
    return new Promise((resolve) => {
      const tx = db.transaction('submissions', 'readwrite');
      const store = tx.objectStore('submissions');
      const req = store.get(submissionId);
      req.onsuccess = () => {
        const sub = req.result;
        if (sub) {
          sub.syncStatus = 'SYNCED';
          sub.syncedAt = Date.now();
          store.put(sub);
        }
        tx.oncomplete = () => resolve(true);
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshTokenForSync(refreshToken) {
  try {
    const res = await fetch('/api/v1/credential/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccess = data?.accessToken || data?.data?.accessToken;
    const newRefresh = data?.refreshToken || data?.data?.refreshToken || refreshToken;
    if (newAccess) {
      await updateTokensInIDB(newAccess, newRefresh);
      return newAccess;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Process the sync queue from the Service Worker context.
 * Called by the 'sync' event and 'periodicsync' event.
 */
async function processSyncFromSW() {
  const BATCH_SIZE = 10;
  const MAX_RETRIES = 5;
  const result = { processed: 0, succeeded: 0, failed: 0, conflicts: 0 };

  // 1. Get auth tokens
  const tokens = await getTokensFromIDB();
  if (!tokens || !tokens.accessToken) {
    console.warn('[ARIS SW Sync] No tokens in IDB — sync deferred');
    return result;
  }

  let accessToken = tokens.accessToken;

  // 2. Get pending items
  const pending = await getPendingFromIDB();
  if (pending.length === 0) return result;

  console.log(`[ARIS SW Sync] Processing ${Math.min(pending.length, BATCH_SIZE)} items`);

  for (const item of pending.slice(0, BATCH_SIZE)) {
    result.processed++;

    // Mark as in-flight
    await updateSyncItemInIDB({ ...item, status: 'IN_FLIGHT' });

    try {
      const res = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(item.payload),
      });

      if (res.ok) {
        result.succeeded++;
        await removeSyncItemFromIDB(item.id);

        // Mark submission as synced if applicable
        const payload = item.payload;
        if (payload && payload.submissionId) {
          await markSubmissionSyncedInIDB(payload.submissionId);
        }
      } else if (res.status === 401) {
        // Token expired — try to refresh
        const newToken = await refreshTokenForSync(tokens.refreshToken);
        if (newToken) {
          accessToken = newToken;
          // Put back as pending for retry in same cycle
          await updateSyncItemInIDB({ ...item, status: 'PENDING' });
        } else {
          await updateSyncItemInIDB({
            ...item,
            status: 'FAILED',
            lastError: 'Authentication expired — please log in again',
          });
          result.failed++;
        }
      } else if (res.status === 409) {
        let serverData;
        try { serverData = await res.json(); } catch { /* ignore */ }
        await updateSyncItemInIDB({
          ...item,
          status: 'CONFLICT',
          serverResponse: serverData,
        });
        result.conflicts++;
      } else {
        // Other error — increment retry
        const newRetryCount = item.retryCount + 1;
        if (newRetryCount >= MAX_RETRIES) {
          let errMsg;
          try { errMsg = (await res.json())?.message || `HTTP ${res.status}`; } catch { errMsg = `HTTP ${res.status}`; }
          await updateSyncItemInIDB({
            ...item,
            status: 'FAILED',
            retryCount: newRetryCount,
            lastError: errMsg,
          });
          result.failed++;
        } else {
          await updateSyncItemInIDB({
            ...item,
            status: 'PENDING',
            retryCount: newRetryCount,
          });
        }
      }
    } catch (err) {
      // Network error — put back as pending
      await updateSyncItemInIDB({
        ...item,
        status: 'PENDING',
        retryCount: item.retryCount + 1,
        lastError: err.message || 'Network error',
      });
    }
  }

  // 3. Notify all open tabs about the sync result
  try {
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({
        type: 'BACKGROUND_SYNC_RESULT',
        payload: result,
      });
    }
  } catch { /* no clients open — that's fine */ }

  console.log(`[ARIS SW Sync] Done: ${result.succeeded} ok, ${result.failed} failed, ${result.conflicts} conflicts`);
  return result;
}

// ── Background Sync event ──
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processSyncFromSW());
  }
});

// ── Periodic Background Sync event (Chrome PWA only) ──
self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_SYNC_TAG) {
    event.waitUntil(processSyncFromSW());
  }
});
