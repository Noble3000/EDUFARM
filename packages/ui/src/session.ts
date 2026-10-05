// Session token store (opaque, revocable) — replaces raw user ids (spoofable).
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
