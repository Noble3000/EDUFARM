
// --- Announcements manager + Q&A console (course-space workflow) ---
"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, Field, SuccessNote } from "@edufarm/ui";
import { api } from "@/lib/api";

export function AnnouncementsManager({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<{ id: string; title: string; body: string; category: string; isUrgent: boolean; archived: boolean }[]>([]);
  const [editing, setEditing] = useState<{ id: string; title: string; body: string; category: string } | null>(null);
  const [msg, setMsg] = useState("");
  async function load() {
    setRows(await api(`/courses/${courseId}/announcements?includeArchived=true`).catch(() => []));
  }
  useEffect(() => { load(); }, [courseId]);
  return (
    <div className="card">
      <h3>Published announcements</h3>
      {rows.map((a) => (
        <div key={a.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
          {editing?.id === a.id ? (
            <div>
              <Field label="Title"><input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <Field label="Body"><textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={3} /></Field>
              <Field label="Category">
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {["new-material", "assignment", "test", "course-notice", "general", "urgent-update"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div className="row">
                <button onClick={async () => {
                  await api(`/announcements/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
                  setEditing(null); setMsg("Announcement updated (audited)."); load();
                }}>Save</button>
                <button className="sec" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span>{a.isUrgent && <Badge kind="bad">Urgent</Badge>}<strong>{a.title}</strong> <span className="muted">[{a.category}]</span> {a.archived && <Badge kind="edition">archived</Badge>}</span>
              <span className="row tight">
                <button className="sec" onClick={() => setEditing({ id: a.id, title: a.title, body: a.body, category: a.category })}>Edit</button>
                {!a.archived && <button className="sec" onClick={async () => {
                  await api(`/announcements/${a.id}/archive`, { method: "POST", body: JSON.stringify({}) });
                  setMsg("Archived (retained, hidden from students)."); load();
                }}>Archive</button>}
              </span>
            </div>
          )}
        </div>
      ))}
      {!rows.length && <p className="muted">Nothing published yet — use the composer above.</p>}
      {msg && <SuccessNote>{msg}</SuccessNote>}
    </div>
  );
}

export function QAConsole({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<{ id: string; title: string; body: string; status: string; answers: { body: string; isLecturer: boolean }[] }[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  async function load() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    setRows(await api(`/courses/${courseId}/questions?${qs.toString()}`).catch(() => []));
  }
  useEffect(() => { load(); }, [courseId]);
  return (
    <div className="card">
      <h3>Course Q&A console</h3>
      <div className="row">
        <input style={{ maxWidth: 220 }} placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ maxWidth: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="unanswered">Unanswered</option>
          <option value="answered">Answered</option>
          <option value="resolved">Resolved</option>
        </select>
        <button className="sec" onClick={load}>Search</button>
      </div>
      {rows.map((x) => (
        <div key={x.id} style={{ borderTop: "1px solid #eee", paddingTop: 8 }}>
          <p><strong>{x.title}</strong> <Badge kind="edition">{x.status}</Badge><br /><span className="muted">{x.body}</span></p>
          {x.answers.map((a, i) => (
            <p key={i} style={{ marginLeft: 12 }}>{a.isLecturer
              ? <span className="badge b-off">Lecturer</span>
              : <span className="badge b-ed">Student</span>} {a.body}</p>
          ))}
          <Field label={`Answer as lecturer — ${x.title}`}>
            <textarea rows={2} value={drafts[x.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [x.id]: e.target.value })} placeholder="Write the class-visible answer…" />
          </Field>
          <div className="row">
            <button className="sec" onClick={async () => {
              await api(`/questions/${x.id}/answers`, { method: "POST", body: JSON.stringify({ body: drafts[x.id] ?? "" }) });
              setDrafts({ ...drafts, [x.id]: "" }); setMsg("Answer posted for the whole class."); load();
            }}>Post answer</button>
            {x.status !== "resolved" && <button className="sec" onClick={async () => {
              await api(`/questions/${x.id}/resolve`, { method: "POST", body: JSON.stringify({}) });
              load();
            }}>Resolve</button>}
          </div>
        </div>
      ))}
      {!rows.length && <EmptyState icon="qa" title="No questions match" body="Try a different search, or wait for students to ask." />}
      {msg && <SuccessNote>{msg}</SuccessNote>}
    </div>
  );
}
