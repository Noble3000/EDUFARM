// Outbound HTTP with retry/backoff for provider calls (Paystack, Flutterwave,
// Resend, SendGrid). Retries ONLY on network errors and 5xx/429 — never on 4xx
// (a 400 would just fail faster the second time, and POSTs may not be
// idempotent at the provider). Callers must pass idempotency (references,
// event keys) so a retried request can never double-charge or double-send.

export interface RetryOptions {
  attempts?: number; // total tries incl. the first (default 3)
  baseMs?: number; // first backoff (default 400ms, x2 each retry, jittered)
  timeoutMs?: number; // per-attempt fetch timeout (default 10000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const attempts = Math.max(1, Math.min(opts.attempts ?? 3, 6));
  const baseMs = opts.baseMs ?? 400;
  const timeoutMs = opts.timeoutMs ?? 10000;
  let lastError: unknown = null;
  for (let i = 1; i <= attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status < 500 && res.status !== 429) return res;
      lastError = new Error(`HTTP ${res.status} from ${url}`);
      await res.arrayBuffer().catch(() => {});
    } catch (e) {
      clearTimeout(timer);
      lastError = e; // network error / timeout / abort — always retryable
    }
    if (i < attempts) {
      const backoff = Math.min(baseMs * 2 ** (i - 1), 8000) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`fetch failed: ${url}`);
}
