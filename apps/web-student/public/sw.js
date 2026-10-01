/* EDUFARM PWA shell SW v1 — installable + offline-tolerant, no cached exam answers. */
const CACHE = "edufarm-student-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  if (url.origin !== self.location.origin) return; // never cache API/R2 bytes
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone();
          if (res.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => hit)
    )
  );
});
