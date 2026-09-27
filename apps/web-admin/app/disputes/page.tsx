"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Disputes() {
  const [rows, setRows] = useState<{ id: string; targetType: string; targetId: string; reason: string; status: string; resolution: string | null }[]>([]);
  async function load() {
    setRows(await api("/disputes").catch(() => []));
  }
  useEffect(() => { load(); }, []);
  return (
    <div className="card">
      <h2>Disputes & reports</h2>
      {rows.map((d) => (
        <div key={d.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
          <p><strong>{d.targetType}:{d.targetId.slice(0, 8)}</strong> — {d.reason} · <strong>{d.status}</strong>{d.resolution ? ` · ${d.resolution}` : ""}</p>
          {d.status === "open" && (
            <button className="sec" onClick={async () => {
              const resolution = prompt("Resolution note:", "Reviewed — no violation found.") ?? "";
              await api(`/disputes/${d.id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) });
              load();
            }}>Resolve</button>
          )}
        </div>
      ))}
      {!rows.length && <p className="muted">No disputes (or log in as admin first).</p>}
    </div>
  );
}
