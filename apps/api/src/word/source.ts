// Authorized Word source adapter (§14): server-side fetch ONLY.
// The browser never calls the source. Requires WORD_FEED_URL plus
// WORD_FEED_KEY (Bearer). Responses are shape-validated; anything else
// (network error, non-2xx, bad auth, bad shape, timeout) throws a coded
// error so the caller falls back — never fabricates.

export interface FeedEntry {
  date: string;
  title: string;
  verse: string;
  body: string;
  source?: string;
}

export function feedConfigured(): boolean {
  return !!(process.env.WORD_FEED_URL && process.env.WORD_FEED_KEY);
}

function isFeedEntry(v: unknown): v is FeedEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.title === "string" && o.title.trim().length > 0 &&
    typeof o.verse === "string" && o.verse.trim().length > 0 &&
    typeof o.body === "string" && o.body.trim().length > 0
  );
}

export async function fetchFeedEntry(lagosKey: string): Promise<FeedEntry> {
  const base = process.env.WORD_FEED_URL;
  const key = process.env.WORD_FEED_KEY;
  if (!base || !key) throw Object.assign(new Error("word-source-unconfigured"), { code: "UNCONFIGURED" });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}?date=${lagosKey}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: ctl.signal,
    });
  } catch (e) {
    throw Object.assign(new Error(`word-source-unreachable: ${(e as Error).message}`), { code: "UNREACHABLE" });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403)
    throw Object.assign(new Error("word-source-unauthorized: check WORD_FEED_KEY"), { code: "UNAUTHORIZED" });
  if (!res.ok)
    throw Object.assign(new Error(`word-source-error: HTTP ${res.status}`), { code: "HTTP_ERROR" });
  const data = (await res.json().catch(() => null)) as unknown;
  const entry = (data as { entry?: unknown })?.entry ?? data;
  if (!isFeedEntry(entry))
    throw Object.assign(new Error("word-source-invalid: response failed shape validation"), { code: "INVALID" });
  return { ...(entry as FeedEntry), date: lagosKey, source: (entry as FeedEntry).source ?? base };
}
