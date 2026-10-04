"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";
import { Alert, Field, LoadingState, SuccessNote } from "@edufarm/ui";

export default function Signup() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", universityId: "", matricNo: "" });
  const [msg, setMsg] = useState("");
  const busy = msg === "…";
  const isSuccess = msg.startsWith("Welcome,");
  useEffect(() => {
    fetch(`${API}/universities`).then((r) => r.json()).then(setUnis).catch(() => {});
  }, []);
  async function signup() {
    setMsg("…");
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, role: "student", facultyId: "", departmentId: "", levelId: "" }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Signup failed");
    localStorage.setItem("edufarm_user", JSON.stringify(data));
    setMsg(`Welcome, ${data.name}! Verification pending — an admin will approve you. Go to Home.`);
  }
  return (
    <div className="card">
      <h2>Student sign up</h2>
      <p className="muted">Step 1 of verification: your institution confirms your matric number (PRD §5.1).</p>
      <Field label="Full name">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
      </Field>
      <Field label="Email">
        <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
      </Field>
      <Field label="Password (8+ chars)" hint="Minimum 8 characters.">
        <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
      </Field>
      <Field label="University">
        <select value={f.universityId} onChange={(e) => setF({ ...f, universityId: e.target.value })}>
          <option value="">— choose —</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Matric No" hint="As issued by your institution, e.g. STU-042.">
        <input value={f.matricNo} onChange={(e) => setF({ ...f, matricNo: e.target.value })} placeholder="STU-042" />
      </Field>
      <button onClick={signup} disabled={busy}>Create account</button>
      <div style={{ marginTop: 12 }}>
        {busy && <LoadingState lines={1} label="Creating your account…" />}
        {!busy && isSuccess && <SuccessNote>{msg}</SuccessNote>}
        {!busy && msg && !isSuccess && <Alert kind="error">{msg}</Alert>}
      </div>
      <p className="muted">Already registered? <a href="/login">Sign in</a></p>
    </div>
  );
}
