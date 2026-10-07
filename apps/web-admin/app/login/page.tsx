"use client";
import { useEffect, useState } from "react";
import { apiUrl, setSession } from "@/lib/api";
import { Alert, Field, LoadingState, SuccessNote } from "@edufarm/ui";

export default function Login() {
  const [email, setEmail] = useState("admin@edufarm.ng");
  const [password, setPassword] = useState("");
  const [api, setApi] = useState("");
  const [currentApi, setCurrentApi] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setApi(localStorage.getItem("edufarm_api") || "");
      setCurrentApi(apiUrl());
    }
  }, []);

  async function login(useDemo = false) {
    if (api.trim()) {
      localStorage.setItem("edufarm_api", api.trim().replace(/\/$/, ""));
    } else {
      localStorage.removeItem("edufarm_api");
    }
    setCurrentApi(apiUrl());
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
      setSession(data);
      setOk(`Logged in as ${data.name} (${data.role}).`);
    } catch (e) {
      setErr((e as Error).message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card"><h2>Admin sign in</h2>
      <Field label="Email">
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="API URL" optional hint={`Current: ${currentApi || apiUrl()}. Leave empty on this device.`}>
        <input inputMode="url" placeholder="https://api.example.ng/api/v1" value={api} onChange={(e) => setApi(e.target.value)} />
      </Field>
      <div className="row">
        <button onClick={() => login(false)} disabled={busy}>Sign in</button>
        <button className="sec" onClick={() => login(true)} disabled={busy}>Demo login</button>
      </div>
      {busy && <div style={{ marginTop: 12 }}><LoadingState label="Signing in…" lines={2} /></div>}
      {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      <p className="muted">No account? <a href="/signup">Request admin access</a></p>
    </div>
  );
}
