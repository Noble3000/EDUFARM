// Tiny API client: fetch with x-user-id from localStorage (dev auth).
const DEFAULT_API = "http://localhost:4000/api/v1";
function baseApi(): string {
  if (typeof window === "undefined") return DEFAULT_API;
  try {
    const q = new URLSearchParams(window.location.search).get("api");
    if (q) { try { window.localStorage.setItem("edufarm_api", q.replace(/\/$/, "")); } catch { /* ignore */ } }
    return (window.localStorage.getItem("edufarm_api") || DEFAULT_API).replace(/\/$/, "");
  } catch { return DEFAULT_API; }
}
export const API = DEFAULT_API;
export function apiUrl(): string { return baseApi(); }

export function getUser(): { id: string; email: string; name: string; role: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("edufarm_user") ?? "null");
  } catch {
    return null;
  }
}

export async function api(path: string, opts: RequestInit = {}) {
  const user = getUser();
  const res = await fetch(`${apiUrl()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(user ? { "x-user-id": user.id } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}
