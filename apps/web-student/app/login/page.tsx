"use client";
import { useEffect, useState } from "react";
import { apiUrl, setSession, logout as doLogout } from "@/lib/api";
import { Alert, Field, LoadingState, SuccessNote } from "@edufarm/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [api, setApi] = useState("");
  const [currentApi, setCurrentApi] = useState("");
  const [msg, setMsg] = useState("");
  const busy = msg === "…";
  const isSuccess = msg.startsWith("Logged in") || msg === "Logged out.";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setApi(localStorage.getItem("edufarm_api") || "");
      setCurrentApi(apiUrl());
    }
  }, []);

  async function login() {
    if (api.trim()) {
      localStorage.setItem("edufarm_api", api.trim().replace(/\/$/, ""));
    } else {
      localStorage.removeItem("edufarm_api");
    }
    setCurrentApi(apiUrl());
    setMsg("…");
    const res = await fetch(`${apiUrl()}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Login failed");
    setSession(data);
    setMsg(`Logged in as ${data.name} (${data.role}). Go to Home.`);
  }
  async function logout() {
    await doLogout();
    setMsg("Logged out.");
  }
  return (
    <div className="card">
      <h2>Student sign in</h2>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@university.edu" />
      </Field>
      <Field label="Password">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="API URL" optional hint={`Current: ${currentApi || apiUrl()}. Leave empty on this device.`}>
        <input value={api} onChange={(e) => setApi(e.target.value)} placeholder="https://api.example.com" inputMode="url" />
      </Field>
      <div className="row">
        <button onClick={() => login()} disabled={busy}>Sign in</button>
        <button className="sec" onClick={logout}>Log out</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {busy && <LoadingState lines={1} label="Signing you in…" />}
        {!busy && isSuccess && msg && <SuccessNote>{msg}</SuccessNote>}
        {!busy && msg && !isSuccess && <Alert kind="error">{msg}</Alert>}
      </div>
      <p className="muted">New here? <a href="/signup">Create a student account</a> (institution verifies you after signup)</p>
    </div>
  );
}
