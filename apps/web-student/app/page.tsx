"use client";
import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";

// Student home (§6.1 order): Word → priorities → continue → courses → updates → Q&A → points → AI stub.
export default function Home() {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string }[]>([]);
  const [cont, setCont] = useState<{ materialId: string | null; page?: number; material?: { title: string } } | null>(null);
  const [enroll, setEnroll] = useState<{ courseId: string; course: { code: string; title: string }; status: string }[]>([]);
  const [progress, setProgress] = useState<{ courseId: string; code: string; percent: number }[]>([]);
  const [points, setPoints] = useState<{ balance: number } | null>(null);

  const [word, setWord] = useState<{ title: string; verse: string; body: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
    api("/devotional/today").then(setWord).catch(() => {});
    if (!getUser()) return;
    api("/notifications/me").then(setNotes).catch(() => {});
    api("/progress/continue").then(setCont).catch(() => {});
    api("/enrollments/me").then(setEnroll).catch(() => {});
    api("/progress/me").then(setProgress).catch(() => {});
    api("/points/me").then(setPoints).catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="card">
        <h2>Welcome to EDUFARM</h2>
        <p>Verified lecturer–student learning ecosystem. <a href="/login">Log in with a demo account</a> to begin.</p>
        <p className="muted">Demo: ada@student.demo-university.edu (verified) · pending@student.demo-university.edu (unverified)</p>
      </div>
    );
  }

  const urgent = notes.filter((n) => n.title.startsWith("URGENT"));
  return (
    <div>
      <div className="card" style={{ borderLeft: "6px solid #C9A227" }}>
        <span className="badge b-ed">Today&apos;s Word · same for every student</span>
        <h2>{word ? `“${word.title}” — ${word.verse}` : "Loading today's Word…"}</h2>
        {word && <p>{word.body}</p>}
      </div>
      <div className="card">
        <span className="badge b-ed">Academic reflection (not devotional)</span>
        <p className="muted">Study theme: consistency — small daily progress beats cramming. Track yours in My Courses below.</p>
      </div>
      {!!urgent.length && (
        <div className="card" style={{ borderColor: "#D92D20" }}>
          <h3>Academic priorities</h3>
          {urgent.map((n) => <p key={n.id}><span className="badge b-urg">Urgent</span>{n.title}</p>)}
        </div>
      )}
      {cont?.materialId && (
        <div className="card">
          <h3>Continue studying</h3>
          <p><a href={`/materials/${cont.materialId}`}>{cont.material?.title ?? cont.materialId}</a> · page {cont.page ?? 1}</p>
        </div>
      )}
      <div className="card">
        <h3>My Courses</h3>
        {enroll.filter((e) => e.status === "approved").map((e) => {
          const p = progress.find((x) => x.courseId === e.courseId);
          return (
            <div key={e.courseId} style={{ marginBottom: 10 }}>
              <a href={`/courses/${e.courseId}`}>{e.course.code} — {e.course.title}</a>
              <div className="progress"><div style={{ width: `${p?.percent ?? 0}%` }} /></div>
              <span className="muted">{p?.percent ?? 0}% complete</span>
            </div>
          );
        })}
        {!enroll.length && <p className="muted">No enrollments yet — <a href="/courses">browse courses</a>.</p>}
      </div>
      <div className="card">
        <h3>Lecturer updates</h3>
        {notes.slice(0, 5).map((n) => <p key={n.id}>· {n.title}</p>)}
        {!notes.length && <p className="muted">No updates yet.</p>}
      </div>
      <div className="card">
        <h3>Academic points & AI</h3>
        <p>★ Balance: <strong>{points?.balance ?? "…"}</strong> points <span className="muted">(earn: pass assessments, lecturer recognition · redeem ≥5000 for purchases)</span></p>
        <p className="muted">AI Study Assistant arrives with course grounding in Phase 3. Library: <a href="/library">open</a>.</p>
      </div>
    </div>
  );
}
