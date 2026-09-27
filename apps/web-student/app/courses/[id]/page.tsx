"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Course = {
  id: string; code: string; title: string;
  materials: { id: string; title: string; type: string; isFree: boolean; priceKobo: number; version: number }[];
  announcements: { id: string; title: string; body: string; isUrgent: boolean; category: string }[];
  questions: { id: string; title: string; body: string; status: string; answers: { body: string; isLecturer: boolean }[] }[];
};

export default function CourseDetail({ params }: { params: { id: string } }) {
  const [c, setC] = useState<Course | null>(null);
  const [q, setQ] = useState({ title: "", body: "" });
  useEffect(() => { api(`/courses/${params.id}`).then(setC).catch(() => {}); }, [params.id]);
  async function ask() {
    await api(`/courses/${params.id}/questions`, { method: "POST", body: JSON.stringify(q) });
    setQ({ title: "", body: "" });
    setC(await api(`/courses/${params.id}`));
  }
  if (!c) return <p>Loading…</p>;
  return (
    <div>
      <h2>{c.code} — {c.title}</h2>
      <div className="card">
        <h3>Materials</h3>
        {c.materials.map((m) => (
          <p key={m.id}>
            <a href={`/materials/${m.id}`}>{m.title}</a> <span className="badge b-off">Official v{m.version}</span>{" "}
            {m.isFree ? <span className="badge b-ed">Free</span> : <span className="badge b-ed">₦{(m.priceKobo / 100).toFixed(2)}</span>}
          </p>
        ))}
        {!c.materials.length && <p className="muted">No published materials yet.</p>}
      </div>
      <div className="card">
        <h3>Announcements</h3>
        {c.announcements.map((a) => (
          <p key={a.id}>{a.isUrgent && <span className="badge b-urg">Urgent</span>}<strong>{a.title}</strong> <span className="muted">[{a.category}]</span><br />{a.body}</p>
        ))}
        {!c.announcements.length && <p className="muted">None yet.</p>}
      </div>
      <div className="card">
        <h3>Course Q&A</h3>
        {c.questions.map((x) => (
          <div key={x.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
            <p><strong>{x.title}</strong> <span className="badge b-ed">{x.status}</span><br /><span className="muted">{x.body}</span></p>
            {x.answers.map((a, i) => <p key={i} style={{ marginLeft: 12 }}>{a.isLecturer && <span className="badge b-off">Lecturer ✓</span>}{a.body}</p>)}
          </div>
        ))}
        <h4>Ask a question</h4>
        <input placeholder="Title" value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} />
        <textarea placeholder="Details" value={q.body} onChange={(e) => setQ({ ...q, body: e.target.value })} />
        <button onClick={ask}>Post question</button>
      </div>
    </div>
  );
}
