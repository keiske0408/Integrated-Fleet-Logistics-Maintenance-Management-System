const CACHE_NAME = 'hulma-driver-shell-v2';
const STATIC_ASSETS = ['/manifest.json', '/pwa-icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Silently continue if assets cannot be pre-cached
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only process GET requests
  if (event.request.method !== 'GET') return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }

  // 1. Strictly ignore chrome-extension, data URIs, and cross-origin requests
  if (url.origin !== self.location.origin) return;
  if (!url.protocol.startsWith('http')) return;

  // 2. Bypass API requests completely (handled by client-side offlineQueue)
  if (url.pathname.startsWith('/api/')) return;

  // 3. Bypass Vite development internals, HMR, and source modules
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('hot-update') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.map')
  ) {
    return;
  }

  // 4. Navigation requests (HTML documents)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        const shell = (await caches.match('/driver')) || (await caches.match('/'));
        if (shell) return shell;
        return new Response('Offline - Hulma Fleet Management System', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'text/plain' },
        });
      }),
    );
    return;
  }

  // 5. Static assets: only cache manifest, icons, images, and built production assets
  const isCacheableAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/pwa-icon.svg' ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico');

  if (!isCacheableAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseClone).catch(() => {
                  // Silently ignore quota or storage errors
                });
              })
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    }),
  );
});
