// BBC Messenger service worker — installable app shell only.
// We deliberately do NOT cache API calls or messages (those must always be live).
const SHELL = "bbc-chat-shell-v6";
const ASSETS = ["/chat/", "/chat/index.html", "/chat/icon-192.png", "/chat/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Push: show a notification even when the app is closed.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || "BBC Messenger";
  e.waitUntil(self.registration.showNotification(title, {
    body: (d.body || "New message").slice(0, 140),
    icon: "/chat/icon-192.png",
    badge: "/chat/icon-192.png",
    tag: d.tag || "bbcmsg",
    data: { url: d.url || "/chat/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/chat/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if (c.url.includes("/chat") && "focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  }));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache the API or auth — always go to network so messages are live.
  if (url.pathname.includes("/.netlify/functions/") || url.hostname.includes("supabase")) return;
  if (e.request.method !== "GET") return;
  // App shell: cache-first for our own static files, network for everything else.
  if (url.pathname.startsWith("/chat/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
