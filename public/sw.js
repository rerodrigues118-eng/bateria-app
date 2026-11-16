const CACHE_NAME = "stick-click-v1";

const ASSETS_TO_CACHE = [
  "/",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  "/audio/falas/um.mp3",
  "/audio/falas/dois.mp3",
  "/audio/falas/tres.mp3",
  "/audio/falas/quatro.mp3",
  "/audio/falas/virada em.mp3",
  "/audio/falas/Intro em.mp3",
  "/audio/falas/enfeites no prato em.mp3",
  "/audio/falas/solo.mp3",
  "/audio/falas/em.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("ServiceWorker: Alguns assets falharam ao adicionar ao cache:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clientsClaim();
});

self.addEventListener("fetch", (event) => {
  // Ignora requisições de métodos diferentes de GET (ex: POST, PUT)
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Se a resposta for válida, adiciona uma cópia ao cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Se estiver offline e o asset for a raiz, tenta retornar a página inicial do cache
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
