// API client: session-token auth (opaque, revocable, server-validated).
// Never sends raw user ids. Token lives in localStorage `edufarm_session`
// (set at login/signup); profile cache in `edufarm_user` is display-only.
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

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("edufarm_session");
  } catch {
    return null;
  }
}

export function setSession(data: { sessionToken?: string; [k: string]: unknown }): void {
  try {
    if (data.sessionToken) window.localStorage.setItem("edufarm_session", data.sessionToken);
    window.localStorage.setItem("edufarm_user", JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem("edufarm_session");
    window.localStorage.removeItem("edufarm_user");
  } catch {
    /* ignore */
  }
}

export function getUser(): { id: string; email: string; name: string; role: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("edufarm_user") ?? "null");
  } catch {
    return null;
  }
}

export async function api(path: string, opts: RequestInit = {}) {
  const token = getSessionToken();
  const res = await fetch(`${apiUrl()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-session-token": token } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } catch {
    /* ignore — clear locally regardless */
  }
  clearSession();
}
