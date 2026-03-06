const CACHE = "dbarrio-v1";

const ASSETS = [
  "/",
  "/index.html",
  "/admin.html",
  "/socio.html",
  "/manifest.json",
  "/assets/icons/db-icon-192.png",
  "/assets/icons/db-icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});