"use client";
import { useState } from "react";
import { Alert, Field, SuccessNote } from "@edufarm/ui";
import { apiUrl } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("bello@demo-university.edu");
  const [password, setPassword] = useState("");
  const [api, setApi] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  async function login(useDemo = false) {
    if (api.trim()) localStorage.setItem("edufarm_api", api.trim().replace(/\/$/, ""));
    setBusy(true);
    setOk("");
    setErr("");
    try {
      const url = useDemo ? `${apiUrl()}/demo/login` : `${apiUrl()}/auth/login`;
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useDemo ? { email } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Login failed");
        return;
      }
      localStorage.setItem("edufarm_user", JSON.stringify(data));
      setOk(`Logged in as ${data.name} (${data.role}).`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card"><h2>Lecturer sign in</h2>
      <p className="muted">Dedicated lecturer environment for courses, materials and assessments.</p>
      <Field label="Email">
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="API URL" optional hint="Only for phone or remote testing. Leave empty on this device.">
        <input inputMode="url" placeholder="https://api.example.com/api/v1" value={api} onChange={(e) => setApi(e.target.value)} />
      </Field>
      <div className="row">
        <button onClick={() => login(false)} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button className="sec" onClick={() => login(true)} disabled={busy}>Demo login</button>
      </div>
      {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      <p className="muted" style={{ marginTop: 12 }}>New here? <a href="/signup">Create a lecturer account →</a> (department + platform verify you)</p>
    </div>
  );
}
