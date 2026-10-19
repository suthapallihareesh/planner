/* Planner service worker.
   - The app page is fetched network-first, so updates show up as soon as you are online,
     and the last copy is used when the connection drops.
   - The Supabase library and the fonts are cached after the first visit.
   - Supabase traffic (sign-in, tasks, chat, files, realtime) is never touched: it always goes straight to the network.
   Bump VERSION whenever you want every device to drop its old cache. */
const VERSION = "planner-v8";
const SHELL = ["./", "./index.html"];
const CACHEABLE_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(VERSION);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return (await caches.match(request)) || (await caches.match("./index.html")) || (await caches.match("./")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (res) => {
      if (res && (res.ok || res.type === "opaque")) {
        const cache = await caches.open(VERSION);
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => cached || Response.error());
  return cached || refresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (CACHEABLE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Anything else (your Supabase project, etc.) is left alone.
});
