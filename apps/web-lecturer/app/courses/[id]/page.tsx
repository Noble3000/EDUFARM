"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Crumb, DataTable, EmptyState, Field, LoadingState, SuccessNote } from "@edufarm/ui";
import { api } from "@/lib/api";
import { AnnouncementsManager, QAConsole } from "./qa-console";

type Enr = { id: string; status: string; student: { id?: string; user: { name: string; email: string } } };

function statusKind(s: string): string {
  const v = s.toLowerCase();
  if (v === "approved" || v === "published" || v === "official") return "ok";
  if (v === "rejected" || v === "urgent") return "bad";
  if (v === "pending") return "warn";
  return "edition";
}

export default function ManageCourse({ params }: { params: { id: string } }) {
  const [enrs, setEnrs] = useState<Enr[]>([]);
  const [enrLoading, setEnrLoading] = useState(true);
  const [ann, setAnn] = useState({ category: "course-notice", title: "", body: "", isUrgent: false });
  const [mat, setMat] = useState({ title: "", type: "lecture-notes", isFree: true, priceKobo: 50000, accessDurationDays: 90 });
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [asmts, setAsmts] = useState<{ id: string; title: string; status: string }[]>([]);
  const [asmtLoading, setAsmtLoading] = useState(true);
  const [atitle, setAtitle] = useState("");
  const [grade, setGrade] = useState<{ attempts: { id: string; status: string; score: number | null }[] } | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [gradeId, setGradeId] = useState("");
  async function loadAttempts(id: string) {
    setAttemptsLoading(true);
    try {
      setGrade(await api(`/assessments/${id}/attempts`).catch(() => null));
    } finally {
      setAttemptsLoading(false);
    }
  }
  async function refresh() {
    setEnrLoading(true);
    try {
      setEnrs(await api(`/courses/${params.id}/enrollments`).catch(() => []));
    } finally {
      setEnrLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    setAsmtLoading(true);
    api(`/courses/${params.id}/assessments/lecturer`).then(setAsmts).catch(() => []).finally(() => setAsmtLoading(false));
  }, [params.id]);
  async function decide(id: string, decision: string) {
    setOk("");
    setErr("");
    try {
      await api(`/enrollments/${id}/decide`, { method: "POST", body: JSON.stringify({ decision }) });
      setOk(`Enrollment ${decision}d.`);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function postAnn() {
    setOk("");
    setErr("");
    try {
      await api(`/courses/${params.id}/announcements`, { method: "POST", body: JSON.stringify(ann) });
      setAnn({ ...ann, title: "", body: "" });
      setOk("Announcement posted.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  async function upload(submit: boolean) {
    setOk("");
    setErr("");
    try {
      const created = await api(`/courses/${params.id}/materials`, {
        method: "POST",
        body: JSON.stringify({ ...mat, priceKobo: Number(mat.priceKobo), accessDurationDays: Number(mat.accessDurationDays), fileKey: "dev/mock.pdf", checksum: "dev" }),
      });
      if (submit) {
        await api(`/materials/${created.id}/approve`, { method: "POST", body: JSON.stringify({ attest: attestOwn }) });
      }
      setOk(submit ? "Ownership approved — sent to platform review." : "Uploaded — approve ownership to send for review.");
      loadMyMaterials();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  const [attestOwn, setAttestOwn] = useState(false);
  const [mine, setMine] = useState<{ id: string; title: string; status: string; version: number; pendingVersion: number | null; course: { code: string } }[]>([]);
  async function loadMyMaterials() {
    setMine(await api("/lecturer/materials").catch(() => []));
  }
  useEffect(() => { loadMyMaterials(); }, []);
  return (
    <div>
      <Crumb trail={[{ href: '/', label: 'Dashboard' }, { label: 'Manage course' }]} />
      <h2>Manage course</h2>
      {ok && <SuccessNote>{ok}</SuccessNote>}
      {err && <Alert kind="error">{err}</Alert>}
      <div className="card"><h3>Enrollments</h3>
        {enrLoading && <LoadingState label="Loading enrollments…" />}
        {!enrLoading && enrs.length === 0 && (
          <EmptyState
            icon="user"
            title="No enrollment requests"
            body="No enrollments yet, or you are not logged in as lecturer."
            action={<a className="btn sec" href="/">Back to dashboard</a>}
          />
        )}
        {!enrLoading && enrs.length > 0 && (
          <DataTable caption="Student enrollment requests" head={["Student", "Email", "Status", "Actions"]}>
            {enrs.map((e) => (
              <tr key={e.id}>
                <td>{e.student.user.name}</td>
                <td>{e.student.user.email}</td>
                <td><Badge kind={statusKind(e.status)}>{e.status}</Badge></td>
                <td>
                  <div className="row tight">
                    <button className="sec" onClick={() => decide(e.id, "approve")} aria-label={`Approve ${e.student.user.name}`}>Approve</button>
                    <button className="sec" onClick={() => decide(e.id, "reject")} aria-label={`Reject ${e.student.user.name}`}>Reject</button>
                    <button className="sec" onClick={() => decide(e.id, "suspend")} aria-label={`Suspend ${e.student.user.name}`}>Suspend</button>
                    <button className="sec" onClick={() => decide(e.id, "reinstate")} aria-label={`Reinstate ${e.student.user.name}`}>Reinstate</button>
                    <button className="sec" onClick={() => decide(e.id, "remove")} aria-label={`Remove ${e.student.user.name}`}>Remove</button>
                    <button className="sec" onClick={async () => {
                      setOk("");
                      setErr("");
                      try {
                        await api("/points/recognize", { method: "POST", body: JSON.stringify({ studentId: (e.student as unknown as { id: string }).id, reason: "participation" }) });
                        setOk("Recognition +5 points awarded.");
                      } catch (err) { setErr((err as Error).message); }
                    }}>Recognize +5</button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
      <div className="card"><h3>New announcement</h3>
        <Field label="Category">
          <select value={ann.category} onChange={(e) => setAnn({ ...ann, category: e.target.value })}>
            {["new-material", "assignment", "test", "course-notice", "general", "urgent-update"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
        </Field>
        <Field label="Body">
          <textarea value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
        </Field>
        <label className="checkrow"><input type="checkbox" checked={ann.isUrgent} onChange={(e) => setAnn({ ...ann, isUrgent: e.target.checked })} /> Urgent</label>
        <div><button onClick={postAnn}>Post</button></div>
      </div>
      <AnnouncementsManager courseId={params.id} />
      <QAConsole courseId={params.id} />
      <div className="card"><h3>Upload material</h3>
        <Field label="Title">
          <input value={mat.title} onChange={(e) => setMat({ ...mat, title: e.target.value })} />
        </Field>
        <Field label="Type">
          <select value={mat.type} onChange={(e) => setMat({ ...mat, type: e.target.value })}>
            {["lecture-notes", "course-pack", "revision-guide", "practice-questions", "exam-prep", "study-guide"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <label className="checkrow"><input type="checkbox" checked={mat.isFree} onChange={(e) => setMat({ ...mat, isFree: e.target.checked })} /> Free</label>
        {!mat.isFree && (
          <Field label="Price (kobo)" hint="50000 kobo = ₦500.">
            <input type="number" min={0} value={mat.priceKobo} onChange={(e) => setMat({ ...mat, priceKobo: Number(e.target.value) })} />
          </Field>
        )}
        <label className="checkrow"><input type="checkbox" checked={attestOwn} onChange={(e) => setAttestOwn(e.target.checked)} /> I confirm I own and authorize this material</label>
        <div className="row">
          <button className="sec" onClick={() => upload(false)}>Upload (awaiting my approval)</button>
          <button onClick={() => upload(true)}>Approve & send for review</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>Lifecycle: upload → your ownership approval → platform review → published. New editions re-enter review; live editions are never silently replaced.</p>
      </div>
      <div className="card"><h3>My materials</h3>
        {mine.map((m) => (
          <div key={m.id} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid #eee", paddingTop: 8 }}>
            <span><strong>{m.title}</strong> <span className="muted">[{m.course.code}]</span> <Badge kind={m.status === "published" ? "ok" : "edition"}>{m.status} v{m.version}{m.pendingVersion != null ? ` → v${m.pendingVersion} in review` : ""}</Badge></span>
            <span className="row tight">
              {(m.status === "draft" || m.status === "pendingLecturer") && (
                <button className="sec" onClick={async () => {
                  await api(`/materials/${m.id}/approve`, { method: "POST", body: JSON.stringify({ attest: true }) });
                  setOk("Approved — sent to platform review."); loadMyMaterials();
                }}>Approve</button>
              )}
              {m.status === "published" && (
                <button className="sec" onClick={async () => {
                  await api(`/materials/${m.id}/new-version`, { method: "POST", body: JSON.stringify({ fileKey: "dev/mock.pdf", checksum: "dev" }) });
                  setOk("New edition staged — sent back to platform review. Live edition unchanged."); loadMyMaterials();
                }}>New edition</button>
              )}
            </span>
          </div>
        ))}
        {!mine.length && <p className="muted">Nothing uploaded yet.</p>}
      </div>
      <div className="card"><h3>Assessments</h3>
        <Field label="New assessment title" htmlFor="asmt-title" hint="Creates a quiz draft. Add questions below, then publish.">
          <input id="asmt-title" placeholder="e.g. Week 3 quiz" value={atitle} onChange={(e) => setAtitle(e.target.value)} />
        </Field>
        <div className="row">
          <button onClick={async () => {
            setOk("");
            setErr("");
            try {
              const a = await api(`/courses/${params.id}/assessments`, { method: "POST", body: JSON.stringify({ title: atitle, type: "quiz" }) });
              setAtitle("");
              setGradeId(a.id);
              setOk(`Created ${a.title} — add questions below, then publish.`);
              setAsmts([...asmts, a]);
            } catch (e) {
              setErr((e as Error).message);
            }
          }}>Create draft</button>
          <button className="sec" onClick={async () => {
            setAsmtLoading(true);
            try {
              setAsmts(await api(`/courses/${params.id}/assessments/lecturer`).catch(() => []));
            } finally {
              setAsmtLoading(false);
            }
          }}>Refresh list</button>
        </div>
        {asmtLoading && <div style={{ marginTop: 12 }}><LoadingState label="Loading assessments…" lines={2} /></div>}
        {!asmtLoading && asmts.length === 0 && (
          <div style={{ marginTop: 12 }}>
            <EmptyState
              icon="quiz"
              title="No assessments yet"
              body="Create your first quiz draft above to get started."
              action={<button className="sec" onClick={() => document.getElementById("asmt-title")?.focus()}>Start above</button>}
            />
          </div>
        )}
        {!asmtLoading && asmts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <DataTable caption="Course assessments" head={["Title", "Status", "Actions"]}>
              {asmts.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td><Badge kind={statusKind(a.status)}>{a.status}</Badge></td>
                  <td>
                    <div className="row tight">
                      <button className="sec" onClick={() => setGradeId(a.id)} aria-label={`Open ${a.title}`}>Open</button>
                      <button onClick={async () => {
                        setOk("");
                        setErr("");
                        try {
                          await api(`/assessments/${a.id}/publish`, { method: "POST", body: JSON.stringify({}) });
                          setOk(`Published ${a.title} — students notified.`);
                        } catch (e) {
                          setErr((e as Error).message);
                        }
                      }} aria-label={`Publish ${a.title}`}>Publish</button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
        {gradeId && <div style={{ marginTop: 12 }}>
          <h4>Add MCQ question</h4>
          <p className="muted">Assessment {gradeId.slice(0, 8)}… — questions save immediately to the draft.</p>
          <QuestionForm assessmentId={gradeId} onDone={(m) => { setOk(m); setErr(""); }} onError={(m) => { setErr(m); setOk(""); }} />
          <h4 style={{ marginTop: 12 }}>Attempts</h4>
          <button className="sec" onClick={() => loadAttempts(gradeId)}>Load attempts</button>
          {attemptsLoading && <div style={{ marginTop: 8 }}><LoadingState label="Loading attempts…" lines={2} /></div>}
          {!attemptsLoading && grade && grade.attempts.length === 0 && (
            <div style={{ marginTop: 8 }}>
              <EmptyState
                icon="search"
                title="No attempts yet"
                body="Students have not attempted this assessment."
                action={<button className="sec" onClick={() => loadAttempts(gradeId)}>Reload attempts</button>}
              />
            </div>
          )}
          {!attemptsLoading && grade && grade.attempts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <DataTable caption="Student attempts" head={["Attempt", "Status", "Score"]}>
                {grade.attempts.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id.slice(0, 8)}</td>
                    <td><Badge kind={statusKind(t.status)}>{t.status}</Badge></td>
                    <td>{t.score != null ? String(t.score) : "—"}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
        </div>}
      </div>
      <Insights courseId={params.id} />
    </div>
  );
}

function Insights({ courseId }: { courseId: string }) {
  const [ins, setIns] = useState<{
    assessmentStats: { id: string; title: string; attempts: number; avgScore: number | null; maxScore: number }[];
    unanswered: { id: string; title: string }[];
    weakCompletion: { materialId: string; title: string; readers: number }[];
    enrolled: number; suggestions: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="card">
      <h3>AI insights</h3>
      <p className="muted">Enrollment, assessment performance and reading completion at a glance.</p>
      <button className="sec" disabled={loading} onClick={async () => {
        setLoading(true);
        setErr("");
        try {
          setIns(await api(`/courses/${courseId}/insights`).catch(() => null));
        } finally {
          setLoading(false);
        }
      }}>{loading ? "Generating…" : "Generate insights"}</button>
      {loading && <div style={{ marginTop: 12 }}><LoadingState label="Generating insights…" lines={2} /></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      {ins && !loading && (
        <div style={{ marginTop: 12 }}>
          <p className="muted">Enrolled: {ins.enrolled}</p>
          {ins.assessmentStats.length > 0 ? (
            <DataTable caption="Assessment performance" head={["Assessment", "Attempts", "Average"]}>
              {ins.assessmentStats.map((a) => (
                <tr key={a.id}>
                  <td>{a.title}</td>
                  <td>{a.attempts}</td>
                  <td>{a.avgScore != null ? `${a.avgScore}/${a.maxScore}` : "—"}</td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyState
              icon="clipboard"
              title="No assessment data"
              body="Publish an assessment to see performance here."
              action={<button className="sec" onClick={() => document.getElementById("asmt-title")?.focus()}>Create assessment</button>}
            />
          )}
          {!!ins.unanswered.length && (
            <div style={{ marginTop: 12 }}>
              <Alert kind="info" title={`Unanswered (${ins.unanswered.length})`}>
                {ins.unanswered.map((u) => u.title).join("; ")}
              </Alert>
            </div>
          )}
          {!!ins.weakCompletion.length && (
            <div style={{ marginTop: 12 }}>
              <Alert kind="warn" title="Weak completion">
                {ins.weakCompletion.map((w) => `${w.title} (${w.readers} readers)`).join("; ")}
              </Alert>
            </div>
          )}
          {ins.suggestions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Alert kind="info" icon="bulb" title="Suggestions">
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {ins.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </Alert>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionForm({ assessmentId, onDone, onError }: { assessmentId: string; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState("A,B,C,D");
  const [correctIndex, setCorrectIndex] = useState(0);
  return (
    <div>
      <Field label="Question text">
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Field label="Options" hint="Comma-separated, e.g. A,B,C,D.">
        <input value={options} onChange={(e) => setOptions(e.target.value)} />
      </Field>
      <Field label="Correct option index" hint="0 = first option.">
        <input type="number" min={0} value={correctIndex} onChange={(e) => setCorrectIndex(Number(e.target.value))} />
      </Field>
      <button onClick={async () => {
        try {
          await api(`/assessments/${assessmentId}/questions`, {
            method: "POST",
            body: JSON.stringify({ text, kind: "mcq", options: options.split(",").map((s) => s.trim()), correctIndex }),
          });
          setText("");
          onDone("Question added.");
        } catch (e) {
          onError((e as Error).message);
        }
      }}>Add question</button>
    </div>
  );
}
