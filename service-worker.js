const CACHE_NAME = 'georges-cellar-v6';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; }).map(function (n) { return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  // Never cache the Apps Script API — wine data must always be live.
  if (url.hostname.indexOf('script.google.com') !== -1 || url.hostname.indexOf('googleusercontent.com') !== -1) {
    return;
  }
  // For the page itself and the app logic, always try the network first, so edits you
  // upload show up the next time you open the app — cache is just the offline fallback.
  if (event.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('app.js') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(function (resp) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return resp;
      }).catch(function () { return caches.match(event.request); })
    );
    return;
  }
  // Everything else (icons, manifest): cache-first is fine, these rarely change.
  event.respondWith(caches.match(event.request).then(function (cached) { return cached || fetch(event.request); }));
});
