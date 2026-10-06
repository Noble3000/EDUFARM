"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, LoadingState, Pagination, SuccessNote } from "@edufarm/ui";

const PER = 10;
const STATUSES = ["queued", "sending", "sent", "failed", "logged", "all"] as const;

type Row = {
  id: string; toEmail: string | null; subject: string; body: string;
  kind: string; provider: string; status: string; attempts: number;
  lastError: string | null; messageId: string | null; createdAt: string;
};

function statusKind(s: string): string {
  if (s === "sent") return "ok";
  if (s === "failed") return "bad";
  if (s === "sending") return "info";
  return "warn";
}

export default function EmailOutbox() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [note, setNote] = useState("");
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api(`/email/outbox${status === "all" ? "" : `?status=${status}`}`));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load email outbox.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setPage(1); load(); }, [status]);
  async function drain() {
    setNote("");
    try {
      const r = await api("/email/drain?limit=25", { method: "POST", body: JSON.stringify({}) });
      setNote(`Drain: ${r.sent} sent, ${r.failed} failed, ${r.deferred} deferred.`);
      load();
    } catch (e) {
      setNote(`Drain failed: ${(e as Error).message}`);
    }
  }
  async function retry(id: string) {
    await api(`/email/${id}/retry`, { method: "POST", body: JSON.stringify({}) });
    load();
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Email outbox</h2>
      <p className="muted">Event-keyed queue — retried jobs never duplicate email. Provider: mock unless configured.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {STATUSES.map((s) => (
          <button key={s} className={status === s ? "" : "sec"} aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>
        ))}
        <button className="sec" onClick={drain}>Drain now</button>
      </div>
      {note && <div style={{ marginBottom: 8 }}><SuccessNote>{note}</SuccessNote></div>}
      {loading ? (
        <LoadingState label="Loading email outbox…" />
      ) : failed && rows.length === 0 ? (
        <ErrorState message={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon="mail" title="Outbox empty" body="No emails in this view. Log in as platform admin if you expected rows here." />
      ) : (
        <>
          <DataTable caption={`Outbound email (${status})`} head={["Subject", "Recipient", "Kind", "Provider", "Status", "Attempts", ""]}>
            {visible.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.subject}</strong><br /><span className="muted">{e.body.slice(0, 100)}</span></td>
                <td>{e.toEmail ?? <span className="muted">unknown</span>}</td>
                <td><span className="badge b-ed">{e.kind}</span></td>
                <td>{e.provider}</td>
                <td><Badge kind={statusKind(e.status)}>{e.status}</Badge>{e.lastError && <><br /><span className="muted">{e.lastError.slice(0, 80)}</span></>}</td>
                <td>{e.attempts}{e.messageId ? <><br /><span className="muted">{e.messageId.slice(0, 18)}</span></> : null}</td>
                <td>{e.status === "failed" && <button className="sec" onClick={() => retry(e.id)}>Retry</button>}</td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
