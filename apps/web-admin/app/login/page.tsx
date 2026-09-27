"use client";
import { useState } from "react";
import { API } from "../lib/api";
export default function Login() {
  const [email, setEmail] = useState("admin@edufarm.ng");
  const [msg, setMsg] = useState("");
  async function login() {
    const res = await fetch(`${API}/demo/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Login failed");
    localStorage.setItem("edufarm_user", JSON.stringify(data));
    setMsg(`Logged in as ${data.name} (${data.role}).`);
  }
  return (
    <div className="card"><h2>Admin demo login</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={login}>Log in</button><p>{msg}</p>
    </div>
  );
}
