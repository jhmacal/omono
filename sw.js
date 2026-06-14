const CACHE = "omono-v6";
const ASSETS = ["./index.html", "./manifest.json", "./icons/icon-192-v5.png", "./icons/icon-512-v5.png", "./icons/apple-touch-icon-v5.png", "./icons/sliders-v5.png", "./icons/wordmark-graphite-v5.png", "./icons/wordmark-white-v5.png", "./apple-touch-icon.png", "./apple-touch-icon-precomposed.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // never intercept API calls
  if (e.request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    e.respondWith(
      fetch(e.request, { cache: "reload" }).catch(() => caches.match("./index.html"))
    );
    return;
  }
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return resp;
    }))
  );
});
