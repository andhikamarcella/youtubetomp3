const CACHE_NAME = 'ytmp3-ui-v3';
const CDN_CACHE = 'ytmp3-cdn-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/share.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-maskable.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (url) => {
          try {
            const request = new Request(url, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await cache.put(request, response.clone());
            }
          } catch (err) {
            console.warn('[sw] gagal menyimpan shell', url, err);
          }
        })
      );
    })().catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== CDN_CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

const shouldHandle = (request) => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/admin/')) return false;
  return true;
};

self.addEventListener('fetch', (event) => {
  if (!shouldHandle(event.request)) return;
  const request = event.request;
  const url = new URL(request.url);
  const offlineResponse = () => new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const isNavigate = request.mode === 'navigate' || request.destination === 'document';

      const fetchAndCache = async () => {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      };

      const matchNavigationFallback = async () => {
        const fallbacks = ['/index.html', '/'];
        for (const urlPath of fallbacks) {
          const match = await cache.match(urlPath);
          if (match) return match;
        }
        return null;
      };

      if (isNavigate) {
        try {
          return await fetchAndCache();
        } catch (err) {
          if (cached) return cached;
          const fallback = await matchNavigationFallback();
          if (fallback) return fallback;
          return offlineResponse();
        }
      }

      if (cached) {
        fetchAndCache().catch(() => {});
        return cached;
      }

      try {
        return await fetchAndCache();
      } catch (err) {
        return offlineResponse();
      }
    })());
    return;
  }

  if (/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(request);
      if (cached) {
        fetch(request).then((response) => cache.put(request, response.clone())).catch(() => {});
        return cached;
      }
      try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      } catch (err) {
        return offlineResponse();
      }
    })());
  }
});
