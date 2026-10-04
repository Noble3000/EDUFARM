"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, LoadingState, Pagination } from "@edufarm/ui";

const PER = 10;

export default function Reviews() {
  const [rows, setRows] = useState<{ id: string; title: string; type: string; status: string; course: { code: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api("/reviews/queue"));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load review queue.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function decide(id: string, decision: string) {
    await api(`/materials/${id}/review`, { method: "POST", body: JSON.stringify({ decision }) });
    load();
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Material review queue</h2>
      {loading ? (
        <LoadingState label="Loading review queue…" />
      ) : failed && rows.length === 0 ? (
        <ErrorState message={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon="checkBadge" title="Queue clear" body="Nothing pending. Lecturers submit from :3002. Log in as admin if you expected rows here." />
      ) : (
        <>
          <DataTable caption="Lecturer material submissions awaiting review" head={["Title", "Type", "Course", "Status", "Actions"]}>
            {visible.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.title}</strong></td>
                <td>{r.type}</td>
                <td>{r.course.code}</td>
                <td><Badge kind="warn">{r.status}</Badge></td>
                <td>
                  <div className="row tight">
                    <button onClick={() => decide(r.id, "approve")}>Publish</button>
                    <button className="sec" onClick={() => decide(r.id, "reject")}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
