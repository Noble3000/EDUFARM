// Bounded in-memory TTL cache — shared by hot read paths.
// Anti-leak contract (do NOT "fix" memory by raising these):
// - hard cap MAX_ENTRIES (oldest-first eviction, no LRU bookkeeping overhead)
// - per-entry TTL, lazy expiry on read + periodic sweep
// - stats exposed via /ready so growth is observable, never silent
// What is cached: devotional-today (TTL to Lagos midnight), hierarchy lists
// (60s, explicitly invalidated on writes), material terms (keyed by
// material+version, 5min). NEVER cache: entitlements, sessions, grades,
// verification states, outbox rows.

const MAX_ENTRIES = 500;

type Entry = { value: unknown; expiresAt: number };
const store = new Map<string, Entry>();
let hits = 0;
let misses = 0;
let evictions = 0;
let lastSweep = 0;

function sweep(force = false): void {
  const now = Date.now();
  if (!force && now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, e] of store) {
    if (e.expiresAt <= now) store.delete(k);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
    evictions += 1;
  }
}

export function cacheGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) {
    misses += 1;
    return null;
  }
  if (e.expiresAt <= Date.now()) {
    store.delete(key);
    misses += 1;
    return null;
  }
  hits += 1;
  return e.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  sweep();
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next();
    if (!oldest.done) {
      store.delete(oldest.value);
      evictions += 1;
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheInvalidate(prefix: string): number {
  let n = 0;
  for (const k of store.keys()) {
    if (k === prefix || k.startsWith(prefix + ":")) {
      store.delete(k);
      n += 1;
    }
  }
  return n;
}

export function cacheStats() {
  sweep(true);
  return { entries: store.size, maxEntries: MAX_ENTRIES, hits, misses, evictions };
}

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  cacheSet(key, value, ttlMs);
  return value;
}
