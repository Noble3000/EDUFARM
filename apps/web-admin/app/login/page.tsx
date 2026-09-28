"use client";
import { useState } from "react";
import { apiUrl } from "@/lib/api";
export default function Login() {
  const [email, setEmail] = useState("admin@edufarm.ng");
  const [api, setApi] = useState("");
  const [msg, setMsg] = useState("");
  async function login() {
    if (api.trim()) localStorage.setItem("edufarm_api", api.trim().replace(/\/$/, ""));
    const res = await fetch(`${apiUrl()}/demo/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Login failed");
    localStorage.setItem("edufarm_user", JSON.stringify(data));
    setMsg(`Logged in as ${data.name} (${data.role}).`);
  }
  return (
    <div className="card"><h2>Admin demo login</h2>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="API URL (only for phone/remote)" value={api} onChange={(e) => setApi(e.target.value)} />
      <button onClick={login}>Log in</button><p>{msg}</p>
    </div>
  );
}
