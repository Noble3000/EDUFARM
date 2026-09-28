"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Settlements() {
  const [ov, setOv] = useState<{ pendingKobo: number; availableKobo: number; settledKobo: number; holdDays: number } | null>(null);
  const [msg, setMsg] = useState("");
  async function load() {
    setOv(await api("/settlement/overview").catch(() => null));
  }
  useEffect(() => { load(); }, []);
  return (
    <div className="card">
      <h2>eSpees settlement</h2>
      {ov ? (
        <p>Pending ₦{(ov.pendingKobo / 100).toFixed(2)} · Available ₦{(ov.availableKobo / 100).toFixed(2)} · Settled ₦{(ov.settledKobo / 100).toFixed(2)} <span className="muted">(hold {ov.holdDays}d)</span></p>
      ) : <p className="muted">Log in as platform admin first.</p>}
      <div className="row">
        <button onClick={async () => {
          const r = await api("/settlement/run", { method: "POST", body: JSON.stringify({}) });
          setMsg(`Released ${r.released} entries to available.`); load();
        }}>Run settlement (pending → available)</button>
        <button className="sec" onClick={async () => {
          const r = await api("/settlement/pay", { method: "POST", body: JSON.stringify({ reference: "dev-cash" }) });
          setMsg(`Paid ${r.settled} entries · ₦${(r.totalKobo / 100).toFixed(2)}.`); load();
        }}>Pay out (available → settled)</button>
      </div>
      <p>{msg}</p>
    </div>
  );
}
