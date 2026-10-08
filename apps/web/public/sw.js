/**
 * ARIS 4.0 — Service Worker (Workbox-based)
 *
 * Caching strategies:
 *   - Cache-first:  static assets (images, fonts, CSS, JS chunks)
 *   - Stale-while-revalidate:  reference/master data API, dashboard data
 *   - Network-first:  HTML navigation (offline fallback)
 *   - Network-only:  mutations (POST/PUT/PATCH/DELETE) — handled by sync queue
 *
 * The SW never intercepts mutations — those are managed by the in-app
 * SyncQueue (IndexedDB) which replays them when connectivity returns.
 */

/* global importScripts, workbox */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

// ── Workbox config ──
workbox.setConfig({ debug: false });

const { routing, strategies, cacheableResponse, expiration, precaching } = workbox;

// ── Version — bump on breaking changes to force cache clear ──
const SW_VERSION = 'aris-sw-v2';

// ── Precache: offline fallback page ──
precaching.precacheAndRoute([
  { url: '/offline', revision: SW_VERSION },
]);

// ── Skip waiting + claim ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Clean old caches from the previous hand-written SW
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k === 'aris-v4') // old cache name
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ═══════════════════════════════════════════════════════════════════
//  ROUTING RULES
// ═══════════════════════════════════════════════════════════════════

// ── 1. Static assets: Cache-first (images, fonts) ──
routing.registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font',
  new strategies.CacheFirst({
    cacheName: 'aris-static-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 }),
    ],
  }),
);

// ── 2. Next.js static chunks: Cache-first ──
routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/_next/static/'),
  new strategies.CacheFirst({
    cacheName: 'aris-chunks-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 3600 }),
    ],
  }),
);

// ── 3. CSS stylesheets: Cache-first ──
routing.registerRoute(
  ({ request }) => request.destination === 'style',
  new strategies.CacheFirst({
    cacheName: 'aris-styles-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 3600 }),
    ],
  }),
);

// ── 4. Reference data API: Stale-while-revalidate ──
// Covers: /api/v1/master-data/*, /api/v1/public/settings/*
routing.registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/v1/master-data/') ||
    url.pathname.startsWith('/api/v1/public/settings/'),
  new strategies.StaleWhileRevalidate({
    cacheName: 'aris-refdata-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 3600 }),
    ],
  }),
);

// ── 5. Form templates: Network-first + cache ──
routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/form-builder/'),
  new strategies.NetworkFirst({
    cacheName: 'aris-templates-v1',
    networkTimeoutSeconds: 8,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 6 * 3600 }),
    ],
  }),
);

// ── 6. Analytics/Dashboard API: Stale-while-revalidate ──
routing.registerRoute(
  ({ url }) =>
    url.pathname.startsWith('/api/v1/analytics/') ||
    url.pathname.startsWith('/api/v1/bi/'),
  new strategies.StaleWhileRevalidate({
    cacheName: 'aris-dashboard-v1',
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 5 * 60 }),
    ],
  }),
);

// ── 7. Collecte GET requests: Network-first ──
routing.registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.pathname.startsWith('/api/v1/collecte/') ||
     url.pathname.startsWith('/api/v1/workflow/')),
  new strategies.NetworkFirst({
    cacheName: 'aris-collecte-v1',
    networkTimeoutSeconds: 8,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 3600 }),
    ],
  }),
);

// ── 8. Other API GET requests: Network-only (pass through) ──
// Mutations (POST/PUT/PATCH/DELETE) are never intercepted.
routing.registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/'),
  new strategies.NetworkOnly(),
);

// ── 9. HTML navigation: Network-first with offline fallback ──
routing.registerRoute(
  ({ request }) => request.mode === 'navigate',
  new strategies.NetworkFirst({
    cacheName: 'aris-pages-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
      new expiration.ExpirationPlugin({ maxEntries: 50 }),
    ],
  }),
);

// ── 10. Offline fallback for navigation ──
routing.setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate') {
    return caches.match('/offline') || new Response(
      '<html><body><h1>ARIS — Offline</h1><p>No cached version available.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } },
    );
  }
  return Response.error();
});

// ── Never intercept these ──
routing.registerRoute(
  ({ url }) =>
    url.pathname === '/sw.js' ||
    url.pathname.includes('/manifest'),
  new strategies.NetworkOnly(),
);
