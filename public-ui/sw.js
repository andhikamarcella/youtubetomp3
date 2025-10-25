const CACHE_NAME = 'ytmp3-ui-v5';
const CDN_CACHE = 'ytmp3-cdn-v2';

const scopeReference = (self.registration && self.registration.scope) || self.location.href;
const scopeUrl = new URL(scopeReference);
const resolveToScopeUrl = (path) => new URL(path, scopeUrl).toString();
const resolveToScopePath = (path) => new URL(path, scopeUrl).pathname;

const APP_SHELL = [
  './',
  'index.html',
  'share.html',
  'private.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-maskable.svg'
].map((entry) => resolveToScopeUrl(entry));
const NAVIGATION_FALLBACKS = ['./', 'index.html'].map((entry) => resolveToScopeUrl(entry));
const API_PREFIX = resolveToScopePath('api/');
const ADMIN_PREFIX = resolveToScopePath('admin/');

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
  if (url.origin !== scopeUrl.origin) {
    return /cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host);
  }
  if (url.pathname.startsWith(API_PREFIX)) return false;
  if (url.pathname.startsWith(ADMIN_PREFIX)) return false;
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
        for (const fallbackUrl of NAVIGATION_FALLBACKS) {
          const match = await cache.match(fallbackUrl);
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
