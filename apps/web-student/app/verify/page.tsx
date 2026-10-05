"use client";
import { useEffect, useState } from "react";
import { API, api } from "@/lib/api";
import { Alert, Badge, Field, LoadingState, SuccessNote } from "@edufarm/ui";

const STATUS_COPY: Record<string, string> = {
  unverified: "Not yet requested — complete the form below.",
  pending: "In the review queue — your institution will confirm your matric number.",
  needsCorrection: "Needs correction — fix the flagged details below and resubmit. Your queue place is kept.",
  rejected: "Rejected — correct your details and resubmit, or contact your admin.",
  verified: "Verified — now request course access from your lecturers (verification never auto-enrols).",
  suspended: "Suspended — contact your institution admin. Read access to already-approved courses continues.",
};

export default function Verify() {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [facs, setFacs] = useState<{ id: string; name: string }[]>([]);
  const [deps, setDeps] = useState<{ id: string; name: string }[]>([]);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ universityId: "", facultyId: "", departmentId: "", levelId: "", matricNo: "" });
  const [me, setMe] = useState<{ student?: { verificationStatus: string } | null } | null>(null);
  const [msg, setMsg] = useState("");
  const busy = msg === "…";
  const isSuccess = msg.startsWith("Request ");
  useEffect(() => {
    fetch(`${API}/universities`).then((r) => r.json()).then(setUnis).catch(() => {});
    api("/verifications/me").then(setMe).catch(() => {});
  }, []);
  async function pickUni(id: string) {
    setForm({ ...form, universityId: id, facultyId: "", departmentId: "", levelId: "" });
    setFacs(id ? await fetch(`${API}/universities/${id}/faculties`).then((r) => r.json()).catch(() => []) : []);
    setDeps([]); setLevels([]);
  }
  async function pickFac(id: string) {
    setForm({ ...form, facultyId: id, departmentId: "", levelId: "" });
    setDeps(id ? await fetch(`${API}/faculties/${id}/departments`).then((r) => r.json()).catch(() => []) : []);
    setLevels([]);
  }
  async function pickDept(id: string) {
    setForm({ ...form, departmentId: id, levelId: "" });
    setLevels(id ? await fetch(`${API}/departments/${id}/levels`).then((r) => r.json()).catch(() => []) : []);
  }
  async function submit() {
    setMsg("…");
    try {
      const r = await api("/verifications/student", { method: "POST", body: JSON.stringify(form) });
      setMsg(`Request ${r.verificationStatus}. An admin will review it.`);
      setMe(await api("/verifications/me").catch(() => me));
    } catch (e) { setMsg((e as Error).message); }
  }
  const status = me?.student?.verificationStatus ?? "";
  return (
    <div className="card">
      <h2>Student verification</h2>
      <p>Status: {status ? <Badge kind="info">{status}</Badge> : <Badge>unknown (sign in first)</Badge>}</p>
      {status && <p className="muted">{STATUS_COPY[status] ?? ""}</p>}
      <Field label="University">
        <select value={form.universityId} onChange={(e) => pickUni(e.target.value)}>
          <option value="">— choose —</option>
          {unis.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Faculty">
        <select value={form.facultyId} onChange={(e) => pickFac(e.target.value)}>
          <option value="">— choose —</option>
          {facs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Department">
        <select value={form.departmentId} onChange={(e) => pickDept(e.target.value)}>
          <option value="">— choose —</option>
          {deps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Level">
        <select value={form.levelId} onChange={(e) => setForm({ ...form, levelId: e.target.value })}>
          <option value="">— choose —</option>
          {levels.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
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
