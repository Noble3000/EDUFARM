"use client";
import { useState } from "react";
import { apiUrl } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("ada@student.demo-university.edu");
  const [password, setPassword] = useState("");
  const [api, setApi] = useState("");
  const [msg, setMsg] = useState("");
  async function login(useDemo = false) {
    if (api.trim()) localStorage.setItem("edufarm_api", api.trim().replace(/\/$/, ""));
    setMsg("…");
    const url = useDemo ? `${apiUrl()}/demo/login` : `${apiUrl()}/auth/login`;
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(useDemo ? { email } : { email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Login failed");
    localStorage.setItem("edufarm_user", JSON.stringify(data));
    setMsg(`Logged in as ${data.name} (${data.role}). Go to Home.`);
  }
  function logout() {
    localStorage.removeItem("edufarm_user");
    setMsg("Logged out.");
  }
  return (
    <div className="card">
      <h2>Student sign in</h2>
      <label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input placeholder="API URL (only for phone/remote — leave empty on this device)" value={api} onChange={(e) => setApi(e.target.value)} />
      <div className="row">
        <button onClick={() => login(false)}>Sign in</button>
        <button className="sec" onClick={() => login(true)}>Demo login</button>
        <button className="sec" onClick={logout}>Log out</button>
      </div>
      <p>{msg}</p>
      <p className="muted">New here? <a href="/signup">Create a student account →</a> (institution verifies you after signup)</p>
    </div>
  );
}
