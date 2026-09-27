"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Enr = { id: string; status: string; student: { user: { name: string; email: string } } };

export default function ManageCourse({ params }: { params: { id: string } }) {
  const [enrs, setEnrs] = useState<Enr[]>([]);
  const [ann, setAnn] = useState({ category: "course-notice", title: "", body: "", isUrgent: false });
  const [mat, setMat] = useState({ title: "", type: "lecture-notes", isFree: true, priceKobo: 50000, accessDurationDays: 90 });
  const [msg, setMsg] = useState("");
  async function refresh() {
    setEnrs(await api(`/courses/${params.id}/enrollments`).catch(() => []));
  }
  useEffect(() => { refresh(); }, [params.id]);
  async function decide(id: string, decision: string) {
    await api(`/enrollments/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
    refresh();
  }
  async function postAnn() {
    await api(`/courses/${params.id}/announcements`, { method: "POST", body: JSON.stringify(ann) });
    setAnn({ ...ann, title: "", body: "" }); setMsg("Announcement posted.");
  }
  async function upload(submit: boolean) {
    const created = await api(`/courses/${params.id}/materials`, {
      method: "POST",
      body: JSON.stringify({ ...mat, priceKobo: Number(mat.priceKobo), accessDurationDays: Number(mat.accessDurationDays), fileKey: "dev/mock.pdf", checksum: "dev" }),
    });
    if (submit) await api(`/materials/${created.id}/submit`, { method: "POST" });
    setMsg(submit ? "Submitted for platform review." : "Draft saved.");
  }
  return (
    <div>
      <h2>Manage course</h2>
      <div className="card"><h3>Enrollments</h3>
        {enrs.map((e) => (
          <div className="row" key={e.id} style={{ marginBottom: 8 }}>
            <span>{e.student.user.name} ({e.student.user.email}) — <strong>{e.status}</strong></span>
            <button className="sec" onClick={() => decide(e.id, "approve")}>Approve</button>
            <button className="sec" onClick={() => decide(e.id, "reject")}>Reject</button>
          </div>
        ))}
        {!enrs.length && <p className="muted">No enrollments (or not logged in as lecturer).</p>}
      </div>
      <div className="card"><h3>New announcement</h3>
        <select value={ann.category} onChange={(e) => setAnn({ ...ann, category: e.target.value })}>
          {["new-material", "assignment", "test", "course-notice", "general", "urgent-update"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="Title" value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
        <textarea placeholder="Body" value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
        <label><input type="checkbox" style={{ width: "auto" }} checked={ann.isUrgent} onChange={(e) => setAnn({ ...ann, isUrgent: e.target.checked })} /> Urgent</label>
        <div><button onClick={postAnn}>Post</button></div>
      </div>
      <div className="card"><h3>Upload material</h3>
        <input placeholder="Title" value={mat.title} onChange={(e) => setMat({ ...mat, title: e.target.value })} />
        <select value={mat.type} onChange={(e) => setMat({ ...mat, type: e.target.value })}>
          {["lecture-notes", "course-pack", "revision-guide", "practice-questions", "exam-prep"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label><input type="checkbox" style={{ width: "auto" }} checked={mat.isFree} onChange={(e) => setMat({ ...mat, isFree: e.target.checked })} /> Free</label>
        {!mat.isFree && <input type="number" value={mat.priceKobo} onChange={(e) => setMat({ ...mat, priceKobo: Number(e.target.value) })} />}
        <div className="row">
          <button className="sec" onClick={() => upload(false)}>Save draft</button>
          <button onClick={() => upload(true)}>Submit for review</button>
        </div>
        <p>{msg}</p>
        <p className="muted">File bytes → R2 in reader spike; metadata + lifecycle live now. Answer Q&A from the student course page data via API.</p>
      </div>
    </div>
  );
}
