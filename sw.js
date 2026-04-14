// ============================================
//   ROCKBOUND GAMING — SERVICE WORKER
//   Enables offline support and fast repeat loads
// ============================================

const CACHE_VERSION = 'rbg-v3';

// Static assets to pre-cache when the service worker installs.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/style.min.css?v=232',
  '/js/main.min.js?v=221',
  '/assets/logos/tplogo.png',
  '/assets/logos/favcon.jpg',
  '/live-status.json',
  '/manifest.json'
];

// ---- Install: pre-cache core assets ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ---- Activate: remove stale caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---- Fetch: serve from cache or network ----
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // live-status.json — network first, fall back to cache.
  // This keeps live stream data as fresh as possible while still working offline.
  if (url.pathname.endsWith('/live-status.json')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // JS and CSS — network first, fall back to cache.
  // These files change on every deploy so we must always try the network first.
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Same-origin static assets (images, HTML, JSON, etc.) — cache first, then network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // CDN resources (Google Fonts, Font Awesome) — cache first after first load.
  const isCDN = url.hostname === 'fonts.googleapis.com' ||
                url.hostname === 'fonts.gstatic.com' ||
                url.hostname === 'cdnjs.cloudflare.com';

  if (isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  }
});
