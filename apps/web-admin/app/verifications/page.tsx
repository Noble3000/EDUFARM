"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, DataTable, EmptyState, ErrorState, LoadingState, Pagination } from "@edufarm/ui";

const PER = 10;

export default function Verifications() {
  const [type, setType] = useState("student");
  const [rows, setRows] = useState<{ id: string; verificationStatus: string; user: { name: string; email: string }; matricNo?: string; staffId?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [page, setPage] = useState(1);
  async function load() {
    setLoading(true);
    setFailed("");
    try {
      setRows(await api(`/verifications/pending?type=${type}`));
    } catch (e) {
      setRows([]);
      setFailed((e as Error).message ?? "Could not load verification queue.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setPage(1); load(); }, [type]);
  async function decide(id: string, decision: string) {
    await api(`/verifications/${type}/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    load();
  }
  const pages = Math.max(1, Math.ceil(rows.length / PER));
  const safePage = Math.min(page, pages);
  const visible = rows.slice((safePage - 1) * PER, safePage * PER);
  return (
    <div className="card">
      <h2>Verification queue</h2>
      <div className="row" role="group" aria-label="Queue type">
        <button className={type === "student" ? "" : "sec"} aria-pressed={type === "student"} onClick={() => setType("student")}>Students</button>
        <button className={type === "lecturer" ? "" : "sec"} aria-pressed={type === "lecturer"} onClick={() => setType("lecturer")}>Lecturers</button>
      </div>
      {loading ? (
        <div style={{ marginTop: 12 }}><LoadingState label="Loading verification queue…" /></div>
      ) : failed && rows.length === 0 ? (
        <div style={{ marginTop: 12 }}><ErrorState message={failed} onRetry={load} /></div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <EmptyState icon="checkBadge" title="Queue clear" body="No pending verifications. Log in as admin if you expected rows here." />
        </div>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <DataTable caption={`${type === "student" ? "Student" : "Lecturer"} verification requests`} head={["Name", "Email", "ID", "Status", "Actions"]}>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{r.user.name}</td>
                  <td>{r.user.email}</td>
                  <td>{r.matricNo ?? r.staffId}</td>
                  <td><Badge kind="warn">{r.verificationStatus}</Badge></td>
                  <td>
                    <div className="row tight">
                      <button onClick={() => decide(r.id, "approve")}>Approve</button>
                      <button className="sec" onClick={() => decide(r.id, "reject")}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          <Pagination page={safePage} pages={pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
