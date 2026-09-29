/* Song List Pro service worker -- makes the app open with no connection.
 *
 * build-pwa.cjs stamps this file into deploy/sw.js with a version (a hash of everything it
 * caches) and the file list. A new build gets a new version, which is how installed copies
 * learn there is an update.
 *
 * Your songs are NOT stored here. They live in the phone's own app storage; this file only
 * keeps the app's code and icons so it can start offline. */
"use strict";

const VERSION = "bfc1fea22de9";
const SHELL_CACHE = `slp-shell-${VERSION}`;
const RUNTIME_CACHE = "slp-runtime-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];
// Photo import downloads its text-recognition engine and language data on first use; keeping
// what it fetched lets it work offline afterwards.
const RUNTIME_HOSTS = ["cdn.jsdelivr.net", "tessdata.projectnaptha.com"];

self.addEventListener("install", (event) => {
  // cache: "reload" skips the browser's own HTTP cache, so an update stores the files as they
  // are on the server now, not a stale copy the host told the browser to keep for a while.
  event.waitUntil(caches.open(SHELL_CACHE)
    .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("slp-shell-") && name !== SHELL_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Opening the app: serve the saved copy immediately, so it starts the same with or without
  // a signal. (Everything is one page, so any address inside the app maps to it.)
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(caches.match("./index.html").then((cached) => cached || fetch(request)));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)));
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const refresh = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || refresh;
    }));
  }
});
