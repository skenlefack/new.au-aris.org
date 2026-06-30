const CACHE_NAME = 'aris-v4';
// Don't precache HTML pages — they change on every deploy and ISR revalidation.
// Only static assets (images, fonts, styles) are cached via the fetch handler below.
const PRECACHE_URLS = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET — POST/PUT/PATCH/DELETE pass through untouched
  if (req.method !== 'GET') return;

  // Same-origin only — never intercept BI subdomains or external resources
  if (!req.url.startsWith(self.location.origin)) return;

  // Never intercept API calls — let the browser deliver real Response objects
  // and real errors to the app's fetch logic
  if (req.url.includes('/api/')) return;

  // Never intercept the manifest, the SW itself, or Next.js internals
  if (
    req.url.includes('/manifest.webmanifest') ||
    req.url.includes('/manifest.json') ||
    req.url.includes('/sw.js') ||
    req.url.includes('/_next/data/') ||
    req.url.includes('/_next/static/chunks/')
  ) {
    return;
  }

  // Cache-first for static media assets (images, fonts, stylesheets)
  if (
    req.destination === 'image' ||
    req.destination === 'font' ||
    req.destination === 'style'
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return response;
          })
          .catch(() => new Response('', { status: 504, statusText: 'Gateway Timeout' }));
      }),
    );
    return;
  }

  // Network-first for HTML navigation only — always return a Response
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(req).then(
          (cached) =>
            cached ||
            caches.match('/').then(
              (root) =>
                root ||
                new Response('<h1>Offline</h1>', {
                  status: 503,
                  headers: { 'Content-Type': 'text/html' },
                }),
            ),
        ),
      ),
    );
    return;
  }

  // Everything else: do NOT intercept — let the browser handle it natively
});
