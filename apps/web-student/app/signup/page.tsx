"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

export default function Signup() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", universityId: "", matricNo: "" });
  const [msg, setMsg] = useState("");
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
      <label>Full name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label>Email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label>Password (8+ chars)</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <label>University</label>
      <select value={f.universityId} onChange={(e) => setF({ ...f, universityId: e.target.value })}>
        <option value="">— choose —</option>
        {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <label>Matric No</label><input value={f.matricNo} onChange={(e) => setF({ ...f, matricNo: e.target.value })} placeholder="STU-042" />
      <button onClick={signup}>Create account</button>
      <p>{msg}</p>
      <p className="muted">Already registered? <a href="/login">Sign in →</a></p>
    </div>
  );
}
