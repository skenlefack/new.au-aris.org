/**
 * ARIS 4.0 — Service Worker (Workbox-based, self-contained)
 *
 * Workbox is loaded from Google CDN on install. Once installed,
 * the SW works fully offline — importScripts is cached by the browser.
 *
 * Caching strategies:
 *   - Cache-first:  static assets (images, fonts, CSS, JS chunks)
 *   - Stale-while-revalidate:  reference/master data API, dashboard data
 *   - Network-first:  HTML navigation (offline fallback to cached page or /offline shell)
 *   - Network-only:  mutations (POST/PUT/PATCH/DELETE)
 */

/* global importScripts, workbox */
try {
  importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
} catch (e) {
  // CDN unreachable — if this is an update, the old SW continues to work.
  // If this is a fresh install, the SW simply won't have Workbox strategies
  // but basic offline behavior still works via the fetch handler below.
  console.warn('[ARIS SW] Workbox CDN unreachable, using basic offline mode');
}

// ── Version — bump on breaking changes to force cache clear ──
const SW_VERSION = 'aris-sw-v3';
const STATIC_CACHE = 'aris-static-v2';
const PAGES_CACHE = 'aris-pages-v2';
const API_CACHE = 'aris-api-v2';

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
            k === 'aris-v4' || // old hand-written SW cache
            k === 'aris-static-v1' || k === 'aris-chunks-v1' || k === 'aris-styles-v1' ||
            k === 'aris-pages-v1' || k === 'aris-refdata-v1' || k === 'aris-templates-v1' ||
            k === 'aris-dashboard-v1' || k === 'aris-collecte-v1' // old Workbox caches
          )
          .map((k) => caches.delete(k)),
      ),
    )
    // Pre-cache critical pages so they're available offline immediately
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

  // ── 2. Next.js JS chunks: Cache-first ──
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

  // ── 3. API GET requests: Stale-while-revalidate ──
  // Covers ref data, form templates, dashboard data, analytics, collecte, settings
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

  // ── 4. HTML navigation: Network-first with generous timeout ──
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

  // ── 5. Offline fallback for navigation ──
  routing.setCatchHandler(async ({ event }) => {
    if (event.request.mode === 'navigate') {
      // 1. Try exact cached match for the requested page
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // 2. Serve the app shell (/home) — Next.js client-side routing handles the rest
      const appShell = await caches.match('/home');
      if (appShell) return appShell;
      // 3. Try the offline page
      const offlinePage = await caches.match('/offline');
      if (offlinePage) return offlinePage;
      // Last resort
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>ARIS — Offline</title></head>' +
        '<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa">' +
        '<div style="text-align:center;max-width:400px;padding:2rem">' +
        '<h1 style="color:#1B5E20;font-size:1.5rem">ARIS — Offline</h1>' +
        '<p style="color:#666;margin:1rem 0">You are currently offline. Please check your connection.</p>' +
        '<button onclick="location.reload()" style="background:#1B5E20;color:white;border:none;padding:0.75rem 1.5rem;border-radius:0.5rem;cursor:pointer;font-size:0.875rem">Retry</button>' +
        '</div></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } },
      );
    }
    return Response.error();
  });

  // ── Never intercept SW itself or manifest ──
  routing.registerRoute(
    ({ url }) => url.pathname === '/sw.js' || url.pathname.includes('/manifest'),
    new strategies.NetworkOnly(),
  );

} else {
  // ═══════════════════════════════════════════════════════════════════
  //  FALLBACK — Workbox not available (CDN unreachable on first install)
  // ═══════════════════════════════════════════════════════════════════

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (!req.url.startsWith(self.location.origin)) return;
    if (req.url.includes('/api/') || req.url.includes('/sw.js') || req.url.includes('/manifest')) return;

    // Cache-first for static assets
    if (req.destination === 'image' || req.destination === 'font' || req.destination === 'style' ||
        req.url.includes('/_next/static/')) {
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
            cached || new Response('<h1>ARIS — Offline</h1>', { status: 503, headers: { 'Content-Type': 'text/html' } }),
          ),
        ),
      );
      return;
    }
  });
}
