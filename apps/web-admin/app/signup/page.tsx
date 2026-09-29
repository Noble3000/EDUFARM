"use client";
import { useState } from "react";
import { API } from "@/lib/api";

// Admin accounts are never self-service (PRD §16): request access here
// (reviewed in Disputes), or ask an existing platform admin to create you.
export default function Signup() {
  const [f, setF] = useState({ name: "", email: "", role: "deptAdmin", reason: "" });
  const [msg, setMsg] = useState("");
  async function request() {
    setMsg("…");
    const res = await fetch(`${API}/access-requests`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Request failed");
    setMsg("Request filed — a platform admin will review it. You will be notified.");
  }
  return (
    <div className="card">
      <h2>Request admin access</h2>
      <p className="muted">Staff roles need platform approval. Requests appear in the Disputes queue as AccessRequest.</p>
      <label>Full name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label>Work email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label>Role needed</label>
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
        <option value="deptAdmin">Department admin</option>
        <option value="institutionAdmin">Institution admin</option>
        <option value="platformAdmin">Platform admin</option>
      </select>
      <label>Why do you need access?</label><textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
      <button onClick={request}>Submit request</button>
      <p>{msg}</p>
      <p className="muted">Have an account? <a href="/login">Sign in →</a></p>
    </div>
  );
}
