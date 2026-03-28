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

// ── Instalar y cachear assets estáticos ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Limpiar cachés viejos al activar ──
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

// ── Network first → caché como fallback ──
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push: mostrar notificación ──
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch (_) {}

  const title   = data.title || 'dbarrio';
  const options = {
    body:    data.body  || 'Nueva actividad',
    icon:    data.icon  || '/assets/icons/db-icon-192.png',
    badge:            '/assets/icons/db-icon-192.png',
    vibrate: [200, 100, 200],
    tag:     data.tag   || 'dbarrio-notif',
    renotify: true,
    data:    data.data  || { url: '/admin.html' }
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic en notificación: abrir o enfocar la página ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/admin.html';

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(url) || c.url.includes('admin') || c.url.includes('socio'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
