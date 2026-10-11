// Service worker: makes the app work fully offline once it has been opened online.
// - Every file the app needs is saved in a versioned cache when the worker installs.
// - Network first (with a short timeout) so a redeploy shows up as soon as you're online;
//   if the network is slow or missing, the saved copy is used.
// - When this file changes (e.g. VERSION below), old caches are deleted on activation.
// All paths are RELATIVE so the app works under a GitHub Pages sub-path (https://user.github.io/repo/).
const VERSION = 'v22-2026-10-11';
const CACHE_NAME = `otter-${VERSION}`;
const APP_FILES = [
  './', './index.html', './manifest.json', './icon.png', './icon-512.png', './apple-touch-icon.png',
  './css/styles.css', './css/phosphor/regular.css', './css/phosphor/fill.css',
  './css/phosphor/Phosphor.woff2', './css/phosphor/Phosphor-Fill.woff2',
  './js/util.js', './js/db.js', './js/ui.js', './js/defaults.js', './js/migrate.js', './js/days.js', './js/streaks.js',
  './js/mascots.js', './js/otter.js', './js/app.js', './js/task-editor.js', './js/timeline.js', './js/today.js', './js/areas.js',
  './js/plan.js', './js/boards.js', './js/logs.js', './js/research.js', './js/gym.js', './js/areatools.js', './js/wardjobs.js', './js/programme.js', './js/health.js', './js/focus.js',
  './js/review.js', './js/more.js'
];
const TIMEOUT_MS = 3500;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names.filter(n => n.startsWith('otter') && n !== CACHE_NAME).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const fromCache = () => cache.match(req, { ignoreSearch: true })
      .then(r => r || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
    try {
      // 'no-cache' asks the server whether each file changed (cheap), instead of reusing the browser's copy for
      // up to 10 minutes, so an update arrives whole on the next open rather than as a mix of old and new files.
      const net = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
      const res = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const cached = await fromCache();
      return cached || new Response('Offline and this file is not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
