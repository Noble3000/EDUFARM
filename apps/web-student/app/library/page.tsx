"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "@edufarm/ui";

type Purchase = {
  id: string; materialId: string | null; bundleId: string | null;
  amountKobo: number; pointsUsed: number; accessExpiresAt: string | null;
  material?: { id: string; title: string; version: number; accessDurationDays: number | null } | null;
  bundle?: { id: string; title: string } | null;
};
type FreeMat = { id: string; title: string };
type Lib = { purchases: Purchase[]; freeMaterials: FreeMat[] };

function expiryLabel(iso: string | null): string {
  if (!iso) return "no expiry set";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86400000);
  return days === 0 ? "expires today" : `expires in ${days} day${days === 1 ? "" : "s"}`;
}

export default function Library() {
  const [lib, setLib] = useState<Lib | null>(null);
  const [failed, setFailed] = useState("");
  async function load() {
    setFailed("");
    try {
      setLib(await api("/library/me"));
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load your library.");
    }
  }
  useEffect(() => { load(); }, []);
  if (!lib && !failed) return <LoadingState label="Loading your library…" />;
  if (failed && !lib) return <ErrorState message={failed} onRetry={load} />;
  return (
    <div>
      <h2>My Academic Library</h2>
      <p className="muted">In-ecosystem access only — every item shows its access terms before and after purchase.</p>
      <div className="card">
        <h3>Purchased</h3>
        {(lib?.purchases ?? []).map((p) => (
          <p key={p.id}>
            {p.material ? (
              <a href={`/materials/${p.material.id}`}><strong>{p.material.title}</strong></a>
            ) : p.bundle ? (
              <strong>{p.bundle.title}</strong>
            ) : p.materialId ? (
              <a href={`/materials/${p.materialId}`}>{p.materialId}</a>
            ) : (
              <span className="muted">Purchase {p.id.slice(0, 8)}</span>
            )}{" "}
            <span className="muted">— ₦{(p.amountKobo / 100).toFixed(2)}{p.pointsUsed ? ` (${p.pointsUsed} pts used)` : ""} · {expiryLabel(p.accessExpiresAt)}</span>
          </p>
        ))}
        {!lib?.purchases.length && (
          <EmptyState
            icon="library"
            title="Nothing purchased yet"
            body="Paid lecturer materials you unlock will live here, with their access terms."
            action={<a className="btn sec" href="/courses">Browse courses</a>}
          />
        )}
      </div>
      <div className="card">
        <h3>Free official materials</h3>
        {(lib?.freeMaterials ?? []).map((m) => <p key={m.id}><a href={`/materials/${m.id}`}>{m.title}</a></p>)}
        {!lib?.freeMaterials.length && (
          <EmptyState
            icon="book"
            title="No free materials yet"
            body="Once your lecturer publishes free official notes, they will appear here."
            action={<a className="btn sec" href="/courses">Browse courses</a>}
          />
        )}
      </div>
    </div>
  );
}
