"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Courses() {
  const [courses, setCourses] = useState<{ id: string; code: string; title: string; isOfficial: boolean }[]>([]);
  useEffect(() => {
    api("/universities").then(async (unis) => {
      if (!unis[0]) return;
      const facs = await api(`/universities/${unis[0].id}/faculties`);
      if (!facs[0]) return;
      const deps = await api(`/faculties/${facs[0].id}/departments`);
      if (!deps[0]) return;
      setCourses(await api(`/departments/${deps[0].id}/courses`));
    }).catch(() => {});
  }, []);
  async function enroll(id: string) {
    try { await api(`/courses/${id}/enroll`, { method: "POST", body: JSON.stringify({}) }); alert("Enrollment requested — lecturer will approve."); }
    catch (e) { alert((e as Error).message); }
  }
  return (
    <div>
      <h2>Courses</h2>
      {courses.map((c) => (
        <div className="card" key={c.id}>
          <a href={`/courses/${c.id}`}><strong>{c.code} — {c.title}</strong></a>{" "}
          {c.isOfficial && <span className="badge b-off">Official Course</span>}
          <div className="row" style={{ marginTop: 8 }}><button className="sec" onClick={() => enroll(c.id)}>Request enrollment</button></div>
        </div>
      ))}
      {!courses.length && <p className="muted">Loading… (log in first)</p>}
    </div>
  );
}
