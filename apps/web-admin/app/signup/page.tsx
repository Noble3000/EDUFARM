"use client";
import { useState } from "react";
import { apiUrl } from "@/lib/api";
import { Alert, Field, LoadingState, SuccessNote } from "@edufarm/ui";

// Admin accounts are never self-service (PRD §16): request access here
// (reviewed in Disputes), or ask an existing platform admin to create you.
export default function Signup() {
  const [f, setF] = useState({ name: "", email: "", role: "deptAdmin", reason: "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  async function request() {
    setBusy(true);
    setOk("");
    setErr("");
    try {
      const res = await fetch(`${apiUrl()}/access-requests`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Request failed");
        return;
      }
      setOk("Request filed — a platform admin will review it. You will be notified.");
    } catch (e) {
      setErr((e as Error).message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card">
      <h2>Request admin access</h2>
      <p className="muted">Staff roles need platform approval. Requests appear in the Disputes queue as AccessRequest.</p>
      <Field label="Full name">
        <input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Work email">
        <input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Role needed">
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="deptAdmin">Department admin</option>
          <option value="institutionAdmin">Institution admin</option>
          <option value="platformAdmin">Platform admin</option>
        </select>
      </Field>
      <Field label="Why do you need access?">
        <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      </Field>
      <button onClick={request} disabled={busy}>Submit request</button>
      {busy && <div style={{ marginTop: 12 }}><LoadingState label="Submitting request…" lines={2} /></div>}
      {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      <p className="muted">Have an account? <a href="/login">Sign in</a></p>
    </div>
  );
}
