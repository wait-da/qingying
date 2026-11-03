// Offline support: pages load fresh when online and fall back to the saved copy when offline;
// icons and other files come from the saved copy first.
const CACHE = 'qingying-v2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'reminders.ics',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, { signal: ctl.signal });
        clearTimeout(timer);
        if (r.ok) { c.put('./', r.clone()); c.put('index.html', r.clone()); }
        return r;
      } catch (err) {
        return (await c.match('./')) || (await c.match('index.html')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  }));
});
