const CACHE_NAME = 'grwm-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/reels.html',
  '/upload.html',
  '/profile.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
