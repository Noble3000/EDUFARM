"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type Enr = { id: string; status: string; student: { user: { name: string; email: string } } };

export default function ManageCourse({ params }: { params: { id: string } }) {
  const [enrs, setEnrs] = useState<Enr[]>([]);
  const [ann, setAnn] = useState({ category: "course-notice", title: "", body: "", isUrgent: false });
  const [mat, setMat] = useState({ title: "", type: "lecture-notes", isFree: true, priceKobo: 50000, accessDurationDays: 90 });
  const [msg, setMsg] = useState("");
  const [asmts, setAsmts] = useState<{ id: string; title: string; status: string }[]>([]);
  const [atitle, setAtitle] = useState("");
  const [grade, setGrade] = useState<{ attempts: { id: string; status: string; score: number | null }[] } | null>(null);
  const [gradeId, setGradeId] = useState("");
  async function refresh() {
    setEnrs(await api(`/courses/${params.id}/enrollments`).catch(() => []));
  }
  useEffect(() => {
    refresh();
    api(`/courses/${params.id}/assessments/lecturer`).then(setAsmts).catch(() => []);
  }, [params.id]);
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
            <button className="sec" onClick={async () => {
              try {
                await api("/points/recognize", { method: "POST", body: JSON.stringify({ studentId: (e.student as unknown as { id: string }).id, reason: "participation" }) });
                setMsg("Recognition +5 points awarded.");
              } catch (err) { setMsg((err as Error).message); }
            }}>Recognize +5</button>
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
      <div className="card"><h3>Assessments</h3>
        <input placeholder="New assessment title (quiz)" value={atitle} onChange={(e) => setAtitle(e.target.value)} />
        <div className="row">
          <button onClick={async () => {
            const a = await api(`/courses/${params.id}/assessments`, { method: "POST", body: JSON.stringify({ title: atitle, type: "quiz" }) });
            setAtitle(""); setGradeId(a.id); setMsg(`Created ${a.title} — add questions below, then publish.`);
            setAsmts([...asmts, a]);
          }}>Create draft</button>
          <button className="sec" onClick={async () => {
            setAsmts(await api(`/courses/${params.id}/assessments/lecturer`).catch(() => []));
          }}>Refresh list</button>
        </div>
        {asmts.map((a) => (
          <div className="row" key={a.id} style={{ marginTop: 8 }}>
            <span><strong>{a.title}</strong> · {a.status}</span>
            <button className="sec" onClick={() => setGradeId(a.id)}>Open</button>
            <button onClick={async () => {
              await api(`/assessments/${a.id}/publish`, { method: "POST", body: JSON.stringify({}) });
              setMsg(`Published ${a.title} — students notified.`);
            }}>Publish</button>
          </div>
        ))}
        {gradeId && <div style={{ marginTop: 12 }}>
          <h4>Add MCQ question to {gradeId.slice(0, 8)}…</h4>
          <QuestionForm assessmentId={gradeId} onDone={(m) => setMsg(m)} />
          <h4>Attempts</h4>
          <button className="sec" onClick={async () => {
            setGrade(await api(`/assessments/${gradeId}/attempts`).catch(() => null));
          }}>Load attempts</button>
          {grade?.attempts.map((t) => (
            <p key={t.id}>· {t.id.slice(0, 8)} — {t.status}{t.score != null ? ` ${t.score}` : ""}</p>
          ))}
        </div>}
      </div>
      <Insights courseId={params.id} />
    </div>
  );
}

function Insights({ courseId }: { courseId: string }) {
  const [ins, setIns] = useState<{
    assessmentStats: { id: string; title: string; attempts: number; avgScore: number | null; maxScore: number }[];
    unanswered: { id: string; title: string }[];
    weakCompletion: { materialId: string; title: string; readers: number }[];
    enrolled: number; suggestions: string[];
  } | null>(null);
  return (
    <div className="card">
      <h3>AI insights</h3>
      <button className="sec" onClick={async () => {
        setIns(await api(`/courses/${courseId}/insights`).catch(() => null));
      }}>Generate insights</button>
      {ins && (
        <div>
          <p className="muted">Enrolled: {ins.enrolled}</p>
          {ins.assessmentStats.map((a) => (
            <p key={a.id}>· {a.title}: {a.attempts} attempts{a.avgScore != null ? `, avg ${a.avgScore}/${a.maxScore}` : ""}</p>
          ))}
          {!!ins.unanswered.length && <p>Unanswered ({ins.unanswered.length}): {ins.unanswered.map((u) => u.title).join("; ")}</p>}
          {!!ins.weakCompletion.length && <p>Weak completion: {ins.weakCompletion.map((w) => `${w.title} (${w.readers} readers)`).join("; ")}</p>}
          {ins.suggestions.map((s, i) => <p key={i}>💡 {s}</p>)}
        </div>
      )}
    </div>
  );
}

function QuestionForm({ assessmentId, onDone }: { assessmentId: string; onDone: (m: string) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState("A,B,C,D");
  const [correctIndex, setCorrectIndex] = useState(0);
  return (
    <div>
      <input placeholder="Question text" value={text} onChange={(e) => setText(e.target.value)} />
      <input placeholder="Options comma-separated" value={options} onChange={(e) => setOptions(e.target.value)} />
      <input type="number" min={0} value={correctIndex} onChange={(e) => setCorrectIndex(Number(e.target.value))} />
      <button onClick={async () => {
        await api(`/assessments/${assessmentId}/questions`, {
          method: "POST",
          body: JSON.stringify({ text, kind: "mcq", options: options.split(",").map((s) => s.trim()), correctIndex }),
        });
        setText(""); onDone("Question added.");
      }}>Add question</button>
    </div>
  );
}
