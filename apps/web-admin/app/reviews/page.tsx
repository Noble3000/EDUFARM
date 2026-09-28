"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Reviews() {
  const [rows, setRows] = useState<{ id: string; title: string; type: string; status: string; course: { code: string } }[]>([]);
  async function load() {
    setRows(await api("/reviews/queue").catch(() => []));
  }
  useEffect(() => { load(); }, []);
  async function decide(id: string, decision: string) {
    await api(`/materials/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
    load();
  }
  return (
    <div className="card">
      <h2>Material review queue</h2>
      {rows.map((r) => (
        <div className="row" key={r.id} style={{ marginTop: 10 }}>
          <span><strong>{r.title}</strong> ({r.type}) · {r.course.code} · {r.status}</span>
          <button onClick={() => decide(r.id, "approve")}>Publish</button>
          <button className="sec" onClick={() => decide(r.id, "reject")}>Reject</button>
        </div>
      ))}
      {!rows.length && <p className="muted">Nothing pending (or log in as admin first). Lecturers submit from :3002.</p>}
    </div>
  );
}
