"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState, Icon, LoadingState, SuccessNote } from "@edufarm/ui";

type Note = {
  id: string; type: string; title: string; body: string;
  link: string | null; readAt: string | null; createdAt: string;
};

const TYPE_ICON: Record<string, "bell" | "announce" | "book" | "wallet" | "quiz" | "verify" | "mail" | "grad" | "clock" | "user" | "shield" | "school" | "lock"> = {
  announcement: "announce", "new-material": "book", "material-revision": "book",
  purchase: "wallet", assessment: "quiz", grade: "grad", deadline: "clock",
  enrollment: "user", verification: "verify", dispute: "shield",
  institution: "school", grant: "lock",
};

export default function Notifications() {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [failed, setFailed] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [prefs, setPrefs] = useState<{ emailEnabled: boolean; mutedTypes: string[]; kinds: string[] } | null>(null);
  const [saved, setSaved] = useState("");
  async function load() {
    setFailed("");
    try {
      const [n, p] = await Promise.all([
        api(`/notifications/me${unreadOnly ? "?unread=true" : ""}`),
        api("/notifications/preferences").catch(() => null),
      ]);
      setNotes(n);
      if (p) setPrefs(p);
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load notifications.");
    }
  }
  useEffect(() => { load(); }, [unreadOnly]);
  async function open(n: Note) {
    if (!n.readAt) {
      try {
        await api(`/notifications/${n.id}/read`, { method: "PATCH", body: JSON.stringify({}) });
        setNotes((prev) => prev?.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) ?? prev);
      } catch { /* reading is best-effort; link still works */ }
    }
    if (n.link) window.location.href = n.link;
  }
  async function readAll() {
    await api("/notifications/read-all", { method: "POST", body: JSON.stringify({}) });
    load();
  }
  async function savePrefs(patch: { emailEnabled?: boolean; mutedTypes?: string[] }) {
    setSaved("");
    try {
      const p = await api("/notifications/preferences", { method: "PATCH", body: JSON.stringify(patch) });
      setPrefs(p);
      setSaved("Preferences saved. In-app notifications always stay on; email follows these settings.");
    } catch (e) {
      setFailed((e as Error).message);
    }
  }
  const unread = notes?.filter((n) => !n.readAt).length ?? 0;
  if (notes === null && !failed) return <LoadingState label="Loading notifications…" lines={4} />;
  if (failed && notes === null) return <ErrorState message={failed} onRetry={load} />;
  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Notifications {unread > 0 && <span className="badge b-urg">{unread} unread</span>}</h2>
          <div className="row tight">
            <button className={unreadOnly ? "" : "sec"} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)}>Unread only</button>
            <button className="sec" onClick={readAll} disabled={!unread}>Mark all read</button>
          </div>
        </div>
        {!notes?.length ? (
          <div style={{ marginTop: 12 }}>
            <EmptyState icon="bell" title={unreadOnly ? "Nothing unread" : "No notifications yet"} body="Announcements, enrollment decisions, grades, deadlines and account notices land here with links." />
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderTop: "1px solid #F2F4F7", padding: "10px 0", opacity: n.readAt ? 0.75 : 1 }}>
                <p style={{ marginBottom: 2 }}>
                  {!n.readAt && <span className="badge b-urg">new</span>}
                  <Icon name={(TYPE_ICON[n.type] ?? "bell") as "bell"} size={14} /> <strong>{n.title}</strong>
                </p>
                <p className="muted" style={{ marginBottom: 4 }}>{n.body} <span>· {new Date(n.createdAt).toLocaleString()}</span></p>
                {n.link && <button className="sec" onClick={() => open(n)}>Open →</button>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card">
        <h3>Email preferences</h3>
        <p className="muted">In-app notifications are always on (primary channel). Email is secondary — switch it off entirely or mute families.</p>
        {saved && <div style={{ marginBottom: 8 }}><SuccessNote>{saved}</SuccessNote></div>}
        {prefs && (
          <>
            <label className="checkrow">
              <input type="checkbox" checked={prefs.emailEnabled} onChange={(e) => savePrefs({ emailEnabled: e.target.checked })} /> Email me meaningful events
            </label>
            <p className="muted">Muted families:</p>
            <div className="row tight">
              {prefs.kinds.map((k) => {
                const muted = prefs.mutedTypes.includes(k);
                return (
                  <button
                    key={k}
                    className={muted ? "" : "sec"}
                    aria-pressed={muted}
                    onClick={() => savePrefs({ mutedTypes: muted ? prefs.mutedTypes.filter((t) => t !== k) : [...prefs.mutedTypes, k] })}
                  >
                    {muted ? `Muted: ${k}` : k}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
