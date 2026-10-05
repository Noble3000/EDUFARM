"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getUser } from "@/lib/api";
import { Alert, Badge, EmptyState, ErrorState, Icon, LoadingState, SuccessNote } from "@edufarm/ui";

// Student home (§6.1 order, every card live):
// Word → priorities → continue → courses → updates → Q&A → points → AI + library/CGPA/trust.
// All counters come from persisted API data. Every card links somewhere real.
type Note = { id: string; title: string; body: string };
type Enr = { courseId: string; course: { code: string; title: string }; status: string };
type Prog = { courseId: string; code: string; percent: number };
type Word = { title: string; verse: string; body: string };
type Ann = { id: string; title: string; body: string; category: string; isUrgent: boolean };
type Q = { id: string; title: string; body: string; status: string };
type CourseDetail = { code: string; title: string; announcements: Ann[]; questions: Q[] };
type Asmt = { id: string; title: string; type: string; attempts: unknown[] };
type Me = {
  student?: {
    verificationStatus: string; matricNo: string;
    universityId: string; facultyId: string; departmentId: string; levelId: string;
  } | null;
};
type PtEntry = { amount: number; reason: string; createdAt: string };

const TIPS = [
  "Small daily progress beats cramming — open one material and read 20 focused minutes.",
  "Ask one question per week in each course — teaching others starts with asking.",
  "Review yesterday's pages before opening new ones — retrieval builds memory.",
  "Attempt every quiz even ungraded — scores feed your study record and points.",
  "Compare two materials on the same topic, then ask AI to quiz you on the difference.",
  "Write a 3-line summary after each material — your future exam self will thank you.",
  "Check lecturer updates every morning — urgent notices live at the top of Home.",
];

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [word, setWord] = useState<Word | null>(null);
  const [wordFailed, setWordFailed] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [chain, setChain] = useState({ uni: "", fac: "", dept: "" });
  const [notes, setNotes] = useState<Note[]>([]);
  const [cont, setCont] = useState<{ materialId: string | null; page?: number; material?: { title: string } } | null>(null);
  const [enroll, setEnroll] = useState<Enr[]>([]);
  const [progress, setProgress] = useState<Prog[]>([]);
  const [points, setPoints] = useState<{ balance: number; history: PtEntry[] } | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [cgpa, setCgpa] = useState<{ gpa: number | null; units: number } | null>(null);
  const [anns, setAnns] = useState<(Ann & { code: string; courseId: string })[]>([]);
  const [qs, setQs] = useState<(Q & { code: string; courseId: string })[]>([]);
  const [pendingList, setPendingList] = useState<{ id: string; title: string; courseId: string; code: string }[]>([]);
  const [totalAsmts, setTotalAsmts] = useState(0);

  async function load() {
    setFailed("");
    setWordFailed(false);
    try {
      const u = getUser();
      setUser(u);
      const w = await api("/devotional/today").catch(() => null);
      if (w && !w.empty) setWord(w);
      else setWordFailed(true);
      if (!u) { setReady(true); return; }
      const meData: Me = await api("/verifications/me");
      setMe(meData);
      const [enr, prog, pts, lib, grades, contData, notif] = await Promise.all([
        api("/enrollments/me").catch(() => null),
        api("/progress/me").catch(() => []),
        api("/points/me").catch(() => null),
        api("/library/me").catch(() => null),
        api("/grades/me").catch(() => null),
        api("/progress/continue").catch(() => null),
        api("/notifications/me").catch(() => []),
      ]);
      if (enr === null) throw new Error("Could not load your enrollments. Check your connection and try again.");
      setEnroll(enr);
      setProgress(Array.isArray(prog) ? prog : []);
      setPoints(pts);
      setLibraryCount(lib && Array.isArray(lib.purchases) && Array.isArray(lib.freeMaterials)
        ? lib.purchases.length + lib.freeMaterials.length : null);
      setCgpa(grades?.cgpa ?? null);
      setCont(contData);
      setNotes(Array.isArray(notif) ? notif : []);
      // chain names for trust indicators (real hierarchy data)
      const st = meData.student;
      if (st?.universityId) {
        const unis: { id: string; name: string }[] = await api("/universities").catch(() => []);
        const uni = unis.find((x) => x.id === st.universityId);
        let facName = "", deptName = "";
        if (st.facultyId) {
          const facs: { id: string; name: string }[] = await api(`/universities/${st.universityId}/faculties`).catch(() => []);
          facName = facs.find((x) => x.id === st.facultyId)?.name ?? "";
          if (st.departmentId) {
            const deps: { id: string; name: string }[] = await api(`/faculties/${st.facultyId}/departments`).catch(() => []);
            deptName = deps.find((x) => x.id === st.departmentId)?.name ?? "";
          }
        }
        setChain({ uni: uni?.name ?? "", fac: facName, dept: deptName });
      }
      // aggregate announcements + Q&A + assessments across ALL approved courses
      const approvedCourses = (enr as Enr[]).filter((e) => e.status === "approved");
      const allAnns: (Ann & { code: string; courseId: string })[] = [];
      const allQs: (Q & { code: string; courseId: string })[] = [];
      const pend: { id: string; title: string; courseId: string; code: string }[] = [];
      let total = 0;
      await Promise.all(approvedCourses.map(async (e) => {
        const [det, list] = await Promise.all([
          api(`/courses/${e.courseId}`).then((d) => d as CourseDetail).catch(() => null),
          api(`/courses/${e.courseId}/assessments`).then((l) => l as Asmt[]).catch(() => []),
        ]);
        if (det) {
          for (const a of det.announcements ?? []) allAnns.push({ ...a, code: e.course.code, courseId: e.courseId });
          for (const q of det.questions ?? []) allQs.push({ ...q, code: e.course.code, courseId: e.courseId });
        }
        total += list.length;
        for (const a of list) {
          if (!a.attempts.length) pend.push({ id: a.id, title: a.title, courseId: e.courseId, code: e.course.code });
        }
      }));
      setAnns(allAnns.slice(0, 5));
      setQs(allQs.slice(0, 4));
      setPendingList(pend.slice(0, 4));
      setTotalAsmts(total);
      setReady(true);
    } catch (e) {
      setFailed((e as Error).message ?? "Could not load Home.");
      setReady(true);
    }
  }

  useEffect(() => { load(); }, []);

  const approved = useMemo(() => enroll.filter((e) => e.status === "approved"), [enroll]);
  const requested = useMemo(() => enroll.filter((e) => e.status === "requested"), [enroll]);
  const avgProg = progress.length ? Math.round(progress.reduce((s, p) => s + p.percent, 0) / progress.length) : 0;
  const urgentAnns = anns.filter((a) => a.isUrgent);
  const urgentNotes = notes.filter((n) => n.title.startsWith("URGENT"));
  const firstName = user ? user.name.split(" ")[0] : "Scholar";
  const status = me?.student?.verificationStatus ?? "";
  const tip = TIPS[new Date().getDate() % TIPS.length];

  if (!ready) return <LoadingState label="Loading your home…" lines={5} />;

  if (!user) {
    return (
      <div>
        <section className="hero-youth" aria-label="Welcome">
          <span className="badge b-ed" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
            <Icon name="grad" size={13} /> Verified lecturer–student learning · installs as an app
          </span>
          <h2 style={{ marginTop: 10 }}>Hey Scholar — your whole campus life, in one app.</h2>
          <p>Verified courses. Official lecturer materials. Q&amp;A with your class. CGPA tracker. Points for real study. AI that cites your lecturer — not random internet gist.</p>
          <div className="row tight" style={{ marginTop: 12 }}>
            <a className="btn" style={{ background: "#C9A227", color: "#101828" }} href="/signup"><Icon name="plus" size={15} /> Join with matric no</a>
            <a className="btn sec" style={{ borderColor: "#fff", color: "#fff", background: "transparent" }} href="/login"><Icon name="user" size={15} /> Log in</a>
          </div>
          <p className="muted" style={{ color: "#E6F4EC", marginTop: 12, fontSize: 13 }}>
            Add to Home Screen from your browser menu to install. Your institution verifies every account.
          </p>
        </section>
        <div className="card">
          <span className="badge b-ed"><Icon name="book" size={13} /> What lives here</span>
          <h3 style={{ marginTop: 6 }}>Today&apos;s Word · Courses · Library · Q&amp;A · CGPA · Points · AI</h3>
          <p className="muted">Same daily Word for every student. Lecturer-approved courses only. In-app reading (no loose PDFs). Points are non-cash and slow by design — you earn by passing, participating, and staying consistent.</p>
          <div className="pill-tabs" aria-label="Explore">
            <a href="/courses"><Icon name="book" size={14} /> Courses</a>
            <a href="/library"><Icon name="library" size={14} /> Library</a>
            <a href="/grades"><Icon name="chart" size={14} /> CGPA</a>
            <a href="/verify"><Icon name="verify" size={14} /> Verify</a>
            <a href="/login"><Icon name="ai" size={14} /> AI help</a>
          </div>
        </div>
        <div className="card" aria-label="Today's Word preview">
          <span className="badge b-ed"><Icon name="star" size={13} /> Today&apos;s Word · same for every student</span>
          {word ? (
            <><h3 style={{ marginTop: 6 }}>“{word.title}” — {word.verse}</h3><p>{word.body}</p></>
          ) : (
            <p className="muted" style={{ marginTop: 6 }}>Today&apos;s Word is on the home screen after you log in.</p>
          )}
          <p><a href="/login"><strong>Log in to open your full home</strong></a></p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {failed && <div style={{ marginBottom: 12 }}><ErrorState message={failed} onRetry={load} /></div>}
      <section className="hero-youth" aria-label="Greeting">
        <span className="badge b-ed" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
          <Icon name="checkBadge" size={13} /> {status === "verified" ? "Verified student" : status ? `Verification: ${status}` : "Student ecosystem"}
        </span>
        <h2 style={{ marginTop: 10 }}>{daypart()}, {firstName} — let&apos;s make today count.</h2>
        <p>{approved.length} active {approved.length === 1 ? "course" : "courses"} · {pendingList.length} assessment{pendingList.length === 1 ? "" : "s"} waiting · {points?.balance ?? 0} points stacked.</p>
        <div className="row tight" style={{ marginTop: 12 }}>
          {cont?.materialId ? (
            <a className="btn" style={{ background: "#C9A227", color: "#101828" }} href={`/materials/${cont.materialId}`}><Icon name="book" size={15} /> Continue studying</a>
          ) : (
            <a className="btn" style={{ background: "#C9A227", color: "#101828" }} href="/courses"><Icon name="book" size={15} /> Find my courses</a>
          )}
          <a className="btn sec" style={{ borderColor: "#fff", color: "#fff", background: "transparent" }} href={approved[0] ? `/courses/${approved[0].courseId}` : "/courses"}><Icon name="ai" size={15} /> Ask AI</a>
        </div>
      </section>

      <nav className="pill-tabs" aria-label="Sections">
        <a className="on" href="#word"><Icon name="star" size={14} /> Today</a>
        <a href="#courses"><Icon name="book" size={14} /> Courses</a>
        <a href="#updates"><Icon name="announce" size={14} /> Updates</a>
        <a href="#qa"><Icon name="qa" size={14} /> Q&amp;A</a>
        <a href="#rewards"><Icon name="wallet" size={14} /> Rewards</a>
        <a href="/grades"><Icon name="chart" size={14} /> CGPA</a>
        <a href="/library"><Icon name="library" size={14} /> Library</a>
      </nav>

      <div className="grid2">
        <div>
          <section id="word" className="card" style={{ borderLeft: "6px solid #C9A227" }} aria-label="Today's Word">
            <span className="badge b-ed"><Icon name="star" size={13} /> Today&apos;s Word · same for every student</span>
            {word ? (
              <><h2 style={{ marginTop: 6 }}>“{word.title}” — {word.verse}</h2><p>{word.body}</p></>
            ) : wordFailed ? (
              <p className="muted" style={{ marginTop: 6 }}>Today&apos;s Word didn&apos;t load. <a href="#" onClick={(e) => { e.preventDefault(); load(); }}>Try again</a>.</p>
            ) : (
              <h2 style={{ marginTop: 6 }}>Loading today&apos;s Word…</h2>
            )}
          </section>

          <section className="card" aria-label="Reflection">
            <span className="badge b-ed"><Icon name="bulb" size={13} /> Today&apos;s study tip</span>
            <p className="muted" style={{ marginTop: 6 }}>{tip}</p>
          </section>

          <section className="card" aria-label="Priorities">
            <span className="badge b-urg"><Icon name="bell" size={13} /> Academic priorities</span>
            <div style={{ marginTop: 8 }}>
              {urgentAnns.map((a) => (
                <p key={a.id}><span className="badge b-urg">Urgent</span><a href={`/courses/${a.courseId}`}><strong>{a.title}</strong></a> <span className="muted">· {a.code}</span></p>
              ))}
              {urgentNotes.map((n) => <p key={n.id}><span className="badge b-urg">Urgent</span>{n.title}</p>)}
              {!urgentAnns.length && !urgentNotes.length && <p className="muted">No urgent pings. Clean slate — stay ahead.</p>}
              {pendingList.map((a) => (
                <p key={a.id}><Icon name="quiz" size={14} /> <a href={`/assessments/${a.id}`}><strong>{a.title}</strong></a> <span className="muted">· {a.code} · awaiting your attempt</span></p>
              ))}
              {!pendingList.length && <p className="muted">No pending assessments{totalAsmts ? ` (${totalAsmts} done)` : ""}.</p>}
              {requested.length > 0 && (
                <p><Icon name="clock" size={14} /> <strong>{requested.length} enrollment{requested.length === 1 ? "" : "s"}</strong> <span className="muted">awaiting lecturer approval — <a href="/courses">view courses</a></span></p>
              )}
              <p><Icon name="chart" size={14} /> <strong>{avgProg}%</strong> <span className="muted">avg progress across {approved.length} {approved.length === 1 ? "course" : "courses"}</span></p>
            </div>
          </section>

          {cont?.materialId ? (
            <section className="card" aria-label="Continue">
              <span className="badge b-pink"><Icon name="arrowR" size={13} /> Continue studying</span>
              <p style={{ marginTop: 6 }}><a href={`/materials/${cont.materialId}`}>{cont.material?.title ?? cont.materialId}</a> <span className="muted">· page {cont.page ?? 1} · picks up where you stopped</span></p>
            </section>
          ) : (
            <section className="card" aria-label="Continue">
              <span className="badge b-pink"><Icon name="arrowR" size={13} /> Continue studying</span>
              <EmptyState icon="book" title="Nothing in progress" body="Open any material and your place is saved here automatically." action={<a className="btn sec" href="/courses">Browse courses</a>} />
            </section>
          )}

          <section id="courses" className="card" aria-label="My courses">
            <span className="badge b-off"><Icon name="book" size={13} /> My Courses · {approved.length} active</span>
            <div style={{ marginTop: 8 }}>
              {approved.map((e) => {
                const p = progress.find((x) => x.courseId === e.courseId);
                return (
                  <div key={e.courseId} style={{ marginBottom: 14 }}>
                    <a href={`/courses/${e.courseId}`}><strong>{e.course.code} — {e.course.title}</strong></a>
                    <div className="progress" role="progressbar" aria-valuenow={p?.percent ?? 0} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${p?.percent ?? 0}%` }} /></div>
                    <span className="muted">{p?.percent ?? 0}% complete · dwell-based, not just opens</span>
                  </div>
                );
              })}
              {!approved.length && <p className="muted">No approved courses yet — <a href="/courses">browse courses</a> and request enrollment. Your lecturer approves.</p>}
            </div>
          </section>

          <section id="updates" className="card" aria-label="Lecturer updates">
            <span className="badge b-ver"><Icon name="announce" size={13} /> Lecturer updates · all my courses</span>
            <div style={{ marginTop: 8 }}>
              {anns.map((a) => (
                <p key={a.id} style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8 }}>
                  {a.isUrgent ? <span className="badge b-urg">Urgent</span> : <span className="badge b-ed">{a.category}</span>}
                  <a href={`/courses/${a.courseId}`}><strong>{a.title}</strong></a> <span className="muted">· {a.code} — {a.body.slice(0, 110)}{a.body.length > 110 ? "…" : ""}</span>
                </p>
              ))}
              {!anns.length && <p className="muted">No updates yet. When your lecturers post, they land here with course links.</p>}
            </div>
          </section>

          <section id="qa" className="card" aria-label="Course Q&A">
            <span className="badge b-ver"><Icon name="qa" size={13} /> Course Q&amp;A · ask, learn, resolve</span>
            <div style={{ marginTop: 8 }}>
              {qs.map((q) => (
                <p key={q.id} style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8 }}>
                  <a href={`/courses/${q.courseId}`}><strong>{q.title}</strong></a> <span className="badge b-ed">{q.status}</span> <span className="muted">· {q.code}</span><br /><span className="muted">{q.body.slice(0, 110)}{q.body.length > 110 ? "…" : ""}</span>
                </p>
              ))}
              {!qs.length && <p className="muted">No questions yet — be the first to ask in your course space. Lecturer replies show for the whole class.</p>}
              {approved[0] && <p><a href={`/courses/${approved[0].courseId}`}><strong>Open Q&amp;A in {approved[0].course.code}</strong></a> <span className="muted">· searchable class knowledge base</span></p>}
            </div>
          </section>
        </div>

        <div>
          <section className="card tight" aria-label="Study pulse">
            <span className="badge b-off"><Icon name="chart" size={13} /> Your study pulse</span>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: "1 1 130px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: 12 }}>
                <div className="muted"><Icon name="chart" size={13} /> Progress</div>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{avgProg}%</div>
                <div className="muted">{approved.length} courses</div>
              </div>
              <div style={{ flex: "1 1 130px", background: "#FFFAEB", border: "1px solid #FEDF89", borderRadius: 14, padding: 12 }}>
                <div className="muted"><Icon name="grad" size={13} /> CGPA</div>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{cgpa?.gpa ?? "—"}</div>
                <div className="muted"><a href="/grades">Track privately</a></div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div style={{ flex: "1 1 130px", background: "#FEFBE8", border: "1px solid #FEDF89", borderRadius: 14, padding: 12 }}>
                <div className="muted"><Icon name="star" size={13} /> Points</div>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{points?.balance ?? "…"}</div>
                <div className="muted">non-cash · slow</div>
              </div>
              <div style={{ flex: "1 1 130px", background: "#FDF2F8", border: "1px solid #F9A8D4", borderRadius: 14, padding: 12 }}>
                <div className="muted"><Icon name="library" size={13} /> Library</div>
                <div style={{ fontFamily: "Sora", fontWeight: 800, fontSize: 22 }}>{libraryCount ?? "…"}</div>
                <div className="muted"><a href="/library">Open shelf</a></div>
              </div>
            </div>
          </section>

          <section id="rewards" className="card" aria-label="Points">
            <span className="badge b-pts"><Icon name="star" size={13} /> Academic points · earn slow, spend smart</span>
            <p style={{ marginTop: 6 }}><strong>{points?.balance ?? "…"} pts</strong> <span className="muted">· pass assessments + lecturer recognition · redeem from 5000 on eligible materials · never cash</span></p>
            {points && points.history.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                {points.history.slice(0, 3).map((h, i) => (
                  <p key={i} className="muted">+{h.amount} — {h.reason} · {new Date(h.createdAt).toLocaleDateString()}</p>
                ))}
                <p><a href="/library"><strong>Redeem in Library checkout</strong></a></p>
              </div>
            ) : (
              <p className="muted">No points yet — pass an assessment or earn lecturer recognition. <a href="/courses">View courses</a>.</p>
            )}
          </section>

          <section className="card" aria-label="AI">
            <span className="badge b-ver"><Icon name="ai" size={13} /> AI Study Assistant · cites your lecturer first</span>
            <p className="muted" style={{ marginTop: 6 }}>Explain, summarize, compare, Ask This Material, practice + exam prep — grounded in materials you can access. General gist is always labeled.</p>
            <p>{approved[0] ? <a href={`/courses/${approved[0].courseId}`}><strong>Ask about {approved[0].course.code}</strong></a> : <a href="/courses"><strong>Join a course to unlock AI</strong></a>}</p>
          </section>

          <section className="card" aria-label="Library and CGPA">
            <span className="badge b-pink"><Icon name="library" size={13} /> Library + CGPA · yours</span>
            <p style={{ marginTop: 6 }}><Icon name="lock" size={14} /> {libraryCount ?? "…"} items · in-ecosystem reading with clear access time. <a href="/library"><strong>Open library</strong></a></p>
            <p><Icon name="chart" size={14} /> {cgpa?.gpa != null ? `CGPA ${cgpa.gpa} over ${cgpa.units} units` : "No grades recorded yet"}, private to you. <a href="/grades"><strong>Update grades</strong></a></p>
          </section>

          <section className="card" aria-label="Trust">
            <span className="badge b-off"><Icon name="checkBadge" size={13} /> {status === "verified" ? "Verified student" : `Verification: ${status || "unknown"}`}</span>
            <div style={{ marginTop: 6 }}>
              {me?.student ? (
                <>
                  <p><strong>{me.student.matricNo}</strong> <span className="muted">· {chain.uni}{chain.fac ? ` · ${chain.fac}` : ""}{chain.dept ? ` · ${chain.dept}` : ""}</span></p>
                  <p className="muted">Verified Institution · Verified Lecturer · Official Course/Material. Report issues — review is defined, never auto-takedown. No 1-to-1 chat: all help stays in course Q&amp;A.</p>
                </>
              ) : (
                <p className="muted">Sign-in state unclear — your verification details will show here once loaded.</p>
              )}
              <p><a href="/verify"><strong>{status === "verified" ? "View verification" : "Complete verification"}</strong></a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
