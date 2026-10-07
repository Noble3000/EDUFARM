"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Crumb, DataTable, EmptyState, Field, FileInput, LoadingState, SuccessNote } from "@edufarm/ui";
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
  const [enrq, setEnrq] = useState("");
  const [ann, setAnn] = useState({ category: "course-notice", title: "", body: "", isUrgent: false });
  const [mat, setMat] = useState({ title: "", type: "lecture-notes", isFree: true, priceKobo: 50000, accessDurationDays: 90 });
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [asmts, setAsmts] = useState<{ id: string; title: string; status: string; gradesReleased: boolean }[]>([]);
  const [asmtLoading, setAsmtLoading] = useState(true);
  const [atitle, setAtitle] = useState("");
  const [atype, setAtype] = useState("quiz");
  const [ainstructions, setAinstructions] = useState("");
  const [atimelimit, setAtimelimit] = useState("");
  const [amaxattempts, setAmaxattempts] = useState("");
  const [adue, setAdue] = useState("");
  const [grade, setGrade] = useState<{
    attempts: {
      id: string; status: string; score: number | null; maxScore: number | null;
      feedback: string | null; gradedBy: string | null; gradedAt: string | null;
      student: { user: { name: string | null; email: string } };
      answers: { questionId: string; selectedIndex: number | null; body: string | null; isCorrect: boolean | null; marksAwarded: number; question: { text: string; kind: string; options: string[]; marks: number } }[];
    }[];
  } | null>(null);
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
  async function refresh(eq?: string) {
    setEnrLoading(true);
    try {
      const qs = eq?.trim() ? `?q=${encodeURIComponent(eq.trim())}` : "";
      setEnrs(await api(`/courses/${params.id}/enrollments${qs}`).catch(() => []));
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  async function upload(submit: boolean) {
    setOk("");
    setErr("");
    try {
      const fileKey = selectedFile ? `uploads/${encodeURIComponent(selectedFile.name)}` : "dev/mock.pdf";
      const checksum = selectedFile ? `chk-${selectedFile.size}-${selectedFile.lastModified}` : "dev";
      const created = await api(`/courses/${params.id}/materials`, {
        method: "POST",
        body: JSON.stringify({ ...mat, priceKobo: Number(mat.priceKobo), accessDurationDays: Number(mat.accessDurationDays), fileKey, checksum }),
      });
      if (submit) {
        await api(`/materials/${created.id}/approve`, { method: "POST", body: JSON.stringify({ attest: attestOwn }) });
      }
      setOk(submit ? "Ownership approved — sent to platform review." : "Uploaded — approve ownership to send for review.");
      setSelectedFile(null);
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
        <div className="row">
          <input style={{ maxWidth: 220 }} placeholder="Search name or email…" value={enrq} onChange={(e) => setEnrq(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") refresh(enrq); }} aria-label="Search enrollments" />
          <button className="sec" onClick={() => refresh(enrq)}>Search</button>
          {enrq && <button className="sec" onClick={() => { setEnrq(""); refresh(""); }}>Clear</button>}
        </div>
        {enrLoading && <LoadingState label="Loading enrollments…" />}
        {!enrLoading && enrs.length === 0 && (
          <EmptyState
            icon="user"
            title={enrq ? "No matching students" : "No enrollment requests"}
            body={enrq ? "No enrolled student matches that search. Clear it to see everyone." : "No enrollments yet, or you are not logged in as lecturer."}
            action={enrq
              ? <button className="sec" onClick={() => { setEnrq(""); refresh(""); }}>Clear search</button>
              : <a className="btn sec" href="/">Back to dashboard</a>}
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
        <Field label="Document file" hint="Choose a syllabus, slides, or study notes PDF/DOCX from your phone or device.">
          <FileInput
            label="Tap to select document"
            accept=".pdf,.doc,.docx,.txt"
            hint="Supports PDF, DOCX, TXT files up to 25MB"
            onFileSelect={(file) => {
              setSelectedFile(file);
              if (file && !mat.title) {
                setMat({ ...mat, title: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") });
              }
            }}
          />
        </Field>
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
        <div className="grid2">
          <Field label="New assessment title" htmlFor="asmt-title" hint="Creates a draft. Add questions below, then publish.">
            <input id="asmt-title" placeholder="e.g. Week 3 quiz" value={atitle} onChange={(e) => setAtitle(e.target.value)} />
          </Field>
          <Field label="Type">
            <select value={atype} onChange={(e) => setAtype(e.target.value)}>
              <option value="quiz">quiz</option>
              <option value="test">test</option>
              <option value="assignment">assignment</option>
            </select>
          </Field>
        </div>
        <Field label="Instructions (shown to students)">
          <textarea value={ainstructions} onChange={(e) => setAinstructions(e.target.value)} rows={2} placeholder="Read each question carefully…" />
        </Field>
        <div className="grid2">
          <Field label="Time limit (minutes, optional)" hint="1–600. Empty = untimed.">
            <input type="number" min={1} max={600} value={atimelimit} onChange={(e) => setAtimelimit(e.target.value)} placeholder="e.g. 30" />
          </Field>
          <Field label="Max attempts" hint="1–10.">
            <input type="number" min={1} max={10} value={amaxattempts} onChange={(e) => setAmaxattempts(e.target.value)} placeholder="1" />
          </Field>
        </div>
        <Field label="Due date (optional)" hint="Students cannot start new attempts after this.">
          <input type="datetime-local" value={adue} onChange={(e) => setAdue(e.target.value)} />
        </Field>
        <div className="row">
          <button onClick={async () => {
            setOk("");
            setErr("");
            try {
              const a = await api(`/courses/${params.id}/assessments`, {
                method: "POST",
                body: JSON.stringify({
                  title: atitle, type: atype, instructions: ainstructions || undefined,
                  timeLimitMin: atimelimit ? Number(atimelimit) : undefined,
                  maxAttempts: amaxattempts ? Number(amaxattempts) : undefined,
                  dueAt: adue ? new Date(adue).toISOString() : undefined,
                }),
              });
              setAtitle(""); setAinstructions(""); setAtimelimit(""); setAmaxattempts(""); setAdue("");
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
            <DataTable caption="Course assessments" head={["Title", "Status", "Released", "Actions"]}>
              {asmts.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.title}</strong></td>
                  <td><Badge kind={statusKind(a.status)}>{a.status}</Badge></td>
                  <td>{a.gradesReleased ? "yes" : "no"}</td>
                  <td>
                    <div className="row tight">
                      <button className="sec" onClick={() => setGradeId(a.id)} aria-label={`Open ${a.title}`}>Open</button>
                      {a.status === "draft" && (
                        <button onClick={async () => {
                          setOk(""); setErr("");
                          try {
                            await api(`/assessments/${a.id}/publish`, { method: "POST", body: JSON.stringify({}) });
                            setOk(`Published ${a.title} — students notified.`);
                          } catch (e) { setErr((e as Error).message); }
                        }} aria-label={`Publish ${a.title}`}>Publish</button>
                      )}
                      {a.status === "published" && (
                        <button className="sec" onClick={async () => {
                          setOk(""); setErr("");
                          try {
                            await api(`/assessments/${a.id}/close`, { method: "POST", body: JSON.stringify({}) });
                            setOk(`Closed ${a.title} — hidden from students.`);
                          } catch (e) { setErr((e as Error).message); }
                        }}>Unpublish</button>
                      )}
                      {a.status === "closed" && (
                        <button className="sec" onClick={async () => {
                          setOk(""); setErr("");
                          try {
                            await api(`/assessments/${a.id}/reopen`, { method: "POST", body: JSON.stringify({}) });
                            setOk(`Reopened ${a.title}.`);
                          } catch (e) { setErr((e as Error).message); }
                        }}>Reopen</button>
                      )}
                      {!a.gradesReleased && (
                        <button className="sec" onClick={async () => {
                          setOk(""); setErr("");
                          try {
                            await api(`/assessments/${a.id}/release`, { method: "POST", body: JSON.stringify({}) });
                            setOk(`Grades released for ${a.title} — students notified.`);
                          } catch (e) { setErr((e as Error).message); }
                        }} aria-label={`Release grades ${a.title}`}>Release grades</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
        {gradeId && <div style={{ marginTop: 12 }}>
          <h4>Add question (draft only)</h4>
          <p className="muted">Assessment {gradeId.slice(0, 8)}… — questions save immediately. Published items lock.</p>
          <QuestionForm assessmentId={gradeId} onDone={(m) => { setOk(m); setErr(""); }} onError={(m) => { setErr(m); setOk(""); }} />
          <h4 style={{ marginTop: 12 }}>Submissions</h4>
          <button className="sec" onClick={() => loadAttempts(gradeId)}>Load submissions</button>
          {attemptsLoading && <div style={{ marginTop: 8 }}><LoadingState label="Loading submissions…" lines={2} /></div>}
          {!attemptsLoading && grade && grade.attempts.length === 0 && (
            <div style={{ marginTop: 8 }}>
              <EmptyState
                icon="search"
                title="No submissions yet"
                body="Students have not attempted this assessment."
                action={<button className="sec" onClick={() => loadAttempts(gradeId)}>Reload submissions</button>}
              />
            </div>
          )}
          {!attemptsLoading && grade && grade.attempts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {grade.attempts.map((t) => (
                <GradeAttempt key={t.id} attempt={t} onDone={(m) => { setOk(m); loadAttempts(gradeId); }} onError={(m) => setErr(m)} />
              ))}
            </div>
          )}
        </div>}
      </div>
      <Insights courseId={params.id} />
    </div>
  );
}

type SuggRef = { type: "course" | "assessment" | "material" | "question"; id: string; label: string };

function refHref(courseId: string, ref: SuggRef): string {
  return `/courses/${courseId}`;
}

function Insights({ courseId }: { courseId: string }) {
  const [ins, setIns] = useState<{
    windowDays: number; enrolled: number; limited: boolean; summary: string;
    engagement: { newEnrollments: number; activeStudents: number | null; activeChangePct: number | null; dwellEvents: number; dwellChangePct: number; studyMinutes: number };
    completion: { materialId: string; title: string; version: number; readers: number | null; readersPct: number | null; avgDwellSec: number | null; trend: string; signal: string }[];
    topics: { term: string; mentions: number; questionIds: string[] }[];
    unresolved: { unanswered: { id: string; title: string; ageDays: number }[]; openCount: number };
    difficulty: { questionId: string; assessmentId: string; text: string; responses: number; correctPct: number | null }[];
    assessmentStats: { id: string; title: string; attempts: number; avgScore: number | null; maxScore: number }[];
    suggestions: { text: string; metric: string; ref: SuggRef }[];
  } | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function gen(d: number) {
    setLoading(true);
    setErr("");
    try {
      setIns(await api(`/courses/${courseId}/insights?days=${d}`));
    } catch (e) {
      setErr((e as Error).message);
      setIns(null);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="card">
      <h3>AI insights</h3>
      <p className="muted">Aggregated class signals only — counts, rates and trends. No student names, no personal data, no CGPA or private grades.</p>
      <div className="row">
        {[7, 14, 30].map((d) => (
          <button key={d} className={days === d ? "" : "sec"} aria-pressed={days === d} onClick={() => { setDays(d); gen(d); }}>{d} days</button>
        ))}
        <button className="sec" disabled={loading} onClick={() => gen(days)}>{loading ? "Generating…" : "Refresh"}</button>
      </div>
      {loading && <div style={{ marginTop: 12 }}><LoadingState label="Generating insights…" lines={2} /></div>}
      {err && <div style={{ marginTop: 12 }}><Alert kind="error">{err}</Alert></div>}
      {ins && !loading && (
        <div style={{ marginTop: 12 }}>
          <SuccessNote>{ins.summary}</SuccessNote>
          {ins.limited && <div style={{ marginTop: 8 }}><Alert kind="warn">Small cohort — rates are suppressed until at least 3 students enroll.</Alert></div>}
          <div style={{ marginTop: 8 }}>
            <DataTable caption={`Engagement · last ${ins.windowDays} days`} head={["Signal", "Now", "Change"]}>
              <tr><td>Enrolled</td><td>{ins.enrolled}{ins.engagement.newEnrollments ? ` (+${ins.engagement.newEnrollments} new)` : ""}</td><td>—</td></tr>
              <tr><td>Active students</td><td>{ins.engagement.activeStudents ?? "suppressed"}</td><td>{ins.engagement.activeChangePct == null ? "—" : `${ins.engagement.activeChangePct >= 0 ? "+" : ""}${ins.engagement.activeChangePct}%`}</td></tr>
              <tr><td>Study events</td><td>{ins.engagement.dwellEvents}</td><td>{`${ins.engagement.dwellChangePct >= 0 ? "+" : ""}${ins.engagement.dwellChangePct}%`}</td></tr>
              <tr><td>Study minutes</td><td>{ins.engagement.studyMinutes}</td><td>—</td></tr>
            </DataTable>
          </div>
          {ins.completion.length > 0 ? (
            <DataTable caption="Material completion (readers = sustained study)" head={["Material", "Completion", "Trend", "Signal"]}>
              {ins.completion.map((c) => (
                <tr key={c.materialId}>
                  <td>{c.title} <span className="muted">v{c.version}</span></td>
                  <td>{c.readersPct == null ? "suppressed" : `${c.readersPct}%${c.avgDwellSec != null ? ` · ~${c.avgDwellSec}s avg` : ""}`}</td>
                  <td><Badge kind={c.trend === "up" ? "ok" : c.trend === "down" ? "bad" : "info"}>{c.trend}</Badge></td>
                  <td><Badge kind={c.signal === "strong" ? "ok" : c.signal === "weak" ? "warn" : "info"}>{c.signal}</Badge></td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyState icon="book" title="No materials yet" body="Publish materials to track completion signals." />
          )}
          {ins.topics.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Frequently asked topics</h4>
              {ins.topics.map((x) => (
                <p key={x.term}><strong>{x.term}</strong> <span className="muted">· {x.mentions} mentions</span></p>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <h4>Unresolved questions ({ins.unresolved.openCount} open)</h4>
            {ins.unresolved.unanswered.length === 0 && <p className="muted">Nothing waiting — Q&amp;A is clear.</p>}
            {ins.unresolved.unanswered.map((u) => (
              <p key={u.id}><a href={`/courses/${courseId}`}><strong>{u.title}</strong></a> <span className="muted">· waiting {u.ageDays}d</span></p>
            ))}
          </div>
          {ins.difficulty.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Areas of difficulty (lowest MCQ correct rates)</h4>
              {ins.difficulty.map((d) => (
                <p key={d.questionId}>&ldquo;{d.text}…&rdquo; <span className="muted">· {d.correctPct == null ? "suppressed" : `${d.correctPct}% correct over ${d.responses} responses`}</span></p>
              ))}
            </div>
          )}
          {ins.assessmentStats.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <DataTable caption="Assessment performance (class averages)" head={["Assessment", "Attempts", "Average"]}>
                {ins.assessmentStats.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.attempts}</td>
                    <td>{a.avgScore != null ? `${a.avgScore}/${a.maxScore}` : "—"}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}
          {ins.suggestions.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Alert kind="info" icon="bulb" title="Suggested clarifications">
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {ins.suggestions.map((s, i) => (
                    <li key={i}>{s.text} <span className="muted">[{s.metric}]</span> <a href={refHref(courseId, s.ref)}>Open {s.ref.label}</a></li>
                  ))}
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
  const [kind, setKind] = useState("mcq");
  const [options, setOptions] = useState("A,B,C,D");
  const [correctIndex, setCorrectIndex] = useState(0);
  const [marks, setMarks] = useState(1);
  return (
    <div>
      <Field label="Question text">
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="grid2">
        <Field label="Kind">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="mcq">Objective (auto-graded)</option>
            <option value="theory">Subjective (you grade)</option>
          </select>
        </Field>
        <Field label="Marks" hint="1–100.">
          <input type="number" min={1} max={100} value={marks} onChange={(e) => setMarks(Number(e.target.value))} />
        </Field>
      </div>
      {kind === "mcq" && (
        <>
          <Field label="Options" hint="Comma-separated, e.g. A,B,C,D.">
            <input value={options} onChange={(e) => setOptions(e.target.value)} />
          </Field>
          <Field label="Correct option index" hint="0 = first option.">
            <input type="number" min={0} value={correctIndex} onChange={(e) => setCorrectIndex(Number(e.target.value))} />
          </Field>
        </>
      )}
      <button onClick={async () => {
        try {
          await api(`/assessments/${assessmentId}/questions`, {
            method: "POST",
            body: JSON.stringify(kind === "mcq"
              ? { text, kind, options: options.split(",").map((s) => s.trim()), correctIndex, marks }
              : { text, kind, marks }),
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

function GradeAttempt({ attempt, onDone, onError }: {
  attempt: {
    id: string; status: string; score: number | null; maxScore: number | null;
    feedback: string | null; gradedBy: string | null; gradedAt: string | null;
    student: { user: { name: string | null; email: string } };
    answers: { questionId: string; selectedIndex: number | null; body: string | null; isCorrect: boolean | null; marksAwarded: number; question: { text: string; kind: string; options: string[]; marks: number } }[];
  };
  onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [marks, setMarks] = useState<Record<string, number>>(() =>
    Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.marksAwarded])));
  const [feedback, setFeedback] = useState(attempt.feedback ?? "");
  async function grade() {
    try {
      await api(`/attempts/${attempt.id}/grade`, {
        method: "POST",
        body: JSON.stringify({
          marks: Object.entries(marks).map(([questionId, marksAwarded]) => ({ questionId, marksAwarded })),
          feedback,
        }),
      });
      onDone(`Graded ${attempt.student.user.name ?? attempt.student.user.email} — recorded with your identity and time.`);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <div style={{ borderTop: "1px solid #eee", paddingTop: 8, marginTop: 8 }}>
      <p><strong>{attempt.student.user.name ?? attempt.student.user.email}</strong>{" "}
        <span className="muted">{attempt.student.user.email}</span>{" "}
        <Badge kind={statusKind(attempt.status)}>{attempt.status}</Badge>{" "}
        {attempt.score != null && <strong>{attempt.score}/{attempt.maxScore}</strong>}{" "}
        {attempt.gradedAt && <span className="muted">graded {new Date(attempt.gradedAt).toLocaleString()}</span>}</p>
      {attempt.answers.map((a) => (
        <div key={a.questionId} style={{ marginLeft: 12, marginBottom: 8 }}>
          <p style={{ marginBottom: 4 }}><strong>Q:</strong> {a.question.text} <span className="muted">({a.question.kind}, {a.question.marks} mk{a.question.marks > 1 ? "s" : ""})</span></p>
          {a.question.kind === "mcq" ? (
            <p className="muted" style={{ margin: "2px 0" }}>
              Chose: <strong>{a.selectedIndex != null ? a.question.options[a.selectedIndex] ?? `#${a.selectedIndex}` : "—"}</strong>{" "}
              {a.isCorrect == null ? "" : a.isCorrect ? <Badge kind="ok">auto-correct</Badge> : <Badge kind="bad">auto-wrong</Badge>}
            </p>
          ) : (
            <p style={{ margin: "2px 0", whiteSpace: "pre-wrap" }}>{a.body || <span className="muted">No answer written.</span>}</p>
          )}
          <Field label={`Marks (max ${a.question.marks})`}>
            <input type="number" min={0} max={a.question.marks} style={{ maxWidth: 120 }}
              value={marks[a.questionId] ?? 0}
              onChange={(e) => setMarks({ ...marks, [a.questionId]: Number(e.target.value) })} />
          </Field>
        </div>
      ))}
      <Field label="Feedback to student (visible after release)">
        <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, what to improve…" />
      </Field>
      <button className="sec" onClick={grade}>Save grade + feedback</button>
    </div>
  );
}
