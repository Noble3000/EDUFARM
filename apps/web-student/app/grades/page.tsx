"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Course = { id: string; code: string; title: string | null; units: number; grade: string };
type Sem = { id: string; name: string; courses: Course[]; gpa: number | null; units: number };

function Class({ gpa }: { gpa: number | null }) {
  if (gpa == null) return <span className="badge b-ed">—</span>;
  const c = gpa >= 4.5 ? "First Class" : gpa >= 3.5 ? "Second Class Upper" : gpa >= 2.4 ? "Second Class Lower" : gpa >= 1.5 ? "Third Class" : "Pass/Fail zone";
  return <span className="badge b-off">{c}</span>;
}

export default function Grades() {
  const [data, setData] = useState<{ semesters: Sem[]; cgpa: { gpa: number | null; units: number } } | null>(null);
  const [semName, setSemName] = useState("");
  const [forms, setForms] = useState<Record<string, { code: string; units: string; grade: string }>>({});
  const [msg, setMsg] = useState("");
  async function load() {
    setData(await api("/grades/me").catch(() => null));
  }
  useEffect(() => { load(); }, []);
  async function addSem() {
    try {
      await api("/grades/semesters", { method: "POST", body: JSON.stringify({ name: semName }) });
      setSemName(""); load();
    } catch (e) { setMsg((e as Error).message); }
  }
  async function addCourse(semId: string) {
    const f = forms[semId] ?? { code: "", units: "", grade: "A" };
    try {
      await api(`/grades/semesters/${semId}/courses`, {
        method: "POST",
        body: JSON.stringify({ code: f.code, units: Number(f.units), grade: f.grade }),
      });
      setForms({ ...forms, [semId]: { code: "", units: "", grade: "A" } }); load();
    } catch (e) { setMsg((e as Error).message); }
  }
  const set = (semId: string, k: "code" | "units" | "grade", v: string) => {
    const prev = forms[semId] ?? { code: "", units: "", grade: "A" };
    setForms({ ...forms, [semId]: { ...prev, [k]: v } });
  };

  return (
    <div>
      <div className="card" style={{ borderLeft: "6px solid #C9A227" }}>
        <h2>CGPA Calculator <span className="badge b-ed">5-point scale</span></h2>
        <p style={{ fontSize: 28, fontWeight: 800, margin: "4px 0" }}>
          {data?.cgpa.gpa ?? "—"} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>CGPA · {data?.cgpa.units ?? 0} units</span>
        </p>
        <Class gpa={data?.cgpa.gpa ?? null} />
        <p className="muted">GPA = Σ(grade point × units) ÷ Σunits · A=5 B=4 C=3 D=2 E=1 F=0. Private to you — lecturers never see this.</p>
      </div>
      <div className="card">
        <h3>Add semester</h3>
        <div className="row">
          <input style={{ maxWidth: 280 }} placeholder="e.g. Year 2 Semester 1" value={semName} onChange={(e) => setSemName(e.target.value)} />
          <button onClick={addSem}>Add</button>
        </div>
        <p>{msg}</p>
      </div>
      {data?.semesters.map((s) => (
        <div className="card" key={s.id}>
          <h3>{s.name} — GPA {s.gpa ?? "—"} <span className="muted">({s.units} units)</span> <Class gpa={s.gpa} /></h3>
          <table style={{ width: "100%", fontSize: 14 }}>
            <tbody>
              {s.courses.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                  <td><strong>{c.code}</strong> {c.title && <span className="muted">{c.title}</span>}</td>
                  <td>{c.units}u</td><td>{c.grade}</td>
                  <td><button className="sec" onClick={async () => { await api(`/grades/courses/${c.id}`, { method: "DELETE" }); load(); }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 8 }}>
            <input style={{ maxWidth: 110 }} placeholder="BIO 201" value={forms[s.id]?.code ?? ""} onChange={(e) => set(s.id, "code", e.target.value)} />
            <input style={{ maxWidth: 70 }} placeholder="units" type="number" value={forms[s.id]?.units ?? ""} onChange={(e) => set(s.id, "units", e.target.value)} />
            <select style={{ maxWidth: 90 }} value={forms[s.id]?.grade ?? "A"} onChange={(e) => set(s.id, "grade", e.target.value)}>
              {["A", "B", "C", "D", "E", "F"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <button className="sec" onClick={() => addCourse(s.id)}>Add course</button>
            <button className="sec" onClick={async () => { await api(`/grades/semesters/${s.id}`, { method: "DELETE" }); load(); }}>Delete semester</button>
          </div>
        </div>
      ))}
      {!data && <p>Loading… (log in first)</p>}
    </div>
  );
}
