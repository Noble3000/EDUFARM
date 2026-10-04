"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, LoadingState, Pagination } from "@edufarm/ui";

const PER = 10;

export default function EmailOutbox() {
  const [rows, setRows] = useState<{ id: string; toUserId: string; subject: string; body: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api("/email/outbox"));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load email outbox.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Email outbox (dev transport: logged)</h2>
      <p className="muted">Purchases, grades, and settlements write here. Prod worker (Resend/Postmark) drains `logged` rows.</p>
      {loading ? (
        <LoadingState label="Loading email outbox…" />
      ) : failed && rows.length === 0 ? (
        <ErrorState message={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon="mail" title="Outbox empty" body="No logged emails yet. Log in as platform admin if you expected rows here." />
      ) : (
        <>
          <DataTable caption="Logged outbound emails" head={["Subject", "Recipient", "Status", "Preview"]}>
            {visible.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.subject}</strong></td>
                <td>{e.toUserId.slice(0, 8)}…</td>
                <td><Badge kind="info">{e.status}</Badge></td>
                <td><span className="muted">{e.body.slice(0, 120)}</span></td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
