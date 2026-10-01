"use client";
import { useEffect, useMemo, useState } from "react";
import { api, getUser } from "@/lib/api";
import { Icon } from "@edufarm/ui";

// Student home — PWA-first, youthful, strictly aligned (§6.1 order):
// Word → priorities → continue → courses → updates → Q&A → points → AI + library/CGPA/verify.
type Note = { id: string; title: string; body: string };
type Enr = { courseId: string; course: { code: string; title: string }; status: string };
type Prog = { courseId: string; code: string; percent: number };
type Word = { title: string; verse: string; body: string };
type CourseDetail = {
  announcements: { id: string; title: string; body: string; category: string; isUrgent: boolean }[];
  questions: { id: string; title: string; body: string; status: string }[];
  materials: { id: string }[];
};
type Asmt = { id: string; title: string; attempts: unknown[] };

function daypart(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [word, setWord] = useState<Word | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cont, setCont] = useState<{ materialId: string | null; page?: number; material?: { title: string } } | null>(null);
  const [enroll, setEnroll] = useState<Enr[]>([]);
  const [progress, setProgress] = useState<Prog[]>([]);
  const [points, setPoints] = useState<{ balance: number } | null>(null);
  const [libraryCount, setLibraryCount] = useState<number | null>(null);
  const [cgpa, setCgpa] = useState<{ gpa: number | null; units: number } | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [pendingAsmts, setPendingAsmts] = useState(0);
  const [totalAsmts, setTotalAsmts] = useState(0);

  useEffect(() => {
    setUser(getUser());
    api("/devotional/today").then(setWord).catch(() => {});
    if (!getUser()) return;
    api("/notifications/me").then(setNotes).catch(() => {});
    api("/progress/continue").then(setCont).catch(() => {});
    api("/enrollments/me").then(async (enr: Enr[]) => {
      setEnroll(enr);
      const approved = enr.filter((e) => e.status === "approved");
      if (approved[0]?.courseId) {
        api(`/courses/${approved[0].courseId}`).then(setDetail).catch(() => {});
        let pending = 0, total = 0;
        for (const e of approved) {
          const list: Asmt[] = await api(`/courses/${e.courseId}/assessments`).catch(() => []);
          total += list.length;
          pending += list.filter((a) => !a.attempts.length).length;
        }
        setPendingAsmts(pending);
        setTotalAsmts(total);
      }
    }).catch(() => {});
    api("/progress/me").then(setProgress).catch(() => {});
    api("/points/me").then(setPoints).catch(() => {});
    api("/library/me").then((l: unknown[]) => setLibraryCount(Array.isArray(l) ? l.length : 0)).catch(() => {});
    api("/grades/me").then((g: { cgpa: { gpa: number | null; units: number } }) => setCgpa(g.cgpa)).catch(() => {});
  }, []);

  const approved = useMemo(() => enroll.filter((e) => e.status === "approved"), [enroll]);
  const avgProg = progress.length ? Math.round(progress.reduce((s, p) => s + p.percent, 0) / progress.length) : 0;
  const urgent = notes.filter((n) => n.title.startsWith("URGENT"));
  const firstName = user ? user.name.split(" ")[0] : "Scholar";

  if (!user) {
    return (
      <div>
        <section className="hero-youth" aria-label="Welcome">
          <span className="badge b-ed" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
            <Icon name="grad" size={13} /> PWA · installs on your phone · works on low data
          </span>
          <h2 style={{ marginTop: 10 }}>Hey Scholar — your whole campus life, in one app.</h2>
          <p>Verified courses. Official lecturer materials. Q&amp;A with your class. CGPA tracker. Points for real study. AI that cites your lecturer — not random internet gist.</p>
          <div className="row tight" style={{ marginTop: 12 }}>
            <a className="btn" style={{ background: "#C9A227", color: "#101828" }} href="/signup"><Icon name="plus" size={15} /> Join with matric no</a>
            <a className="btn sec" style={{ borderColor: "#fff", color: "#fff", background: "transparent" }} href="/login"><Icon name="user" size={15} /> Log in</a>
          </div>
          <p className="muted" style={{ color: "#E6F4EC", marginTop: 12, fontSize: 13 }}>
            Demo: ada@student.demo-university.edu (verified) · pending@student.demo-university.edu (unverified). Add to Home Screen from your browser menu to install.
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
      </div>
    );
  }

  return (
    <div>
      <section className="hero-youth" aria-label="Greeting">
        <span className="badge b-ed" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.35)" }}>
          <Icon name="checkBadge" size={13} /> Verified student ecosystem
        </span>
        <h2 style={{ marginTop: 10 }}>{daypart()}, {firstName} — let&apos;s make today count.</h2>
        <p>{approved.length} active {approved.length === 1 ? "course" : "courses"} · {pendingAsmts} assessment{pendingAsmts === 1 ? "" : "s"} waiting · {points?.balance ?? 0} points stacked.</p>
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
            <h2 style={{ marginTop: 6 }}>{word ? `“${word.title}” — ${word.verse}` : "Loading today's Word…"}</h2>
            {word && <p>{word.body}</p>}
          </section>

          <section className="card" aria-label="Reflection">
            <span className="badge b-ed"><Icon name="bulb" size={13} /> Academic reflection (not devotional)</span>
            <p className="muted" style={{ marginTop: 6 }}>Study theme: consistency — small daily progress beats cramming. Your streak lives in My Courses below.</p>
          </section>

          <section className="card" aria-label="Priorities">
            <span className="badge b-urg"><Icon name="bell" size={13} /> Academic priorities</span>
            <div style={{ marginTop: 8 }}>
              {urgent.length > 0 ? urgent.map((n) => <p key={n.id}><span className="badge b-urg">Urgent</span>{n.title}</p>) : <p className="muted">No urgent pings. Clean slate — stay ahead.</p>}
              <p><Icon name="quiz" size={14} /> <strong>{pendingAsmts} pending</strong> <span className="muted">of {totalAsmts} assessments</span> · <Icon name="clock" size={14} /> <strong>{avgProg}%</strong> <span className="muted">avg progress</span></p>
            </div>
          </section>

          {cont?.materialId && (
            <section className="card" aria-label="Continue">
              <span className="badge b-pink"><Icon name="arrowR" size={13} /> Continue studying</span>
              <p style={{ marginTop: 6 }}><a href={`/materials/${cont.materialId}`}>{cont.material?.title ?? cont.materialId}</a> <span className="muted">· page {cont.page ?? 1} · picks up where you stopped</span></p>
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
                    <span className="muted">{p?.percent ?? 0}% complete · meaningful study, not just opens</span>
                  </div>
                );
              })}
              {!approved.length && <p className="muted">No approved courses yet — <a href="/courses">browse courses</a> and request enrollment. Your lecturer approves.</p>}
            </div>
          </section>

          <section id="updates" className="card" aria-label="Lecturer updates">
            <span className="badge b-ver"><Icon name="announce" size={13} /> Lecturer updates</span>
            <div style={{ marginTop: 8 }}>
              {(detail?.announcements ?? []).slice(0, 4).map((a) => (
                <p key={a.id} style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8 }}>
                  {a.isUrgent ? <span className="badge b-urg">Urgent</span> : <span className="badge b-ed">{a.category}</span>}
                  <strong>{a.title}</strong> <span className="muted">— {a.body.slice(0, 120)}{a.body.length > 120 ? "…" : ""}</span>
                </p>
              ))}
              {!detail?.announcements?.length && notes.slice(0, 4).map((n) => <p key={n.id}>· {n.title}</p>)}
              {!detail?.announcements?.length && !notes.length && <p className="muted">No updates yet. When your lecturer posts, it lands here.</p>}
            </div>
          </section>

          <section id="qa" className="card" aria-label="Course Q&A">
            <span className="badge b-ver"><Icon name="qa" size={13} /> Course Q&amp;A · ask, learn, resolve</span>
            <div style={{ marginTop: 8 }}>
              {(detail?.questions ?? []).slice(0, 3).map((q) => (
                <p key={q.id} style={{ borderTop: "1px solid #F2F4F7", paddingTop: 8 }}>
                  <strong>{q.title}</strong> <span className="badge b-ed">{q.status}</span><br /><span className="muted">{q.body.slice(0, 110)}{q.body.length > 110 ? "…" : ""}</span>
                </p>
              ))}
              {!detail?.questions?.length && <p className="muted">No questions yet — be the first to ask in your course space. Lecturer replies show for the whole class.</p>}
              {approved[0] && <p><a href={`/courses/${approved[0].courseId}`}><strong>Open Q&amp;A</strong></a> <span className="muted">· searchable class knowledge base</span></p>}
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
          </section>

          <section className="card" aria-label="AI">
            <span className="badge b-ver"><Icon name="ai" size={13} /> AI Study Assistant · cites your lecturer first</span>
            <p className="muted" style={{ marginTop: 6 }}>Explain, summarize, compare, Ask This Material, practice + exam prep — grounded in materials you can access. General gist is always labeled.</p>
            <p>{approved[0] ? <a href={`/courses/${approved[0].courseId}`}><strong>Ask about {approved[0].course.code}</strong></a> : <a href="/courses"><strong>Join a course to unlock AI</strong></a>}</p>
          </section>

          <section className="card" aria-label="Library and CGPA">
            <span className="badge b-pink"><Icon name="library" size={13} /> Library + CGPA · yours</span>
            <p style={{ marginTop: 6 }}><Icon name="lock" size={14} /> In-ecosystem reading with clear access time. <a href="/library"><strong>Open library</strong></a></p>
            <p><Icon name="chart" size={14} /> 5-point CGPA, private to you. <a href="/grades"><strong>Update grades</strong></a></p>
          </section>

          <section className="card" aria-label="Trust">
            <span className="badge b-off"><Icon name="checkBadge" size={13} /> Verified · Official · Yours</span>
            <p className="muted" style={{ marginTop: 6 }}>Verified Institution · Verified Lecturer · Official Course/Material. Report issues — review is defined, never auto-takedown. No 1-to-1 chat: all help stays in course Q&amp;A.</p>
            <p><a href="/verify"><strong>Check verification</strong></a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
