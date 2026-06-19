// WW Dashboard PWA service worker — network-first for the app shell so deploys show,
// cache-first for icons. Lets the dashboard install to the phone home screen.
const CACHE = 'ww-dash-v1';
const ASSETS = ['./manifest.webmanifest', './ww-icon-192.png', './ww-icon-512.png', './ww-icon-180.png'];

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
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || req.url.endsWith('/') || req.url.endsWith('index.html');
  if (isHTML) {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html') || caches.match(req)));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
