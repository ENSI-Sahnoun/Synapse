// ponytail: hand-rolled SW (no serwist/workbox) — @serwist/next's webpack
// plugin doesn't support Turbopack (Next 16 default), and the Turbopack
// variant is still preview-only. Caches the app shell + same-origin static
// assets only; never touches API/data requests (avoids stale bookings data).
const CACHE_NAME = 'synapse-shell-v1';
const SHELL_URLS = ['/', '/manifest.json', '/logos/icon-192.png', '/logos/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheableStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/logos/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname === '/manifest.json')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isCacheableStaticAsset(url)) return;

  // Stale-while-revalidate: serve from cache instantly, refresh in background.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
