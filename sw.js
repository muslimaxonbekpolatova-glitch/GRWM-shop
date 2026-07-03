const CACHE_NAME = 'grwm-v1';
// Supabase va Firebase ulanishlarini tekshirish uchun maxsus funksiya
function isApiRequest(requestUrl) {
  const url = new URL(requestUrl);
  return (
    url.origin.includes('supabase.co') || 
    url.origin.includes('firebaseio.com') || 
    url.origin.includes('googleapis.com') ||
    url.origin.includes('emailjs.com')
  );
}
const ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/reels.html',
  '/upload.html',
  '/profile.html',
  '/chat.html', 
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  if (isApiRequest(e.request.url)) {
    return e.respondWith(fetch(e.request));
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
