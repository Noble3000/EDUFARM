"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Verify() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ universityId: "", matricNo: "" });
  const [me, setMe] = useState<{ student?: { verificationStatus: string } | null } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api("/universities").then(setUnis).catch(() => {});
    api("/verifications/me").then(setMe).catch(() => {});
  }, []);
  async function submit() {
    setMsg("…");
    try {
      const r = await api("/verifications/student", {
        method: "POST",
        body: JSON.stringify({ universityId: form.universityId, facultyId: "", departmentId: "", levelId: "", matricNo: form.matricNo }),
      });
      setMsg(`Request ${r.verificationStatus}. An admin will approve it.`);
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="card">
      <h2>Student verification</h2>
      <p>Status: <strong>{me?.student?.verificationStatus ?? "unknown (log in first)"}</strong></p>
      <label>University</label>
      <select value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })}>
        <option value="">— choose —</option>
        {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <label>Matric No</label>
      <input value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} placeholder="STU-042" />
      <button onClick={submit}>Request verification</button>
      <p>{msg}</p>
    </div>
  );
}
