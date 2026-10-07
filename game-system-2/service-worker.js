/* The OLD Game System (the app that was on this website before) registered this file as its service worker.
   This version only steps aside: it clears the old app's saved copies of its pages and reloads, so the new
   Game System (sw.js) loads and takes over. It never touches your games or saves. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    /* the new Game System's caches start with "gs2" */
    await Promise.all(keys.filter(function (k) { return k.indexOf('gs2') !== 0; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
    var list = await self.clients.matchAll({ type: 'window' });
    list.forEach(function (c) { try { c.navigate(c.url); } catch (e) { /* ignore */ } });
  })());
});
/* no fetch handler: everything comes straight from the website */
