"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, Field, LoadingState, Modal, Pagination } from "@edufarm/ui";

const PER = 10;

export default function Disputes() {
  const [rows, setRows] = useState<{ id: string; targetType: string; targetId: string; reason: string; status: string; resolution: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("Reviewed — no violation found.");
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api("/disputes"));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function resolve(id: string) {
    await api(`/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) });
    setActiveId(null);
    load();
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Disputes & reports</h2>
      {loading ? (
        <LoadingState label="Loading disputes…" />
      ) : failed && rows.length === 0 ? (
        <ErrorState message={failed} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState icon="checkBadge" title="Queue clear" body="No disputes or reports. Log in as admin if you expected rows here." />
      ) : (
        <>
          <DataTable caption="Open and resolved disputes and reports" head={["Target", "Reason", "Status", "Resolution", "Actions"]}>
            {visible.map((d) => (
              <tr key={d.id}>
                <td><strong>{d.targetType}:{d.targetId.slice(0, 8)}</strong></td>
                <td>{d.reason}</td>
                <td><Badge kind={d.status === "open" ? "warn" : "ok"}>{d.status}</Badge></td>
                <td>{d.resolution ?? <span className="muted">—</span>}</td>
                <td>
                  {d.status === "open" && (
                    <button className="sec" onClick={() => { setActiveId(d.id); setResolution("Reviewed — no violation found."); }}>Resolve</button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
      {activeId && (
        <Modal title="Resolve dispute" onClose={() => setActiveId(null)}>
          <Field label="Resolution note" hint="Recorded with the same resolve call.">
            <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </Field>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="sec" onClick={() => setActiveId(null)}>Cancel</button>
            <button onClick={() => resolve(activeId)}>Confirm resolution</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
