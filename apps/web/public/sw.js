const CACHE_NAME = 'aris-v2';
const PRECACHE_URLS = ['/', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests entirely (POST/PUT/PATCH/DELETE can't be cached)
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (BI subdomains, external resources)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // API calls: pass-through to network. Do NOT intercept — let the browser
  // handle errors naturally so the app's fetch logic sees real Response objects.
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Cache-first for static assets
  if (
    event.request.destination === 'image' ||
    event.request.destination === 'font' ||
    event.request.destination === 'style'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 504, statusText: 'Gateway Timeout' }));
      })
    );
    return;
  }

  // Network-first for navigation — always return a Response, never undefined
  event.respondWith(
    fetch(event.request)
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return caches.match('/').then((root) => root || new Response(
            '<h1>Offline</h1>',
            { status: 503, headers: { 'Content-Type': 'text/html' } },
          ));
        })
      ),
  );
});
