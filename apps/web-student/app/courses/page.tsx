"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, EmptyState, ErrorState, LoadingState, SuccessNote } from "@edufarm/ui";

type Course = { id: string; code: string; title: string; isOfficial: boolean };

export default function Courses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [failed, setFailed] = useState("");
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  async function load() {
    setFailed("");
    try {
      // my own chain first — courses I can actually join
      const me = await api("/verifications/me").catch(() => null);
      const deptId = me?.student?.departmentId as string | undefined;
      if (deptId) {
        setCourses(await api(`/departments/${deptId}/courses`));
        return;
      }
      // logged-out browse: first institution chain
      const unis = await api("/universities");
      if (!unis[0]) return setCourses([]);
      const facs = await api(`/universities/${unis[0].id}/faculties`);
      if (!facs[0]) return setCourses([]);
      const deps = await api(`/faculties/${facs[0].id}/departments`);
      if (!deps[0]) return setCourses([]);
      setCourses(await api(`/departments/${deps[0].id}/courses`));
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load courses.");
    }
  }
  useEffect(() => { load(); }, []);
  async function enroll(id: string, code: string) {
    setDone("");
    setErr("");
    try {
      await api(`/courses/${id}/enroll`, { method: "POST", body: JSON.stringify({}) });
      setDone(`Enrollment requested for ${code} — your lecturer will approve. It is not automatic.`);
    } catch (e) { setErr((e as Error).message); }
  }
  if (courses === null && !failed) return <LoadingState label="Loading courses…" />;
  if (failed && courses === null) return <ErrorState message={failed} onRetry={load} />;
  return (
    <div>
      <h2>Courses</h2>
      {done && <div style={{ marginBottom: 12 }}><SuccessNote>{done}</SuccessNote></div>}
      {err && <div style={{ marginBottom: 12 }}><Alert kind="error">{err}</Alert></div>}
      {(courses ?? []).map((c) => (
        <div className="card" key={c.id}>
          <a href={`/courses/${c.id}`}><strong>{c.code} — {c.title}</strong></a>{" "}
          {c.isOfficial && <span className="badge b-off">Official Course</span>}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="sec" onClick={() => enroll(c.id, c.code)}>Request enrollment</button>
            <a className="btn sec" href={`/courses/${c.id}`}>Open course</a>
          </div>
        </div>
      ))}
      {!courses?.length && (
        <EmptyState
          icon="book"
          title="No courses found"
          body="Log in with your verified student account — courses appear once your institution publishes them."
          action={<a className="btn sec" href="/verify">Check verification</a>}
        />
      )}
    </div>
  );
}
