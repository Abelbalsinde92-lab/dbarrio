const CACHE = 'dbarrio-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/socio.html',
  '/manifest.json',
  '/assets/icons/db-icon-192.png',
  '/assets/icons/db-icon-512.png'
];

// Instalar y cachear assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Limpiar cachés viejos al activar
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Network first → caché como fallback
// Así siempre ven la versión más nueva si hay internet
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Si la respuesta es válida, la guarda en caché y la devuelve
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request)) // Sin internet → usa caché
  );
});
