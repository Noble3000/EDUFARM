"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Onboarding() {
  const [rows, setRows] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", contactEmail: "" });
  const [msg, setMsg] = useState("");
  async function load() {
    setRows(await api("/onboarding/pending").catch(() => []));
  }
  useEffect(() => { load(); }, []);
  async function request() {
    try {
      const r = await api("/onboarding/institution", { method: "POST", body: JSON.stringify(form) });
      setMsg(`Requested: ${r.name} — pending approval.`); setForm({ name: "", slug: "", contactEmail: "" });
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div>
      <div className="card">
        <h2>Request institution onboarding (public)</h2>
        <input placeholder="University name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="slug (e.g. unilag)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
        <button onClick={request}>Submit request</button>
        <p>{msg}</p>
      </div>
      <div className="card">
        <h2>Pending approvals</h2>
        {rows.map((u) => (
          <div className="row" key={u.id} style={{ marginTop: 8 }}>
            <span><strong>{u.name}</strong> ({u.slug})</span>
            <button onClick={async () => {
              await api(`/onboarding/${u.id}/approve`, { method: "POST", body: JSON.stringify({}) });
              load();
            }}>Approve</button>
          </div>
        ))}
        {!rows.length && <p className="muted">None pending (or log in as platform admin).</p>}
      </div>
    </div>
  );
}
