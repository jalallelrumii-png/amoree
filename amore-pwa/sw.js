// ═══════════════════════════════════════════════
//  AMORE SERVICE WORKER — v1.0.0
//  Strategi: Cache-first untuk asset, Network-first untuk halaman
// ═══════════════════════════════════════════════

const CACHE_NAME = 'amore-v1.0.0';
const STATIC_CACHE = 'amore-static-v1';
const DYNAMIC_CACHE = 'amore-dynamic-v1';

// File yang langsung di-cache saat install
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ── INSTALL: Cache semua file statis
self.addEventListener('install', event => {
  console.log('[SW] Installing Amore Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      console.log('[SW] Install complete — skipping waiting');
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: Hapus cache lama
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

// ── FETCH: Strategi caching
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET dan chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Untuk navigasi (halaman HTML) → Network first, fallback ke cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Untuk asset (gambar, font, dll.) → Cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Hanya cache response yang valid
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Fallback untuk gambar
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#1A0F03" width="100" height="100"/><text fill="#C9A84C" x="50" y="55" text-anchor="middle" font-size="14">Amore</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (siap untuk future)
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title = data.title || '💍 Amore Wedding Planner';
  const options = {
    body: data.body || 'Ada pengingat untuk pernikahan Anda!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Buka Aplikasi' },
      { action: 'dismiss', title: 'Nanti Saja' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ── BACKGROUND SYNC (untuk sinkronisasi data offline)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-expenses') {
    console.log('[SW] Background sync: expenses');
    // Future: sync ke server
  }
});

console.log('[SW] Amore Service Worker loaded ✦');
