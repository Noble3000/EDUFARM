"use client";
import { useEffect, useState } from "react";
import { DataTable, EmptyState, Icon, LoadingState } from "@edufarm/ui";
import { api, getUser } from "@/lib/api";

export default function Dashboard() {
  const [courses, setCourses] = useState<{ id: string; code: string; title: string }[] | null>(null);
  const [earn, setEarn] = useState<{ pendingKobo: number } | null>(null);
  useEffect(() => {
    if (!getUser()) {
      setCourses([]);
      return;
    }
    api("/universities").then(async (unis) => {
      const facs = await api(`/universities/${unis[0].id}/faculties`);
      const deps = await api(`/faculties/${facs[0].id}/departments`);
      setCourses(await api(`/departments/${deps[0].id}/courses`));
    }).catch(() => setCourses([]));
    api("/earnings/me").then(setEarn).catch(() => {});
  }, []);
  return (
    <div>
      <section className="hero-pro" aria-label="Lecturer overview">
        <span className="badge b-ed" style={{ background: "rgba(255,255,255,.14)", color: "#fff", borderColor: "rgba(255,255,255,.3)" }}>
          <Icon name="dashboard" size={13} /> Lecturer console
        </span>
        <h2 style={{ marginTop: 10 }}>Lecturer dashboard</h2>
        <p>Courses, materials, assessments and earnings in one professional console.</p>
      </section>
      <div className="card"><h3><Icon name="earnings" size={15} /> Earnings (pending eSpees)</h3>
        <p>₦{earn ? (earn.pendingKobo / 100).toFixed(2) : "…"} <span className="muted">· settlement in Phase 2</span></p>
      </div>
      <div className="card"><h3><Icon name="book" size={15} /> My courses</h3>
        {courses === null && <LoadingState label="Loading courses…" />}
        {courses !== null && courses.length === 0 && (
          <EmptyState
            icon="book"
            title="No courses yet"
            body="Log in as lecturer first, or wait for your department to assign courses."
            action={<a className="btn sec" href="/login">Sign in</a>}
          />
        )}
        {courses !== null && courses.length > 0 && (
          <DataTable caption="Courses assigned to you" head={["Code", "Title", "Open"]}>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.title}</td>
                <td><a href={`/courses/${c.id}`} aria-label={`Manage ${c.code}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}>Manage <Icon name="arrowR" size={14} /></a></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
