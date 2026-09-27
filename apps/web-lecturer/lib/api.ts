export const API = "http://localhost:4000/api/v1";

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
  const res = await fetch(`${API}${path}`, {
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
