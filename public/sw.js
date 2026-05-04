const CACHE_NAME = "recovery-routine-next-v2";
const APP_FILES = ["/manifest.webmanifest", "/icon.svg", "/hero-routine.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
