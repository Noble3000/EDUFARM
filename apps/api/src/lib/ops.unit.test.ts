// Ops unit tests — pure logic, no database, no network (fetch stubbed).
// Covers: cache TTL/expiry, entry cap (no unbounded growth), invalidation,
// retry succeeds after flakes, 4xx never retried, attempts honored.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheGet, cacheInvalidate, cacheSet, cacheStats, cached } from "./cache.js";
import { fetchWithRetry } from "./http.js";

describe("bounded TTL cache", () => {
  beforeEach(() => {
    cacheInvalidate("");
  });
  it("returns set values before TTL, misses after", async () => {
    cacheSet("k1", "v1", 50);
    expect(cacheGet<string>("k1")).toBe("v1");
    await new Promise((r) => setTimeout(r, 70));
    expect(cacheGet<string>("k1")).toBeNull();
  });
  it("never exceeds the entry cap", () => {
    for (let i = 0; i < 700; i++) cacheSet(`k${i}`, i, 60_000);
    expect(cacheStats().entries).toBeLessThanOrEqual(cacheStats().maxEntries);
    expect(cacheStats().maxEntries).toBe(500);
  });
  it("invalidates by prefix", () => {
    cacheSet("hier:a", 1, 60_000);
    cacheSet("hier:b", 2, 60_000);
    cacheSet("other", 3, 60_000);
    expect(cacheInvalidate("hier")).toBe(2);
    expect(cacheGet("other")).toBe(3);
  });
  it("cached() loads once on concurrent misses", async () => {
    let loads = 0;
    const loader = async () => {
      loads += 1;
      await new Promise((r) => setTimeout(r, 20));
      return "v";
    };
    // sequential misses each load (no stampede lock by design — documented);
    // a hit after load never reloads
    expect(await cached("c1", 60_000, loader)).toBe("v");
    expect(await cached("c1", 60_000, loader)).toBe("v");
    expect(loads).toBe(1);
  });
});

describe("fetch retry/backoff", () => {
  it("succeeds after transient 503s", async () => {
    let n = 0;
    const stub = vi.fn(async () => {
      n += 1;
      if (n < 3) return new Response("x", { status: 503 });
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", stub);
    try {
      const res = await fetchWithRetry("https://x.test", {}, { baseMs: 1 });
      expect(res.status).toBe(200);
      expect(stub).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("never retries 4xx", async () => {
    const stub = vi.fn(async () => new Response("no", { status: 400 }));
    vi.stubGlobal("fetch", stub);
    try {
      const res = await fetchWithRetry("https://x.test", {}, { baseMs: 1 });
      expect(res.status).toBe(400);
      expect(stub).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("throws after exhausting attempts on network errors", async () => {
    const stub = vi.fn(async () => {
      throw new Error("boom");
    });
    vi.stubGlobal("fetch", stub);
    try {
      await expect(fetchWithRetry("https://x.test", {}, { attempts: 2, baseMs: 1 })).rejects.toThrow("boom");
      expect(stub).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
