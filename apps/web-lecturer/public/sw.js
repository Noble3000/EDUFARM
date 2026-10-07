/* EDUFARM Lecturer PWA shell SW v3 — installable + offline-tolerant.
 *
 * CACHE BOUNDARY & PROTECTION POLICY (Academic Ecosystem Security Standard):
 * - Cached (Shell Only):
 *   - App shell (/)
 *   - Manifest (/manifest.webmanifest)
 *   - UI icons (/icons/*)
 *   - Next.js static asset bundles (/_next/static/*)
 *
 * - NEVER CACHED (PROTECTION ENFORCED):
 *   - Cross-origin requests (Cloudflare R2 buckets, presigned URLs, remote APIs)
 *   - Any API routes (/api/*, fastify backend)
 *   - Any material drafts, uploads, files, or published resources
 *   - Assessment builder, student attempts, or grading sheets
 *   - Earnings, bank settlement details, or lecturer financials
 *   - Authentication credentials or session tokens
 *
 * - OFFLINE BEHAVIOUR:
 *   - Navigations fall back to cached shell (/)
 *   - Live operations require active network connection.
 *   - Auth always requires network. */
const CACHE = "edufarm-lecturer-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

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

  // 1. Never cache cross-origin requests (R2 storage, remote APIs)
  if (url.origin !== self.location.origin) return;

  // 2. Never cache same-origin APIs
  if (url.pathname.startsWith("/api/")) return;

  // 3. Navigation: network-first with shell fallback
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  // 4. Shell static assets: cache-first with network fill
  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone();
          if (res.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")) {
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => hit)
    )
  );
});
