"use client";
import { useEffect, useState } from "react";
import { Crumb } from "@edufarm/ui";
import { api, getUser } from "@/lib/api";
import { EmptyState, ErrorState, Field, Icon, SuccessNote } from "@edufarm/ui";

// Protected reader: page navigation + watermark + dwell pings + checkout on 402.
// Page count comes from the material's latest version row — never hard-coded.
export default function Reader({ params }: { params: { id: string } }) {
  const [meta, setMeta] = useState<{ title: string; version: number; priceKobo: number; isFree: boolean; accessDurationDays: number | null; versions?: { pageCount: number }[]; course?: { code: string; id: string } } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [bought, setBought] = useState("");
  const user = typeof window !== "undefined" ? getUser() : null;
  const totalPages = meta?.versions?.[0]?.pageCount || 10;

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
      const r = await api(`/materials/${params.id}/checkout`, { method: "POST", body: JSON.stringify({ pointsToUse: pts ? Number(pts) : 0 }) });
      setPrice(null); setErr(""); setBought(`Unlocked — ₦${(r.amountKobo / 100).toFixed(2)}${r.accessExpiresAt ? ` · access until ${new Date(r.accessExpiresAt).toLocaleDateString()}` : ""}. It now lives in your Library.`);
      load(1);
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
      <Crumb trail={[{ href: '/', label: 'Home' }, { href: '/library', label: 'Library' }, { label: 'Reader' }]} />
      <h2>{meta?.title ?? "Reader"} {meta && <span className="badge b-off">Official v{meta.version}</span>}</h2>
      {err && (
        <div style={{ marginBottom: 12 }}>
          <ErrorState message={err} onRetry={() => load(page)} />
          {price != null && (
            <div className="card">
              <p><strong>₦{(price / 100).toFixed(2)}</strong> <span className="muted">· {meta?.accessDurationDays ? `${meta.accessDurationDays} days access` : "access per terms"} · in-ecosystem reading only</span></p>
              <Field label="Points to use" optional hint="10 kobo per point · max 50% of price in points. Minimum 5000 to redeem.">
                <input style={{ maxWidth: 160 }} placeholder="Points (min 5000)" value={pts} onChange={(e) => setPts(e.target.value)} inputMode="numeric" />
              </Field>
              <div className="row"><button onClick={buy}>Unlock now</button><a className="btn sec" href="/library">Open Library</a></div>
            </div>
          )}
        </div>
      )}
      {bought && <div style={{ marginBottom: 12 }}><SuccessNote>{bought}</SuccessNote></div>}
      <div className="card" style={{ background: "#1D2939", color: "#fff", position: "relative", minHeight: 300 }} onContextMenu={(e) => e.preventDefault()}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15, transform: "rotate(-18deg)", fontSize: 13, pointerEvents: "none", textAlign: "center" }}>
          {user?.name ?? "?"} · {user?.email ?? "?"} · {meta?.course?.code ?? ""} · Do not redistribute
        </div>
        <p className="muted" style={{ color: "#D0D5DD" }}>Page {page} of {totalPages} · <Icon name="lock" size={13} /> Protected in-ecosystem reading</p>
        <h3>{meta?.title ?? "Material"} — page {page}</h3>
        <p style={{ color: "#D0D5DD", lineHeight: 1.7 }}>Rendered page image streams here from protected storage. Right-click is disabled and your copy carries your identity watermark. Dwell pings feed Study Journey (≥8s counts).</p>
      </div>
      <div className="row">
        <button className="sec" disabled={page <= 1} onClick={() => load(page - 1)}><Icon name="chevL" size={14} /> Prev</button>
        <button className="sec" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next <Icon name="chevR" size={14} /></button>
      </div>
      <div className="card">
        <h3>Reviews</h3>
        {reviews.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <p><Icon name="star" size={14} /> {r.rating}/5 — {r.body}</p>
            {r.replies.map((rp, i) => <p key={i} style={{ marginLeft: 12 }}>{rp.isLecturer && <span className="badge b-off">Lecturer</span>}{rp.body}</p>)}
          </div>
        ))}
        {!reviews.length && (
          <EmptyState icon="star" title="No reviews yet" body="Reviews unlock after meaningful access to this material." />
        )}
        <h4>Write a review</h4>
        <Field label="Rating (1–5)">
          <input type="number" min={1} max={5} value={rev.rating} onChange={(e) => setRev({ ...rev, rating: Number(e.target.value) })} />
        </Field>
        <Field label="Your review">
          <textarea value={rev.body} onChange={(e) => setRev({ ...rev, body: e.target.value })} placeholder="What did you think?" rows={3} />
        </Field>
        <button onClick={postReview}>Post review</button>
      </div>
    </div>
  );
}
