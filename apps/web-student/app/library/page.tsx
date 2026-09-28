"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Library() {
  const [lib, setLib] = useState<{ purchases: { id: string; materialId: string; amountKobo: number }[]; freeMaterials: { id: string; title: string }[] } | null>(null);
  useEffect(() => { api("/library/me").then(setLib).catch(() => {}); }, []);
  if (!lib) return <p>Loading… (log in first)</p>;
  return (
    <div>
      <h2>My Academic Library</h2>
      <div className="card">
        <h3>Purchased</h3>
        {lib.purchases.map((p) => <p key={p.id}>· <a href={`/materials/${p.materialId}`}>{p.materialId}</a> — ₦{(p.amountKobo / 100).toFixed(2)}</p>)}
        {!lib.purchases.length && <p className="muted">Nothing purchased yet.</p>}
      </div>
      <div className="card">
        <h3>Free official materials</h3>
        {lib.freeMaterials.map((m) => <p key={m.id}>· <a href={`/materials/${m.id}`}>{m.title}</a></p>)}
        {!lib.freeMaterials.length && <p className="muted">None yet.</p>}
      </div>
    </div>
  );
}
