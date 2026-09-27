"use client";
import { useEffect, useState } from "react";
import { api, getUser } from "../../../lib/api";

// Protected reader shell: page navigation + watermark + dwell pings + mock checkout on 402.
export default function Reader({ params }: { params: { id: string } }) {
  const [meta, setMeta] = useState<{ title: string; version: number; course?: { code: string } } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const user = typeof window !== "undefined" ? getUser() : null;

  async function load(p: number) {
    setErr("");
    try {
      await api(`/materials/${params.id}/pages/${p}/url`);
      setPage(p);
      const t0 = Date.now();
      setTimeout(() => {
        api(`/materials/${params.id}/ping`, {
          method: "POST", body: JSON.stringify({ page: p, durationSec: Math.round((Date.now() - t0) / 1000) }),
        }).catch(() => {});
      }, 9000);
    } catch (e) {
      const msg = (e as Error).message;
      setErr(msg);
      const m = msg.match(/402|Purchase required/);
      if (m) {
        const det = await api(`/materials/${params.id}`).catch(() => null);
        if (det) setPrice(det.priceKobo);
      }
    }
  }
  useEffect(() => {
    api(`/materials/${params.id}`).then(setMeta).catch((e) => setErr((e as Error).message));
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function buy() {
    try {
      await api(`/materials/${params.id}/checkout`, { method: "POST", body: JSON.stringify({}) });
      setPrice(null); setErr(""); load(page);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <h2>{meta?.title ?? "Reader"} {meta && <span className="badge b-off">Official v{meta.version}</span>}</h2>
      {err && <div className="card" style={{ borderColor: "#D92D20" }}><p>{err}</p>
        {price != null && <div className="row"><span>₦{(price / 100).toFixed(2)}</span><button onClick={buy}>Buy now (mock checkout)</button></div>}
      </div>}
      <div className="card" style={{ background: "#1D2939", color: "#fff", position: "relative", minHeight: 300 }} onContextMenu={(e) => e.preventDefault()}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15, transform: "rotate(-18deg)", fontSize: 13, pointerEvents: "none", textAlign: "center" }}>
          {user?.name ?? "?"} · {user?.email ?? "?"} · {meta?.course?.code ?? ""} · Do not redistribute
        </div>
        <p className="muted" style={{ color: "#D0D5DD" }}>Page {page} / 10 · 🔒 Protected (R2 page-streaming lands in reader spike)</p>
        <h3>Page {page} content shell</h3>
        <p style={{ color: "#D0D5DD", lineHeight: 1.7 }}>Styled placeholder for rendered PDF page image. Right-click disabled. Dwell pings feed Study Journey (≥8s counts).</p>
      </div>
      <div className="row">
        <button className="sec" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</button>
        <button className="sec" disabled={page >= 10} onClick={() => load(page + 1)}>Next →</button>
      </div>
    </div>
  );
}
