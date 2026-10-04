"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmptyState, LoadingState } from "@edufarm/ui";

export default function Library() {
  const [lib, setLib] = useState<{ purchases: { id: string; materialId: string; amountKobo: number }[]; freeMaterials: { id: string; title: string }[] } | null>(null);
  useEffect(() => { api("/library/me").then(setLib).catch(() => {}); }, []);
  if (!lib) return <LoadingState label="Loading your library…" />;
  return (
    <div>
      <h2>My Academic Library</h2>
      <div className="card">
        <h3>Purchased</h3>
        {lib.purchases.map((p) => <p key={p.id}><a href={`/materials/${p.materialId}`}>{p.materialId}</a> — ₦{(p.amountKobo / 100).toFixed(2)}</p>)}
        {!lib.purchases.length && (
          <EmptyState
            icon="library"
            title="Nothing purchased yet"
            body="Paid lecturer materials you unlock will live here."
            action={<a className="btn sec" href="/courses">Browse courses</a>}
          />
        )}
      </div>
      <div className="card">
        <h3>Free official materials</h3>
        {lib.freeMaterials.map((m) => <p key={m.id}><a href={`/materials/${m.id}`}>{m.title}</a></p>)}
        {!lib.freeMaterials.length && (
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
