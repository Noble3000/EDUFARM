"use client";
import { useEffect, useState } from "react";
import { API } from "@/lib/api";

export default function Signup() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [facs, setFacs] = useState<{ id: string; name: string }[]>([]);
  const [deps, setDeps] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", universityId: "", facultyId: "", departmentId: "", staffId: "", bio: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch(`${API}/universities`).then((r) => r.json()).then(setUnis).catch(() => {});
  }, []);
  async function pickUni(id: string) {
    setF({ ...f, universityId: id, facultyId: "", departmentId: "" });
    setFacs(await fetch(`${API}/universities/${id}/faculties`).then((r) => r.json()).catch(() => []));
    setDeps([]);
  }
  async function pickFac(id: string) {
    setF({ ...f, facultyId: id, departmentId: "" });
    setDeps(await fetch(`${API}/faculties/${id}/departments`).then((r) => r.json()).catch(() => []));
  }
  async function signup() {
    setMsg("…");
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, role: "lecturer" }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Signup failed");
    localStorage.setItem("edufarm_user", JSON.stringify(data));
    setMsg(`Welcome, ${data.name}! Lecturer verification pending — platform review follows (PRD §5.1).`);
  }
  return (
    <div className="card">
      <h2>Lecturer sign up</h2>
      <p className="muted">Institution/department confirmation + platform verification (PRD §5.1). You get a dedicated lecturer environment.</p>
      <label>Full name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <label>Email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label>Password (8+ chars)</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <label>University</label>
      <select value={f.universityId} onChange={(e) => pickUni(e.target.value)}>
        <option value="">— choose —</option>
        {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <label>Faculty</label>
      <select value={f.facultyId} onChange={(e) => pickFac(e.target.value)}>
        <option value="">— choose —</option>
        {facs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <label>Department</label>
      <select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
        <option value="">— choose —</option>
        {deps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <label>Staff ID</label><input value={f.staffId} onChange={(e) => setF({ ...f, staffId: e.target.value })} placeholder="STAFF-001" />
      <label>Bio (optional)</label><textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} />
      <button onClick={signup}>Create lecturer account</button>
      <p>{msg}</p>
      <p className="muted">Already registered? <a href="/login">Sign in →</a></p>
    </div>
  );
}
