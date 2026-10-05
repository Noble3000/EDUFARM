"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, Confirm, DataTable, LoadingState, SuccessNote } from "@edufarm/ui";

export default function Settlements() {
  const [ov, setOv] = useState<{
    pendingKobo: number; availableKobo: number; settledKobo: number;
    policy: { holdDays: number; lecturerShareBps: number; ruleVersion: string };
    next: { nextRun: string; note: string };
    batches: { id: string; status: string; reference: string | null; totalLecturerKobo: number; entryCount: number; createdAt: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<null | "run" | "pay">(null);
  async function load() {
    setLoading(true);
    try {
      setOv(await api("/settlement/overview"));
    } catch {
      setOv(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  async function doRun() {
    setConfirm(null);
    setOk("");
    setErr("");
    try {
      const r = await api("/settlement/run", { method: "POST", body: JSON.stringify({ idempotencyKey: `run-${new Date().toISOString().slice(0, 10)}` }) });
      setOk(r.batch ? `Period ${r.batch.id.slice(0, 8)} closed — released ${r.released} entries.` : "Nothing matured yet.");
      load();
    } catch (e) {
      setErr((e as Error).message ?? "Settlement run failed.");
    }
  }
  async function doPay() {
    setConfirm(null);
    setOk("");
    setErr("");
    try {
      const r = await api("/settlement/pay", { method: "POST", body: JSON.stringify({ reference: "dev-cash", idempotencyKey: `pay-${Date.now()}` }) });
      if (r.batch) setOk(`Batch ${r.batch.id.slice(0, 8)} paid · ref ${r.batch.reference ?? "?"}${r.replay ? " (replay — no double settle)" : ""}.`);
      else setOk(`Paid ${r.settled} entries · ₦${(r.totalKobo / 100).toFixed(2)}.`);
      load();
    } catch (e) {
      setErr((e as Error).message ?? "Payout failed.");
    }
  }
  return (
    <div className="card">
      <h2>eSpees settlement</h2>
      {loading ? (
        <LoadingState label="Loading settlement overview…" lines={2} />
      ) : ov ? (
        <>
        <DataTable caption={`Settlement balances (hold ${ov.policy.holdDays}d · split ${ov.policy.lecturerShareBps / 100}% lecturer · rules ${ov.policy.ruleVersion})`} head={["Pending", "Available", "Settled", "Hold"]}>
          <tr>
            <td>₦{(ov.pendingKobo / 100).toFixed(2)}</td>
            <td>₦{(ov.availableKobo / 100).toFixed(2)}</td>
            <td>₦{(ov.settledKobo / 100).toFixed(2)}</td>
            <td>{ov.policy.holdDays}d</td>
          </tr>
        </DataTable>
        <p className="muted">Next period: {new Date(ov.next.nextRun).toLocaleDateString()} — {ov.next.note}</p>
        {!!ov.batches.length && (
          <DataTable caption="Settlement periods" head={["Batch", "Status", "Reference", "Lecturer total", "Entries"]}>
            {ov.batches.map((b) => (
              <tr key={b.id}>
                <td>{b.id.slice(0, 8)}</td>
                <td>{b.status}</td>
                <td>{b.reference ?? "—"}</td>
                <td>₦{(b.totalLecturerKobo / 100).toFixed(2)}</td>
                <td>{b.entryCount}</td>
              </tr>
            ))}
          </DataTable>
        )}
        </>
      ) : (
        <p className="muted">Log in as platform admin first.</p>
      )}
      <div className="row">
        <button onClick={() => setConfirm("run")} disabled={loading}>Run settlement (pending to available)</button>
        <button className="sec" onClick={() => setConfirm("pay")} disabled={loading}>Pay out (available to settled)</button>
      </div>
      {ok && <div style={{ marginTop: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      {confirm === "run" && (
        <Confirm
          title="Run settlement?"
          body="Release matured pending entries to available. Same settlement run call executes on confirm."
          confirmLabel="Run settlement"
          onConfirm={doRun}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "pay" && (
        <Confirm
          title="Pay out available earnings?"
          body="Settle all available entries with reference dev-cash. Same payout call executes on confirm."
          confirmLabel="Pay out"
          onConfirm={doPay}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
