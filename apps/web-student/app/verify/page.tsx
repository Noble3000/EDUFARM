"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, Badge, Field, LoadingState, SuccessNote } from "@edufarm/ui";

export default function Verify() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ universityId: "", matricNo: "" });
  const [me, setMe] = useState<{ student?: { verificationStatus: string } | null } | null>(null);
  const [msg, setMsg] = useState("");
  const busy = msg === "…";
  const isSuccess = msg.startsWith("Request ");
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
  const status = me?.student?.verificationStatus ?? "";
  return (
    <div className="card">
      <h2>Student verification</h2>
      <p>Status: {status ? <Badge kind="info">{status}</Badge> : <Badge>unknown (log in first)</Badge>}</p>
      <Field label="University">
        <select value={form.universityId} onChange={(e) => setForm({ ...form, universityId: e.target.value })}>
          <option value="">— choose —</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Matric No" hint="As issued by your institution, e.g. STU-042.">
        <input value={form.matricNo} onChange={(e) => setForm({ ...form, matricNo: e.target.value })} placeholder="STU-042" />
      </Field>
      <button onClick={submit} disabled={busy}>Request verification</button>
      <div style={{ marginTop: 12 }}>
        {busy && <LoadingState lines={1} label="Requesting verification…" />}
        {!busy && isSuccess && <SuccessNote>{msg}</SuccessNote>}
        {!busy && msg && !isSuccess && <Alert kind="error">{msg}</Alert>}
      </div>
    </div>
  );
}
