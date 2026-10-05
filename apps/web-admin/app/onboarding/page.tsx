"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, DataTable, EmptyState, ErrorState, Field, LoadingState, Pagination, SuccessNote } from "@edufarm/ui";

const PER = 10;

export default function Onboarding() {
  const [rows, setRows] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [queue, setQueue] = useState("pending");
  const [note, setNote] = useState("");
  const [form, setForm] = useState({ name: "", slug: "", contactEmail: "" });
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api(`/onboarding/pending?status=${queue}`));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load pending approvals.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [queue]);
  async function decide(id: string, decision: string) {
    await api(`/onboarding/${id}/decide`, { method: "POST", body: JSON.stringify({ decision, note: note || undefined }) });
    load();
  }
  async function request() {
    setOk("");
    setErr("");
    try {
      const r = await api("/onboarding/institution", { method: "POST", body: JSON.stringify(form) });
      setOk(`Requested: ${r.name} — pending approval.`);
      setForm({ name: "", slug: "", contactEmail: "" });
    } catch (e) { setErr((e as Error).message); }
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div>
      <div className="card">
        <h2>Request institution onboarding (public)</h2>
        <Field label="University name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Slug" hint="Short handle, e.g. unilag.">
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        </Field>
        <Field label="Contact email">
          <input type="email" autoComplete="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
        </Field>
        <button onClick={request}>Submit request</button>
        {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
        {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      </div>
      <div className="card">
        <h2>Pending approvals</h2>
        <div className="row" role="group" aria-label="Institution queue" style={{ marginBottom: 8 }}>
          <button className={queue === "pending" ? "" : "sec"} aria-pressed={queue === "pending"} onClick={() => { setQueue("pending"); setPage(1); }}>Pending</button>
          <button className={queue === "suspended" ? "" : "sec"} aria-pressed={queue === "suspended"} onClick={() => { setQueue("suspended"); setPage(1); }}>Suspended</button>
        </div>
        <Field label="Review note" optional hint="Sent with reject / suspend decisions.">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for this decision" />
        </Field>
        {loading ? (
          <LoadingState label="Loading pending approvals…" />
        ) : failed && rows.length === 0 ? (
          <ErrorState message={failed} onRetry={load} />
        ) : rows.length === 0 ? (
          <EmptyState icon="school" title="Queue clear" body="No institutions pending. Log in as platform admin if you expected rows here." />
        ) : (
          <>
            <DataTable caption={`Institutions (${queue})`} head={["Name", "Slug", "Actions"]}>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.slug}</td>
                  <td>
                    <div className="row tight">
                      <button onClick={async () => {
                        await api(`/onboarding/${u.id}/approve`, { method: "POST", body: JSON.stringify({}) });
                        load();
                      }}>Approve</button>
                      <button className="sec" onClick={() => decide(u.id, "suspend")}>Suspend</button>
                      <button className="sec" onClick={() => decide(u.id, "reinstate")}>Reinstate</button>
                      <button className="sec" onClick={() => decide(u.id, "reject")}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
            <Pagination page={safePage} pages={pages} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
