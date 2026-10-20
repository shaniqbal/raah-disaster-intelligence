/* RAAH service worker — offline-first presentation reliability.
 *
 * - On install, every app route is fetched and cached together with the
 *   /_next/static chunks it references, so the full demo works offline after
 *   one online visit.
 * - Static chunks: cache-first (they are content-hashed and immutable).
 * - Pages and RSC payloads: network-first with a short timeout, falling back
 *   to the cache, then to the cached Mission Control shell.
 * - /api/* and cross-origin requests (USGS, Open-Meteo) are never cached here:
 *   live data must stay honest; the app labels cached live data itself.
 */
const VERSION = 'raah-v1';
const PAGE_CACHE = `${VERSION}-pages`;
const STATIC_CACHE = `${VERSION}-static`;
const ROUTES = ['/', '/mission-control', '/live', '/risk', '/simulator', '/map', '/evacuation', '/resources', '/sos', '/history', '/copilot', '/methodology', '/demo'];
const EXTRA = ['/icon.svg', '/manifest.webmanifest'];

async function precache() {
  const pages = await caches.open(PAGE_CACHE);
  const stat = await caches.open(STATIC_CACHE);
  const assets = new Set(EXTRA);
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const res = await fetch(route, { cache: 'reload', credentials: 'same-origin' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await pages.put(route, res);
        for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)["')]/g)) assets.add(m[1]);
      } catch {
        /* offline during install — runtime caching will fill in */
      }
    }),
  );
  await Promise.all([...assets].map((url) => stat.add(url).catch(() => {})));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function networkFirst(request, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(request), timeout(4000)]);
    if (res && res.ok) cache.put(key ?? request, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(key ?? request, { ignoreVary: true })) || (await cache.match(request, { ignoreSearch: true, ignoreVary: true }));
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const shell = await cache.match('/mission-control');
      if (shell) return shell;
    }
    return new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // live APIs stay network-only
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || EXTRA.includes(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  const isRsc = request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');
  if (request.mode === 'navigate') {
    // Cache pages by path so shared scenario links (?s=…) still open offline.
    event.respondWith(networkFirst(request, PAGE_CACHE, url.pathname));
  } else if (isRsc) {
    event.respondWith(networkFirst(request, PAGE_CACHE, `${url.pathname}?__rsc`));
  }
});
