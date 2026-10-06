/* Minimal offline cache for Dock App static assets */
const CACHE = 'dock-app-v55';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=55',
  './app.js?v=55',
  './speech.js?v=55',
  './storage.js?v=55',
  './loadPlan.js?v=55',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
    // v54+: no clients.claim() — a page that is already open (mid-tour) is never
    // taken over by a brand-new worker; the worker only serves the next visit.
  );
});

function isHtmlJsCss(request) {
  if (request.mode === 'navigate' || request.destination === 'document') return true;
  let path = '';
  try {
    path = new URL(request.url).pathname;
  } catch {
    return false;
  }
  if (path.endsWith('/') || /\/index\.html$/i.test(path)) return true;
  return /\.(html|js|css)$/i.test(path);
}

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const networkFirst = () =>
    fetch(req)
      .then((res) => {
        putInCache(req, res);
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      );

  if (isHtmlJsCss(req)) {
    event.respondWith(networkFirst());
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          putInCache(req, res);
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
