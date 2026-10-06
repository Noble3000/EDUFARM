"use client";
import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, Pagination } from "@edufarm/ui";

const PER = 10;
const STATUSES = ["open", "under-review", "resolved", "dismissed", "appealed", "closed", "all"] as const;

type Row = {
  id: string; targetType: string; targetId: string; reason: string;
  evidence: string | null; status: string; assignedTo: string | null;
  resolution: string | null; appealStatus: string;
  reporter: { email: string; name: string | null } | null;
  sla: { dueAt: string | null; overdue: boolean; hoursLeft: number | null };
};

function statusKind(s: string): string {
  if (s === "open" || s === "appealed") return "warn";
  if (s === "under-review") return "info";
  if (s === "resolved" || s === "closed") return "ok";
  return "bad";
}

export default function Disputes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("open");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<(Row & { actions: { action: string; note: string | null; createdAt: string }[] }) | null>(null);
  const [resolution, setResolution] = useState("Reviewed — no violation found.");
  const [decision, setDecision] = useState("resolve");
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      const q = status === "all" ? "" : `?status=${status}${overdueOnly ? "&overdue=true" : ""}`;
      setRows(await api(`/disputes${q}`));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setPage(1); load(); }, [status, overdueOnly]);
  async function act(path: string, body: unknown) {
    if (!detail) return;
    await api(`/disputes/${detail.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
    const fresh = await api(`/disputes/${detail.id}`);
    setDetail(fresh);
    load();
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Disputes & reports</h2>
      <p className="muted">Reports never auto-remove content. Reporter contact stays in this queue only.</p>
      <div className="row" role="group" aria-label="Queue status" style={{ marginBottom: 8 }}>
        {STATUSES.map((s) => (
          <button key={s} className={status === s ? "" : "sec"} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>
        ))}
        <button className={overdueOnly ? "" : "sec"} aria-pressed={overdueOnly} onClick={() => setOverdueOnly(!overdueOnly)}>Overdue SLA</button>
      </div>
      {loading ? (
        <LoadingState label="Loading disputes…" />
      ) : failed && rows.length === 0 ? (
        <ErrorState message={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon="checkBadge" title="Queue clear" body="No disputes in this view. Log in as admin if you expected rows here." />
      ) : (
        <>
          <DataTable caption={`Disputes (${status}${overdueOnly ? ", overdue SLA" : ""})`} head={["Ref", "Target", "Reason", "Status", "SLA", "Assignee", ""]}>
            {visible.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.id.slice(0, 8)}</strong></td>
                <td>{d.targetType}:{d.targetId.slice(0, 8)}</td>
                <td>{d.reason.slice(0, 80)}</td>
                <td><Badge kind={statusKind(d.status)}>{d.status}</Badge>{d.appealStatus !== "none" && <span className="badge b-ed">appeal:{d.appealStatus}</span>}</td>
                <td>{d.sla.dueAt ? (d.sla.overdue ? <span className="badge b-bad">overdue</span> : <span className="muted">{d.sla.hoursLeft}h left</span>) : <span className="muted">—</span>}</td>
                <td>{d.assignedTo ? d.assignedTo.slice(0, 8) : <span className="muted">unassigned</span>}</td>
                <td><button className="sec" onClick={async () => setDetail(await api(`/disputes/${d.id}`))}>Open</button></td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
      {detail && (
        <Modal title={`Dispute ${detail.id.slice(0, 8)} — ${detail.status}`} onClose={() => setDetail(null)} wide>
          <p><strong>{detail.targetType}:{detail.targetId}</strong></p>
          <p>Reason: {detail.reason}</p>
          {detail.evidence && <p className="muted">Evidence: {detail.evidence}</p>}
          {detail.reporter && <p className="muted">Reporter (staff-only): {detail.reporter.name} · {detail.reporter.email}</p>}
          {detail.resolution && <p>Resolution: {detail.resolution}</p>}
          <h4>Timeline</h4>
          {detail.actions.map((a, i) => (
            <p key={i} className="muted">· {a.action}{a.note ? ` — ${a.note}` : ""} <span>({new Date(a.createdAt).toLocaleString()})</span></p>
          ))}
          <div className="row" style={{ marginTop: 8 }}>
            {(detail.status === "open") && <button className="sec" onClick={() => act("start", {})}>Take into review</button>}
            {(detail.status === "open" || detail.status === "under-review") && (
              <button className="sec" onClick={() => act("assign", { assigneeId: getUser()?.id })}>Assign to me</button>
            )}
          </div>
          <Field label="Assignee user id" optional hint="Blank unassigns. Must be an institution/platform admin.">
            <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="user id or blank" />
          </Field>
          <div className="row"><button className="sec" onClick={() => act("assign", { assigneeId: assignee || undefined })}>Apply assignment</button></div>
          <Field label="Resolution note" hint="Required for resolve/dismiss. Recorded + sent to reporter (no reviewer identity disclosed).">
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
          </Field>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="sec" onClick={() => setDecision("resolve")} aria-pressed={decision === "resolve"}>Resolve</button>
            <button className="sec" onClick={() => setDecision("dismiss")} aria-pressed={decision === "dismiss"}>Dismiss</button>
            <button onClick={() => act("resolve", { decision, resolution })}>Confirm {decision}</button>
          </div>
          {detail.status === "appealed" && (
            <>
              <Field label="Appeal note" optional>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decision note to reporter" />
              </Field>
              <div className="row">
                <button className="sec" onClick={() => act("appeal-decide", { decision: "uphold", note })}>Uphold (close)</button>
                <button className="sec" onClick={() => act("appeal-decide", { decision: "overturn", note })}>Overturn (re-resolve)</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
