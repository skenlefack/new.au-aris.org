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
const SW_VERSION = 'aris-sw-v4';
const STATIC_CACHE = 'aris-static-v2';
const PAGES_CACHE = 'aris-pages-v2';
const RSC_CACHE = 'aris-rsc-v1';
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
