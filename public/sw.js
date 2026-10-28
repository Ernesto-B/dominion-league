/* Keeps the site's own files so it opens with no connection. League data is NOT cached here (it comes from Supabase and has its own
   saved copy, src/lib/snapshot.js). Same-origin GETs only, so sign-in and the database are never touched.
   - the page itself and data/config.json: network first, the saved copy when the network fails
   - /assets/* (hashed filenames, never change): cache first
   - icons and images: the saved copy at once, refreshed in the background */
const CACHE = 'dn-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = async (req, res) => { if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone()); return res; };

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname;
  if (req.mode === 'navigate' || path.endsWith('/data/config.json') || path.endsWith('.webmanifest')) {
    e.respondWith(fetch(req).then(res => put(req.mode === 'navigate' ? new Request(new URL('./', self.registration.scope)) : req, res)).catch(async () =>
      (await caches.match(req.mode === 'navigate' ? new Request(new URL('./', self.registration.scope)) : req)) || Response.error()));
  } else if (path.includes('/assets/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
  } else {
    e.respondWith(caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => put(req, res)).catch(() => hit);
      return hit || fresh;
    }));
  }
});
