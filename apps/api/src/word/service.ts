// Canonical daily Word service (§14): one entry per Lagos calendar day,
// identical for every student, stable all day.
// Resolution order (first hit wins; NEVER invented):
//   1. In-memory day cache (5-min TTL, single-flight) — population-wide consistency.
//   2. DB row for today (any origin).
//   3. Authorized source pull (if configured) → stored as origin=feed, then served.
//   4. Last authorized entry dated ≤ today (explicit isFallback response).
//   5. Honest empty ({ empty: true }) — the UI shows "unavailable", never fiction.

import { prisma } from "../db.js";
import { feedConfigured, fetchFeedEntry } from "./source.js";

// Lagos (UTC+1, no DST) calendar day as UTC range
export function lagosDayRange(now = new Date()): { start: Date; end: Date; key: string } {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const y = lagos.getUTCFullYear();
  const m = String(lagos.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lagos.getUTCDate()).padStart(2, "0");
  const start = new Date(`${y}-${m}-${d}T00:00:00.000+01:00`);
  const end = new Date(start.getTime() + 86400_000);
  return { start, end, key: `${y}-${m}-${d}` };
}

export interface CanonicalWord {
  empty: boolean;
  id?: string;
  date?: Date;
  title?: string;
  verse?: string;
  body?: string;
  sourceRef?: string | null;
  origin?: string;
  rightsNote?: string | null;
  /** True when this is NOT today's entry (reuse, explicitly labeled). */
  isFallback?: boolean;
  /** Lagos day this response is canonical for. */
  canonicalFor?: string;
}

const CACHE_TTL_MS = 5 * 60_000;
let cache: { key: string; at: number; value: CanonicalWord } | null = null;
let inflight: Promise<CanonicalWord> | null = null;

export function clearWordCache(): void {
  cache = null;
  inflight = null;
}

export async function resolveToday(now = new Date()): Promise<CanonicalWord> {
  const { start, end, key } = lagosDayRange(now);
  if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  if (inflight) return inflight;
  inflight = (async (): Promise<CanonicalWord> => {
    try {
      const today = await prisma.devotional.findFirst({ where: { date: { gte: start, lt: end } } });
      if (today) return shape(today, key, false);
      if (feedConfigured()) {
        try {
          const fed = await fetchFeedEntry(key);
          const stored = await prisma.devotional.upsert({
            where: { date: start },
            update: {
              title: fed.title, verse: fed.verse, body: fed.body,
              sourceRef: fed.source, origin: "feed", fetchedAt: new Date(),
            },
            create: {
              date: start, title: fed.title, verse: fed.verse, body: fed.body,
              sourceRef: fed.source, origin: "feed", fetchedAt: new Date(),
            },
          });
          return shape(stored, key, false);
        } catch (e) {
          console.error("[word] source pull failed, falling back:", (e as Error).message);
        }
      }
      // Last authorized entry at or before today (never a future row).
      const last = await prisma.devotional.findFirst({
        where: { date: { lt: end } }, orderBy: { date: "desc" },
      });
      if (last) return shape(last, key, true);
      return { empty: true, canonicalFor: key };
    } finally {
      inflight = null;
    }
  })();
  const value = await inflight;
  cache = { key, at: Date.now(), value };
  return value;
}

function shape(
  d: { id: string; date: Date; title: string; verse: string; body: string; sourceRef: string | null; origin: string; rightsNote: string | null },
  key: string,
  isFallback: boolean,
): CanonicalWord {
  return {
    empty: false, id: d.id, date: d.date, title: d.title, verse: d.verse, body: d.body,
    sourceRef: d.sourceRef, origin: d.origin, rightsNote: d.rightsNote,
    isFallback, canonicalFor: key,
  };
}
