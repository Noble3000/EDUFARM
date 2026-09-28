"use client";
import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";

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
      await api(`/materials/${params.id}/checkout`, { method: "POST", body: JSON.stringify({ pointsToUse: pts ? Number(pts) : 0 }) });
      setPrice(null); setErr(""); load(page);
    } catch (e) { setErr((e as Error).message); }
  }
  const [pts, setPts] = useState("");
  const [reviews, setReviews] = useState<{ id: string; rating: number; body: string | null; replies: { body: string; isLecturer: boolean }[] }[]>([]);
  const [rev, setRev] = useState({ rating: 5, body: "" });
  async function loadReviews() {
    setReviews(await api(`/materials/${params.id}/reviews`).catch(() => []));
  }
  useEffect(() => { loadReviews(); }, [params.id]);
  async function postReview() {
    try {
      await api(`/materials/${params.id}/reviews`, { method: "POST", body: JSON.stringify(rev) });
      setRev({ rating: 5, body: "" }); loadReviews();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <h2>{meta?.title ?? "Reader"} {meta && <span className="badge b-off">Official v{meta.version}</span>}</h2>
      {err && <div className="card" style={{ borderColor: "#D92D20" }}><p>{err}</p>
        {price != null && <div>
          <div className="row"><span>₦{(price / 100).toFixed(2)}</span>
            <input style={{ maxWidth: 160 }} placeholder="Points (min 5000)" value={pts} onChange={(e) => setPts(e.target.value)} />
            <button onClick={buy}>Buy now (mock checkout)</button>
          </div>
          <p className="muted">10 kobo per point · max 50% of price in points.</p>
        </div>}
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
      <div className="card">
        <h3>Reviews</h3>
        {reviews.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <p>★ {r.rating}/5 — {r.body}</p>
            {r.replies.map((rp, i) => <p key={i} style={{ marginLeft: 12 }}>{rp.isLecturer && <span className="badge b-off">Lecturer</span>}{rp.body}</p>)}
          </div>
        ))}
        {!reviews.length && <p className="muted">No reviews yet (requires meaningful access).</p>}
        <h4>Write a review</h4>
        <input type="number" min={1} max={5} value={rev.rating} onChange={(e) => setRev({ ...rev, rating: Number(e.target.value) })} />
        <textarea value={rev.body} onChange={(e) => setRev({ ...rev, body: e.target.value })} placeholder="What did you think?" />
        <button onClick={postReview}>Post review</button>
      </div>
    </div>
  );
}
