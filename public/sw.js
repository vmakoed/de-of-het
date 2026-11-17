const VERSION = "v1";
const CACHE = "de-of-het-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "lookup.js",
  "words.txt",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/192.png",
  "icons/512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("de-of-het-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") return caches.match("./");
        throw new Error("offline");
      });
    })
  );
});
