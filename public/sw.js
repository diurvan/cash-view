/* Service worker de cashview. Red en vivo para páginas y API; caché para el
   motor SQLite (/wasm) y estáticos, de modo que la app funcione offline
   una vez cargada. */
const CACHE = "cashview-v1";

const PRECACHE = ["/", "/dashboard", "/catalog"];

function isPage(p) {
  return p === "/" || p === "/dashboard" || p === "/catalog";
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documentos: red primero (siempre versión nueva) y caché como respaldo.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    );
    return;
  }

  // No cachear llamadas API (p. ej. la copia de Drive).
  if (url.pathname.startsWith("/api/")) return;

  // Estáticos, wasm e iconos: caché primero, red como respaldo.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/wasm/") || url.pathname.startsWith("/icons/") || isPage(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return res;
          })
      )
    );
  }
});