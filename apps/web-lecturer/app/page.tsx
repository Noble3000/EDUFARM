"use client";
import { useEffect, useState } from "react";
import { api, getUser } from "@/lib/api";

export default function Dashboard() {
  const [courses, setCourses] = useState<{ id: string; code: string; title: string }[]>([]);
  const [earn, setEarn] = useState<{ pendingKobo: number } | null>(null);
  useEffect(() => {
    if (!getUser()) return;
    api("/universities").then(async (unis) => {
      const facs = await api(`/universities/${unis[0].id}/faculties`);
      const deps = await api(`/faculties/${facs[0].id}/departments`);
      setCourses(await api(`/departments/${deps[0].id}/courses`));
    }).catch(() => {});
    api("/earnings/me").then(setEarn).catch(() => {});
  }, []);
  return (
    <div>
      <h2>Lecturer dashboard</h2>
      <div className="card"><h3>Earnings (pending eSpees)</h3>
        <p>₦{earn ? (earn.pendingKobo / 100).toFixed(2) : "…"} <span className="muted">· settlement in Phase 2</span></p>
      </div>
      <div className="card"><h3>My courses</h3>
        {courses.map((c) => <p key={c.id}><a href={`/courses/${c.id}`}>{c.code} — {c.title}</a></p>)}
        {!courses.length && <p className="muted">Log in as lecturer first.</p>}
      </div>
    </div>
  );
}
