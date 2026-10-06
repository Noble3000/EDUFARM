"use client";
import { useEffect, useState } from "react";
import { Crumb } from "@edufarm/ui";
import { api, getUser } from "@/lib/api";
import { Alert, EmptyState, Field, Icon, LoadingState } from "@edufarm/ui";

type Course = {
  id: string; code: string; title: string;
  materials: { id: string; title: string; type: string; isFree: boolean; priceKobo: number; version: number }[];
  announcements: { id: string; title: string; body: string; isUrgent: boolean; category: string }[];
  questions: { id: string; authorId: string; title: string; body: string; status: string; answers: { body: string; isLecturer: boolean }[] }[];
};

export default function CourseDetail({ params }: { params: { id: string } }) {
  const [c, setC] = useState<Course | null>(null);
  const [q, setQ] = useState({ title: "", body: "" });
  const [asmts, setAsmts] = useState<{ id: string; title: string; type: string; dueAt: string | null; gradesReleased: boolean; attempts: { status: string; score: number | null; maxScore: number | null }[] }[]>([]);
  const [qq, setQq] = useState("");
  const [qstatus, setQstatus] = useState("");
  const me = typeof window !== "undefined" ? getUser() : null;
  async function refreshQuestions() {
    const qs = new URLSearchParams();
    if (qq) qs.set("q", qq);
    if (qstatus) qs.set("status", qstatus);
    const list = await api(`/courses/${params.id}/questions?${qs.toString()}`);
    setC((prev) => (prev ? { ...prev, questions: list } : prev));
  }
  useEffect(() => {
    api(`/courses/${params.id}`).then(setC).catch(() => {});
    api(`/courses/${params.id}/assessments`).then(setAsmts).catch(() => []);
  }, [params.id]);
  async function ask() {
    await api(`/courses/${params.id}/questions`, { method: "POST", body: JSON.stringify(q) });
    setQ({ title: "", body: "" });
    setC(await api(`/courses/${params.id}`));
  }
  if (!c) return (
    <div>
      <Crumb trail={[{ href: '/', label: 'Home' }, { href: '/courses', label: 'Courses' }, { label: 'Course' }]} />
      <LoadingState label="Loading course…" />
    </div>
  );
  return (
    <div>
      <Crumb trail={[{ href: '/', label: 'Home' }, { href: '/courses', label: 'Courses' }, { label: 'Course' }]} />
      <h2>{c.code} — {c.title}</h2>
      <div className="card">
        <h3>Materials</h3>
        {c.materials.map((m) => (
          <p key={m.id}>
            <a href={`/materials/${m.id}`}>{m.title}</a> <span className="badge b-off">Official v{m.version}</span>{" "}
            {m.isFree ? <span className="badge b-ed">Free</span> : <span className="badge b-ed">₦{(m.priceKobo / 100).toFixed(2)}</span>}
          </p>
        ))}
        {!c.materials.length && (
          <EmptyState icon="book" title="No published materials yet" body="Your lecturer has not published official materials for this course." />
        )}
      </div>
      <div className="card">
        <h3>Announcements</h3>
        {c.announcements.map((a) => (
          <p key={a.id}>{a.isUrgent && <span className="badge b-urg">Urgent</span>}<strong>{a.title}</strong> <span className="muted">[{a.category}]</span><br />{a.body}</p>
        ))}
        {!c.announcements.length && (
          <EmptyState icon="announce" title="No announcements" body="When your lecturer posts an update, it will land here." />
        )}
      </div>
      <div className="card">
        <h3>Assessments</h3>
        {asmts.map((a) => (
          <p key={a.id}>
            <a href={`/assessments/${a.id}`}>{a.title}</a> <span className="badge b-ed">{a.type}</span>{" "}
            {a.attempts[0] && <span className="badge b-off">{a.attempts[0].status}{a.attempts[0].score != null ? ` ${a.attempts[0].score}/${a.attempts[0].maxScore}` : " (results unreleased)"}</span>}
            {a.dueAt && <span className="muted"> due {new Date(a.dueAt).toLocaleDateString()}</span>}
          </p>
        ))}
        {!asmts.length && (
          <EmptyState icon="quiz" title="No published assessments yet" body="Practice and graded tests for this course will appear here." />
        )}
      </div>
      <div className="card">
        <h3>Course Q&A</h3>
        <div className="row">
          <input style={{ maxWidth: 220 }} placeholder="Search questions…" value={qq} onChange={(e) => setQq(e.target.value)} />
          <select style={{ maxWidth: 160 }} value={qstatus} onChange={(e) => setQstatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="unanswered">Unanswered</option>
            <option value="answered">Answered</option>
            <option value="resolved">Resolved</option>
          </select>
          <button className="sec" onClick={refreshQuestions}>Search</button>
        </div>
        {c.questions.map((x) => (
          <div key={x.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <p><strong>{x.title}</strong> <span className="badge b-ed">{x.status}</span><br /><span className="muted">{x.body}</span></p>
            {x.answers.map((a, i) => <p key={i} style={{ marginLeft: 12 }}>{a.isLecturer && <span className="badge b-off"><Icon name="check" size={12} /> Lecturer</span>}{a.body}</p>)}
            {x.status !== "resolved" && me && x.authorId === me.id && (
              <button className="sec" onClick={async () => { await api(`/questions/${x.id}/resolve`, { method: "POST", body: JSON.stringify({}) }); refreshQuestions(); }}>Mark resolved</button>
            )}
          </div>
        ))}
        {!c.questions.length && (
          <EmptyState icon="qa" title="No questions yet" body="Be the first to ask — lecturer replies show for the whole class." />
        )}
        <h4>Ask a question</h4>
        <Field label="Question title">
          <input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} placeholder="e.g. How do I apply this formula?" />
        </Field>
        <Field label="Details">
          <textarea value={q.body} onChange={(e) => setQ({ ...q, body: e.target.value })} placeholder="Add context for your classmates and lecturer" rows={3} />
        </Field>
        <button onClick={ask}>Post question</button>
      </div>
      <AskAI courseId={params.id} />
    </div>
  );
}

function AskAI({ courseId }: { courseId: string }) {
  const [question, setQuestion] = useState("");
  const [res, setRes] = useState<{
    grounded: boolean; answer: string;
    citations: { materialTitle: string; edition: string; chunk: string; sourceType: string }[];
    additionalContext: string | null; refusalCode?: string | null;
  } | null>(null);
  const [msg, setMsg] = useState("");
  const busy = msg === "…";
  async function askAI() {
    setMsg("…"); setRes(null);
    try {
      setRes(await api("/ai/ask", { method: "POST", body: JSON.stringify({ courseId, question }) }));
      setMsg("");
    } catch (e) { setMsg((e as Error).message); }
  }
  return (
    <div className="card">
      <h3>AI Study Assistant <span className="badge b-ed">grounded</span></h3>
      <Field label="Ask about your authorized materials">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your authorized materials…" />
      </Field>
      <button onClick={askAI} disabled={busy}>Ask</button>
      <div style={{ marginTop: 12 }}>
        {busy && <LoadingState lines={1} label="Asking AI…" />}
        {msg && !busy && <Alert kind="error">{msg}</Alert>}
      </div>
      {res && (
        <div>
          <p><span className={`badge ${res.grounded ? "b-off" : "b-ed"}`}>
            {res.grounded ? "Course Material Answer" : `Not answered${res.refusalCode ? ` (${res.refusalCode})` : ""}`}
          </span></p>
          <p>{res.answer}</p>
          {!!res.citations.length && (
            <p className="muted">Sources: {res.citations.map((c, i) => (
              <span key={i}>[{c.materialTitle} {c.edition} · {c.chunk} · {c.sourceType === "lecturer-answer" ? "lecturer answer" : "material"}] </span>
            ))}</p>
          )}
          {res.additionalContext && <p className="muted"><strong>Additional Academic Context</strong> (not lecturer material): {res.additionalContext}</p>}
          {!res.grounded && <p className="muted">No general answer is fabricated — see Course Q&A for lecturer help.</p>}
        </div>
      )}
    </div>
  );
}
