"use client";
import { useEffect, useState } from "react";
import { Alert, Field, SuccessNote } from "@edufarm/ui";
import { API, setSession } from "@/lib/api";

export default function Signup() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [facs, setFacs] = useState<{ id: string; name: string }[]>([]);
  const [deps, setDeps] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", universityId: "", facultyId: "", departmentId: "", staffId: "", bio: "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`${API}/universities`).then((r) => r.json()).then(setUnis).catch(() => {});
  }, []);
  async function pickUni(id: string) {
    setF({ ...f, universityId: id, facultyId: "", departmentId: "" });
    setFacs(await fetch(`${API}/universities/${id}/faculties`).then((r) => r.json()).catch(() => []));
    setDeps([]);
  }
  async function pickFac(id: string) {
    setF({ ...f, facultyId: id, departmentId: "" });
    setDeps(await fetch(`${API}/faculties/${id}/departments`).then((r) => r.json()).catch(() => []));
  }
  async function signup() {
    setBusy(true);
    setOk("");
    setErr("");
    try {
      const res = await fetch(`${API}/auth/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, role: "lecturer" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Signup failed");
        return;
      }
      setSession(data);
      setOk(`Welcome, ${data.name}! Lecturer verification pending — platform review follows (PRD §5.1).`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card">
      <h2>Lecturer sign up</h2>
      <p className="muted">Institution/department confirmation + platform verification (PRD §5.1). You get a dedicated lecturer environment.</p>
      <Field label="Full name">
        <input autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Email">
        <input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Password" hint="8+ characters.">
        <input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <Field label="University">
        <select value={f.universityId} onChange={(e) => pickUni(e.target.value)}>
          <option value="">— choose —</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Faculty">
        <select value={f.facultyId} onChange={(e) => pickFac(e.target.value)}>
          <option value="">— choose —</option>
          {facs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Department">
        <select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
          <option value="">— choose —</option>
          {deps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Staff ID">
        <input placeholder="STAFF-001" value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })} />
      </Field>
      <Field label="Bio" optional>
        <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      </Field>
      <button onClick={signup} disabled={busy}>{busy ? "Creating…" : "Create lecturer account"}</button>
      {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      <p className="muted" style={{ marginTop: 12 }}>Already registered? <a href="/login">Sign in →</a></p>
    </div>
  );
}
