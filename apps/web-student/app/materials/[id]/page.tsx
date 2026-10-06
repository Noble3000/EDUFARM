"use client";
import { useEffect, useState } from "react";
import { Crumb } from "@edufarm/ui";
import { api, getUser } from "@/lib/api";
import { EmptyState, ErrorState, Field, Icon, Modal, SuccessNote } from "@edufarm/ui";

// Protected reader: page navigation + watermark + dwell pings + checkout on 402.
// Page count comes from the material's latest version row — never hard-coded.
export default function Reader({ params }: { params: { id: string } }) {
  const [meta, setMeta] = useState<{
    title: string; version: number; priceKobo: number; isFree: boolean; accessDurationDays: number | null;
    versions?: { pageCount: number }[]; course?: { code: string; id: string };
    trust?: { lecturerName: string; lecturerVerified: boolean; official: boolean; edition: string; access: string };
  } | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [terms, setTerms] = useState<{
    title: string; edition: number; course: { code: string; title: string }; lecturer: string;
    priceKobo: number; accessDurationDays: number | null; permanent: boolean; alreadyHeld: boolean;
  } | null>(null);
  const [bought, setBought] = useState("");
  const [order, setOrder] = useState<{ id: string; status: string; authorizationUrl?: string; reference?: string } | null>(null);
  const [checking, setChecking] = useState(false);
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
      const m = msg.match(/402|Purchase required|expired/i);
      if (m) {
        const det = await api(`/materials/${params.id}`).catch(() => null);
        if (det) setPrice(det.priceKobo);
        // exact pre-payment terms — nothing is charged or granted from this view
        setTerms(await api(`/materials/${params.id}/terms`).catch(() => null));
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
      if (r.authorizationUrl) {
        // real provider flow: pay at the provider, then confirm here (grant comes via webhook only)
        setOrder({ id: r.order.id, status: r.order.status, authorizationUrl: r.authorizationUrl, reference: r.reference });
        return;
      }
      setPrice(null); setErr(""); setBought(`Unlocked — ₦${(r.amountKobo / 100).toFixed(2)}${r.accessExpiresAt ? ` · access until ${new Date(r.accessExpiresAt).toLocaleDateString()}` : ""}. It now lives in your Library.`);
      load(1);
    } catch (e) {
      const msg = (e as Error).message;
      if (/moved to orders|409/.test(msg)) {
        try {
          const o = await api(`/materials/${params.id}/orders`, { method: "POST", body: JSON.stringify({ pointsToUse: pts ? Number(pts) : 0 }) });
          setOrder({ id: o.order.id, status: o.order.status, authorizationUrl: o.authorizationUrl, reference: o.reference });
          return;
        } catch (e2) { setErr((e2 as Error).message); return; }
      }
      setErr(msg);
    }
  }
  async function checkOrder() {
    if (!order) return;
    setChecking(true);
    try {
      const o = await api(`/payments/orders/${order.id}`);
      setOrder({ ...order, status: o.order.status });
      if (o.order.status === "paid") {
        setPrice(null); setErr(""); setOrder(null);
        setBought("Payment confirmed — your library is updated. Happy studying.");
        load(1);
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setChecking(false); }
  }
  const [pts, setPts] = useState("");
  const [reviews, setReviews] = useState<{ id: string; mine: boolean; rating: number; body: string | null; replies: { body: string; isLecturer: boolean }[] }[]>([]);
  const [rev, setRev] = useState({ rating: 5, body: "" });
  const [editing, setEditing] = useState<{ id: string; rating: number; body: string } | null>(null);
  const [report, setReport] = useState<{ targetType: string; targetId: string; title: string } | null>(null);
  const [repReason, setRepReason] = useState("");
  const [repEvidence, setRepEvidence] = useState("");
  const [repDone, setRepDone] = useState("");
  async function loadReviews() {
    setReviews(await api(`/materials/${params.id}/reviews`).catch(() => []));
  }
  useEffect(() => {
    loadReviews();
  }, [params.id]);
  async function postReview() {
    try {
      await api(`/materials/${params.id}/reviews`, { method: "POST", body: JSON.stringify(rev) });
      setRev({ rating: 5, body: "" }); loadReviews();
    } catch (e) { setErr((e as Error).message); }
  }
  async function saveEdit() {
    if (!editing) return;
    try {
      await api(`/reviews/${editing.id}`, { method: "PATCH", body: JSON.stringify({ rating: editing.rating, body: editing.body }) });
      setEditing(null); loadReviews();
    } catch (e) { setErr((e as Error).message); }
  }
  async function deleteReview(id: string) {
    try {
      await api(`/reviews/${id}`, { method: "DELETE" });
      loadReviews();
    } catch (e) { setErr((e as Error).message); }
  }
  async function submitReport() {
    if (!report || !repReason.trim()) { setErr("Report reason required."); return; }
    try {
      const path = report.targetType === "Review" ? `/reviews/${report.targetId}/report` : "/reports";
      const body = report.targetType === "Review"
        ? { reason: repReason, evidence: repEvidence || undefined }
        : { targetType: report.targetType, targetId: report.targetId, reason: repReason, evidence: repEvidence || undefined };
      const d = await api(path, { method: "POST", body: JSON.stringify(body) });
      setRepDone(`Report received (ref ${(d.id as string).slice(0, 8)}). Nothing is removed automatically — reviewers decide.`);
      setReport(null); setRepReason(""); setRepEvidence("");
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <Crumb trail={[{ href: '/', label: 'Home' }, { href: '/library', label: 'Library' }, { label: 'Reader' }]} />
      <h2>{meta?.title ?? "Reader"} {meta && <span className="badge b-off">Official v{meta.version}</span>}</h2>
      {meta?.trust && (
        <p className="muted">
          <Icon name="user" size={13} /> {meta.trust.lecturerName}
          {meta.trust.lecturerVerified && <span className="badge b-ver">Verified Lecturer</span>}
          <span className="badge b-ed">{meta.trust.edition}</span>
        </p>
      )}
      {meta && (
        <div className="card tight">
          <strong>Access terms (before payment):</strong>{" "}
          <span className="muted">{meta.trust?.access ?? (meta.isFree ? "Free official material" : `₦${(meta.priceKobo / 100).toFixed(2)}`)}</span>
          <br /><span className="muted">In-ecosystem reading only — no download, offline, export, or platform capture. Photos of screens by external devices cannot be prevented; redistribution is prohibited and watermarked.</span>
        </div>
      )}
      {err && (
        <div style={{ marginBottom: 12 }}>
          <ErrorState message={err} onRetry={() => load(page)} />
          {price != null && (
            <div className="card">
              <h3>Access terms — exact, before you pay</h3>
              {terms ? (
                <>
                  <p><strong>{terms.title}</strong> <span className="badge b-off">Edition v{terms.edition}</span></p>
                  <p className="muted">{terms.course.code} — {terms.course.title} · by {terms.lecturer}</p>
                  <p><strong>₦{(terms.priceKobo / 100).toFixed(2)}</strong> <span className="muted">· {terms.permanent ? "permanent / long-term access, no expiry" : `${terms.accessDurationDays} days access from payment`} · in-ecosystem reading only · {terms.alreadyHeld ? "you already hold a usable grant" : "no grant yet — nothing is unlocked until payment confirms"}</span></p>
                </>
              ) : (
                <p><strong>₦{(price / 100).toFixed(2)}</strong> <span className="muted">· {meta?.accessDurationDays ? `${meta.accessDurationDays} days access` : "access per terms"} · in-ecosystem reading only</span></p>
              )}
              <Field label="Points to use" optional hint="10 kobo per point · max 50% of price in points. Minimum 5000 to redeem.">
                <input style={{ maxWidth: 160 }} placeholder="Points (min 5000)" value={pts} onChange={(e) => setPts(e.target.value)} inputMode="numeric" />
              </Field>
              <div className="row"><button onClick={buy}>Unlock now</button><a className="btn sec" href="/library">Open Library</a></div>
              {order && (
                <div className="card tight" style={{ marginTop: 12 }}>
                  <p><strong>Order {order.id.slice(0, 8)}</strong> <span className="badge b-ed">{order.status}</span></p>
                  {order.authorizationUrl && <p><a className="btn" href={order.authorizationUrl} target="_blank" rel="noreferrer">Continue to payment</a></p>}
                  <p className="muted">Access is granted only after the provider confirms — never from this page alone.</p>
                  <div className="row"><button className="sec" onClick={checkOrder} disabled={checking}>{checking ? "Checking…" : "I've paid — check status"}</button></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {bought && <div style={{ marginBottom: 12 }}><SuccessNote>{bought}</SuccessNote></div>}
      <style>{`.reader-lock{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}.reader-lock img{-webkit-user-drag:none;pointer-events:none}@media print{.reader-lock{display:none !important}}`}</style>
      <div className="card reader-lock" style={{ background: "#1D2939", color: "#fff", position: "relative", minHeight: 300 }} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()}>
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
        <p className="muted">Only students with meaningful access can review — one review each (edit yours). <button className="sec" style={{ minHeight: 36, padding: "6px 12px", fontSize: 13 }} onClick={() => setReport({ targetType: "Material", targetId: params.id, title: meta?.title ?? "this material" })}>Report this material</button></p>
        {reviews.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <p><Icon name="star" size={14} /> {r.rating}/5 — {r.body}</p>
            {r.replies.map((rp, i) => <p key={i} style={{ marginLeft: 12 }}>{rp.isLecturer && <span className="badge b-off">Lecturer</span>}{rp.body}</p>)}
            {r.mine ? (
              editing?.id === r.id ? (
                <div className="row tight">
                  <input style={{ maxWidth: 70 }} aria-label="Rating" type="number" min={1} max={5} value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} />
                  <input style={{ maxWidth: 220 }} aria-label="Review text" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                  <button className="sec" onClick={saveEdit}>Save</button>
                  <button className="sec" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <div className="row tight">
                  <button className="sec" onClick={() => setEditing({ id: r.id, rating: r.rating, body: r.body ?? "" })}>Edit mine</button>
                  <button className="sec" onClick={() => deleteReview(r.id)}>Delete mine</button>
                </div>
              )
            ) : (
              <button className="sec" style={{ minHeight: 36, padding: "6px 12px", fontSize: 13 }} onClick={() => setReport({ targetType: "Review", targetId: r.id, title: `review ${r.rating}/5` })}>Report</button>
            )}
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
        {repDone && <div style={{ marginTop: 8 }}><SuccessNote>{repDone}</SuccessNote></div>}
      </div>
      {report && (
        <Modal title={`Report ${report.title}`} onClose={() => setReport(null)}>
          <p className="muted">Reports go to human reviewers — nothing is removed automatically.</p>
          <Field label="Reason">
            <textarea value={repReason} onChange={(e) => setRepReason(e.target.value)} rows={3} placeholder="What is wrong?" />
          </Field>
          <Field label="Evidence / reference" optional hint="Link, page, quote — anything that helps review.">
            <input value={repEvidence} onChange={(e) => setRepEvidence(e.target.value)} placeholder="e.g. page 4, copied source" />
          </Field>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="sec" onClick={() => setReport(null)}>Cancel</button>
            <button onClick={submitReport}>Submit report</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
