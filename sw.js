/* Missouri State Fair concept — service worker.
   Pages: network-first (content stays fresh). Assets: cache-first (instant).
   Offline: falls back to cached pages, then offline.html. */

const VERSION = "msf-v2";
const PRECACHE = [
  "./",
  "index.html",
  "tickets.html",
  "events.html",
  "plan.html",
  "faq.html",
  "participate.html",
  "about.html",
  "contact.html",
  "privacy.html",
  "offline.html",
  "assets/css/styles.css",
  "assets/js/main.js",
  "assets/js/drone-show.js",
  "assets/fonts/barlow-condensed-800.woff2",
  "assets/fonts/barlow-condensed-600.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("offline.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
    )
  );
});
