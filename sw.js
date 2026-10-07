/* EDUFARM Portal PWA shell SW v1 — installable + offline-tolerant.
 *
 * CACHE BOUNDARY & PROTECTION POLICY:
 * - Cached (Shell Only):
 *   - App shell (/, /index.html)
 *   - Manifest (/manifest.webmanifest)
 *   - UI icons (/icons/*)
 *   - Shared preview assets (/design.html)
 *
 * - NEVER CACHED:
 *   - Any API routes (/api/*, fastify backend :4000)
 *   - Cross-origin requests
 *   - Protected materials or student records
 */
const CACHE = "edufarm-portal-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // 1. Never cache cross-origin requests
  if (url.origin !== self.location.origin) return;

  // 2. Never cache API routes
  if (url.pathname.startsWith("/api/")) return;

  // 3. Navigation: network-first with shell fallback
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  // 4. Shell static assets: cache-first with network fill
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone();
          if (res.ok && (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".css") || url.pathname.endsWith(".webmanifest"))) {
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
    )
  );
});
