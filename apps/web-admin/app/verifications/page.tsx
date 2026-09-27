"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Verifications() {
  const [type, setType] = useState("student");
  const [rows, setRows] = useState<{ id: string; verificationStatus: string; user: { name: string; email: string }; matricNo?: string; staffId?: string }[]>([]);
  async function load() {
    setRows(await api(`/verifications/pending?type=${type}`).catch(() => []));
  }
  useEffect(() => { load(); }, [type]);
  async function decide(id: string, decision: string) {
    await api(`/verifications/${type}/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    load();
  }
  return (
    <div className="card">
      <h2>Verification queue</h2>
      <div className="row">
        <button className={type === "student" ? "" : "sec"} onClick={() => setType("student")}>Students</button>
        <button className={type === "lecturer" ? "" : "sec"} onClick={() => setType("lecturer")}>Lecturers</button>
      </div>
      {rows.map((r) => (
        <div className="row" key={r.id} style={{ marginTop: 10 }}>
          <span>{r.user.name} ({r.user.email}) · {r.matricNo ?? r.staffId} · {r.verificationStatus}</span>
          <button onClick={() => decide(r.id, "approve")}>Approve</button>
          <button className="sec" onClick={() => decide(r.id, "reject")}>Reject</button>
        </div>
      ))}
      {!rows.length && <p className="muted">Queue empty (or log in as admin first).</p>}
    </div>
  );
}
