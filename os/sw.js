const CACHE = 'bbc-cc-v18';
const ASSETS = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const isHTML = req.mode === 'navigate' || (req.destination === 'document') || req.url.endsWith('/') || req.url.endsWith('index.html');
  if (isHTML) {
    // network-first for the app shell so deploys show immediately
    e.respondWith(fetch(req).catch(() => caches.match('./index.html') || caches.match(req)));
  } else {
    // cache-first for static assets (icons, fonts)
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
