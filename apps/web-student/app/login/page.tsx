"use client";
import { useState } from "react";
import { API } from "../lib/api";

export default function Login() {
  const [email, setEmail] = useState("ada@student.demo-university.edu");
  const [msg, setMsg] = useState("");
  async function login() {
    setMsg("…");
    const res = await fetch(`${API}/demo/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
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
      <h2>Demo login</h2>
      <p className="muted">No password in Phase 1 dev — pick a seeded email. Better Auth cookies land next.</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <div className="row">
        <button onClick={login}>Log in</button>
        <button className="sec" onClick={logout}>Log out</button>
      </div>
      <p>{msg}</p>
      <p className="muted">Students: ada@… (verified) · pending@… (pending) · Lecturers use :3002 · Admin: admin@edufarm.ng on :3003</p>
    </div>
  );
}
