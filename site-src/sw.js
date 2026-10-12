/* Picaillon — fonctionnement hors ligne. La version change à chaque mise en ligne de l'appli. */
var VERSION = 'picaillon-__VERSION__';
var SCOPE = self.registration.scope;
var CORE = ['./', './picaillon.js?v=__VERSION__', './picaillon.css?v=__VERSION__', './manifest.webmanifest',
  '../assets/icons/favicon.svg', '../assets/icons/icon-192.png', '../assets/icons/icon-512.png', '../assets/icons/apple-touch-icon.png',
  '../assets/fonts/inter-400.woff', '../assets/fonts/inter-500.woff', '../assets/fonts/inter-600.woff', '../assets/fonts/inter-700.woff',
  '../assets/fonts/inter-display-600.woff', '../assets/fonts/inter-display-700.woff'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('picaillon-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Page de l'appli : réseau d'abord (pour avoir la dernière version), copie locale si pas de réseau ou réseau trop lent
function navigation(req) {
  return new Promise(function (resolve) {
    var done = false;
    var fromCache = function () { return caches.open(VERSION).then(function (c) { return c.match(SCOPE); }); };
    var timer = setTimeout(function () { fromCache().then(function (r) { if (r && !done) { done = true; resolve(r); } }); }, 4000);
    fetch(req).then(function (r) {
      clearTimeout(timer);
      if (r.ok && !r.redirected) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(SCOPE, copy); }); }
      if (!done) { done = true; resolve(r); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' && req.url.indexOf(SCOPE) === 0) { e.respondWith(navigation(req)); return; }
  // Fichiers de l'appli et icônes : copie locale d'abord
  if (req.url.indexOf(SCOPE) === 0 || url.pathname.indexOf('/assets/icons/') === 0 || url.pathname.indexOf('/assets/fonts/') === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return r;
      });
    }));
  }
});
