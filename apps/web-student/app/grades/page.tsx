"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Alert, Confirm, DataTable, EmptyState, ErrorState, LoadingState, SuccessNote, Icon } from "@edufarm/ui";

type Course = { id: string; code: string; title: string | null; units: number; grade: string };
type Sem = { id: string; name: string; courses: Course[]; gpa: number | null; units: number };

function Class({ gpa }: { gpa: number | null }) {
  if (gpa == null) return <span className="badge b-ed">—</span>;
  const c = gpa >= 4.5 ? "First Class" : gpa >= 3.5 ? "Second Class Upper" : gpa >= 2.4 ? "Second Class Lower" : gpa >= 1.5 ? "Third Class" : "Pass/Fail zone";
  return <span className="badge b-off">{c}</span>;
}

export default function Grades() {
  const [data, setData] = useState<{ semesters: Sem[]; cgpa: { gpa: number | null; units: number; class?: string } } | null>(null);
  const [failed, setFailed] = useState("");
  const [semName, setSemName] = useState("");
  const [forms, setForms] = useState<Record<string, { code: string; title: string; units: string; grade: string }>>({});
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState("");
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, { code: string; title: string; units: string; grade: string }>>({});
  const [confirmSem, setConfirmSem] = useState<{ id: string; name: string } | null>(null);
  async function load() {
    setFailed("");
    try {
      setData(await api("/grades/me"));
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load your grades.");
    }
  }
  useEffect(() => { load(); }, []);
  function note(p: Promise<unknown>, done: string) {
    setMsg(""); setOk("");
    return p.then(() => { setOk(done); load(); }).catch((e) => setMsg((e as Error).message));
  }
  async function addSem() {
    await note(api("/grades/semesters", { method: "POST", body: JSON.stringify({ name: semName }) }), "Semester added.");
    setSemName("");
  }
  async function renameSem(semId: string) {
    const name = (renaming[semId] ?? "").trim();
    if (!name) { setMsg("Semester name required."); return; }
    await note(
      api(`/grades/semesters/${semId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
      "Semester renamed."
    );
    setRenaming({ ...renaming, [semId]: "" });
  }
  async function addCourse(semId: string) {
    const f = forms[semId] ?? { code: "", title: "", units: "", grade: "A" };
    await note(api(`/grades/semesters/${semId}/courses`, {
      method: "POST",
      body: JSON.stringify({ code: f.code, title: f.title || undefined, units: Number(f.units), grade: f.grade }),
    }), "Course added.");
    setForms({ ...forms, [semId]: { code: "", title: "", units: "", grade: "A" } });
  }
  async function saveCourse(semId: string, courseId: string) {
    const f = editing[courseId];
    if (!f) return;
    await note(api(`/grades/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify({ code: f.code, title: f.title || null, units: Number(f.units), grade: f.grade }),
    }), "Course updated.");
    const next = { ...editing };
    delete next[courseId];
    setEditing(next);
  }
  const set = (semId: string, k: "code" | "units" | "grade", v: string) => {
    const prev = forms[semId] ?? { code: "", title: "", units: "", grade: "A" };
    setForms({ ...forms, [semId]: { ...prev, [k]: v } });
  };
  const setEdit = (courseId: string, k: "code" | "title" | "units" | "grade", v: string) => {
    const prev = editing[courseId];
    if (!prev) return;
    setEditing({ ...editing, [courseId]: { ...prev, [k]: v } });
  };

  return (
    <div>
      <div className="card" style={{ borderLeft: "6px solid #C9A227" }}>
        <h2>CGPA Calculator <span className="badge b-ed">5-point scale</span></h2>
        <p style={{ fontSize: 28, fontWeight: 800, margin: "4px 0" }}>
          {data?.cgpa.gpa ?? "—"} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>CGPA · {data?.cgpa.units ?? 0} units</span>
        </p>
        <Class gpa={data?.cgpa.gpa ?? null} />
        <p className="muted">GPA = Σ(grade point × units) ÷ Σunits · A=5 B=4 C=3 D=2 E=1 F=0. Repeats across semesters all count. Private to you — lecturers never see this.</p>
      </div>
      {msg && <div style={{ marginBottom: 12 }}><Alert kind="error">{msg}</Alert></div>}
      {ok && <div style={{ marginBottom: 12 }}><SuccessNote>{ok}</SuccessNote></div>}
      <div className="card">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="plus" size={15} /> Add semester</h3>
        <label className="flabel" htmlFor="sem-name">Semester name</label>
        <div className="row">
          <input id="sem-name" style={{ maxWidth: 280 }} placeholder="e.g. Year 2 Semester 1" value={semName} onChange={(e) => setSemName(e.target.value)} />
          <button onClick={addSem}>Add</button>
        </div>
      </div>
      {data?.semesters.map((s) => (
        <div className="card" key={s.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{s.name} — GPA {s.gpa ?? "—"} <span className="muted">({s.units} units)</span> <Class gpa={s.gpa} /></h3>
            <button className="sec" onClick={() => setRenaming({ ...renaming, [s.id]: renaming[s.id] ?? s.name })}>Rename</button>
          </div>
          {renaming[s.id] !== undefined && (
            <div className="row" style={{ marginTop: 8 }}>
              <input style={{ maxWidth: 280 }} aria-label={`New name for ${s.name}`} value={renaming[s.id]} onChange={(e) => setRenaming({ ...renaming, [s.id]: e.target.value })} />
              <button onClick={() => renameSem(s.id)}>Save name</button>
            </div>
          )}
          {s.courses.length > 0 ? (
            <DataTable caption={`${s.name} courses`} head={["Course", "Units", "Grade", ""]}>
              {s.courses.map((c) => {
                const ef = editing[c.id];
                return (
                  <tr key={c.id}>
                    <td>
                      {ef ? (
                        <div className="row tight">
                          <input style={{ maxWidth: 110 }} aria-label="Course code" value={ef.code} onChange={(e) => setEdit(c.id, "code", e.target.value)} />
                          <input style={{ maxWidth: 150 }} aria-label="Course title" placeholder="Title (optional)" value={ef.title} onChange={(e) => setEdit(c.id, "title", e.target.value)} />
                        </div>
                      ) : (
                        <><strong>{c.code}</strong> {c.title && <span className="muted">{c.title}</span>}</>
                      )}
                    </td>
                    <td>{ef ? <input style={{ maxWidth: 70 }} aria-label="Credit units" type="number" min={1} max={12} value={ef.units} onChange={(e) => setEdit(c.id, "units", e.target.value)} /> : <>{c.units}u</>}</td>
                    <td>{ef ? (
                      <select aria-label="Grade" value={ef.grade} onChange={(e) => setEdit(c.id, "grade", e.target.value)}>
                        {["A", "B", "C", "D", "E", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) : c.grade}</td>
                    <td>
                      <div className="row tight">
                        {ef ? (
                          <><button onClick={() => saveCourse(s.id, c.id)}>Save</button>
                          <button className="sec" onClick={() => { const n = { ...editing }; delete n[c.id]; setEditing(n); }}>Cancel</button></>
                        ) : (
                          <><button className="sec" aria-label={`Edit ${c.code}`} onClick={() => setEditing({ ...editing, [c.id]: { code: c.code, title: c.title ?? "", units: String(c.units), grade: c.grade } })}>Edit</button>
                          <button className="sec" aria-label={`Remove ${c.code}`} onClick={async () => { await note(api(`/grades/courses/${c.id}`, { method: "DELETE" }), `${c.code} removed.`); }}><Icon name="x" size={13} /></button></>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          ) : (
            <EmptyState icon="book" title="No courses yet" body="Add your first course for this semester below." />
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <div style={{ flex: "1 1 110px" }}><label className="flabel" htmlFor={`code-${s.id}`}>Code</label><input id={`code-${s.id}`} style={{ maxWidth: 130 }} placeholder="BIO 201" value={forms[s.id]?.code ?? ""} onChange={(e) => set(s.id, "code", e.target.value)} /></div>
            <div style={{ flex: "1 1 130px" }}><label className="flabel" htmlFor={`title-${s.id}`}>Title <span className="muted">(optional)</span></label><input id={`title-${s.id}`} style={{ maxWidth: 150 }} placeholder="Cell Biology" value={forms[s.id]?.title ?? ""} onChange={(e) => setForms({ ...forms, [s.id]: { code: forms[s.id]?.code ?? "", title: e.target.value, units: forms[s.id]?.units ?? "", grade: forms[s.id]?.grade ?? "A" } })} /></div>
            <div style={{ flex: "0 1 80px" }}><label className="flabel" htmlFor={`units-${s.id}`}>Units</label><input id={`units-${s.id}`} style={{ maxWidth: 80 }} placeholder="3" type="number" min={1} max={12} value={forms[s.id]?.units ?? ""} onChange={(e) => set(s.id, "units", e.target.value)} /></div>
            <div style={{ flex: "0 1 90px" }}><label className="flabel" htmlFor={`grade-${s.id}`}>Grade</label><select id={`grade-${s.id}`} style={{ maxWidth: 90 }} value={forms[s.id]?.grade ?? "A"} onChange={(e) => set(s.id, "grade", e.target.value)}>
              {["A", "B", "C", "D", "E", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select></div>
            <button className="sec" onClick={() => addCourse(s.id)}>Add course</button>
            <button className="sec" onClick={() => setConfirmSem({ id: s.id, name: s.name })}>Delete semester</button>
          </div>
        </div>
      ))}
      {!data && !failed && <LoadingState label="Loading your grades…" />}
      {failed && !data && <ErrorState message={failed} onRetry={load} />}
      {data && !data.semesters.length && (
        <EmptyState
          icon="chart"
          title="No semesters yet"
          body="Add your first semester above to start tracking your CGPA. Repeats across semesters all count; every record stays private to you."
        />
      )}
      {confirmSem && (
        <Confirm
          title={`Delete ${confirmSem.name}?`}
          body="All courses in this semester are removed too. This cannot be undone."
          confirmLabel="Delete semester"
          onCancel={() => setConfirmSem(null)}
          onConfirm={async () => {
            const id = confirmSem.id;
            setConfirmSem(null);
            await note(api(`/grades/semesters/${id}`, { method: "DELETE" }), "Semester deleted.");
          }}
        />
      )}
    </div>
  );
}
