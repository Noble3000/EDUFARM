// Insights E2E: aggregated signals correct, privacy absolute.
// Seeds signals (enrollments, dwells, questions, MCQ attempts) then asserts:
// engagement deltas, completion rates, topics, unresolved, difficulty,
// suggestions with refs, ownership fencing, cohort gating, and a recursive
// scan proving NO student ids/names/emails/matric/CGPA/grades leak.
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const API = "http://localhost:4000/api/v1";
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const out: string[] = [];
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; out.push(`PASS ${name}`); } else { fail++; out.push(`FAIL ${name} ${extra}`); }
}
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any };
}
function pwHash(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
async function sessionFor(email: string, pw: string) {
  await prisma.user.update({ where: { email }, data: { passwordHash: pwHash(pw) } });
  const r = await call("POST", "/auth/login", undefined, { email, password: pw });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.data as { id: string; sessionToken: string };
}
const admin = await sessionFor("admin@edufarm.ng", "TmpI1-x");
const bello = await sessionFor("bello@demo-university.edu", "TmpI2-x");
const uni = await prisma.university.findUnique({ where: { slug: "demo-university" } });
const fac = await prisma.faculty.findFirst({ where: { universityId: uni!.id } });
const dept = await prisma.department.findFirst({ where: { facultyId: fac!.id } });
const level = await prisma.level.findFirst({ where: { departmentId: dept!.id } });
const course = await prisma.course.findFirst({ where: { departmentId: dept!.id } });
const CHAIN = { universityId: uni!.id, facultyId: fac!.id, departmentId: dept!.id, levelId: level!.id };
const sem = Date.now().toString(36);

// baseline BEFORE seeding signals (shared demo course accumulates history)
const freeM0 = await prisma.material.findFirst({ where: { courseId: course!.id, isFree: true, status: "published" } });
const baseIns = (await call("GET", `/courses/${course!.id}/insights?days=14`, bello.sessionToken)).data as any;
const baseEnrolled: number = baseIns.enrolled ?? 0;
const baseActive: number = baseIns.engagement?.activeStudents ?? 0;
const baseOpen: number = baseIns.unresolved?.openCount ?? 0;
const baseReaders: number = ((baseIns.completion as any[]) ?? []).find((c) => c.materialId === freeM0?.id)?.readers ?? 0;

// 4 students: signup → approve → enroll → approve; 3 study + ask, 1 idle
const toks: { token: string; profileId: string; email: string }[] = [];
for (let i = 0; i < 4; i++) {
  const r = await call("POST", "/auth/signup", undefined, { name: `Ins User${i}`, email: `ins-${i}-${sem}@e2e.ng`, password: "password123", role: "student", ...CHAIN, matricNo: `STU-INS${i}-${sem}` });
  const u = r.data as { id: string; sessionToken: string };
  const prof = await prisma.studentProfile.findUnique({ where: { userId: u.id } });
  await call("POST", `/verifications/student/${prof!.id}/decide`, admin.sessionToken, { decision: "approve" });
  await call("POST", `/courses/${course!.id}/enroll`, u.sessionToken, {});
  const enr = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: course!.id, studentId: prof!.id } } });
  await call("POST", `/enrollments/${enr!.id}/decide`, bello.sessionToken, { decision: "approve" });
  toks.push({ token: u.sessionToken, profileId: prof!.id, email: `ins-${i}-${sem}@e2e.ng` });
}
// signals: 3/4 dwell on free material; all ask about "mitosis"; Q&A thread
const freeM = await prisma.material.findFirst({ where: { courseId: course!.id, isFree: true, status: "published" } });
for (const t of toks.slice(0, 3)) {
  await prisma.studyEvent.create({ data: { studentId: t.profileId, courseId: course!.id, materialId: freeM!.id, type: "page-dwell", durationSec: 30 } });
  await call("POST", `/courses/${course!.id}/questions`, t.token, { title: `Why does mitosis matter ${t.email.slice(0, 6)}`, body: "Explain mitosis phases simply." });
}
// MCQ assessment with a hard question (lecturer builds, students attempt)
const asm = await call("POST", `/courses/${course!.id}/assessments`, bello.sessionToken, { title: `INS Quiz ${sem}`, type: "quiz" });
const aid = (asm.data as { id: string }).id;
await call("POST", `/assessments/${aid}/questions`, bello.sessionToken, { text: "Mitosis phase order?", kind: "mcq", options: ["Prophase", "Metaphase", "Anaphase", "Telophase"], correctIndex: 1, marks: 2 });
const hardQ = await call("POST", `/assessments/${aid}/questions`, bello.sessionToken, { text: "Hard: chromatid count?", kind: "mcq", options: ["46", "23", "92", "12"], correctIndex: 0, marks: 2 });
const hardQid = (hardQ.data as { id: string }).id;
await call("POST", `/assessments/${aid}/publish`, bello.sessionToken, {});
for (const t of toks.slice(0, 3)) {
  const st = await call("POST", `/assessments/${aid}/start`, t.token, {});
  const attemptId = (st.data as { attempt: { id: string } }).attempt.id;
  const qs = await prisma.assessmentQuestion.findMany({ where: { assessmentId: aid }, orderBy: { order: "asc" } });
  // Q1 right, Q2 wrong (hard) for all three
  await call("POST", `/attempts/${attemptId}/submit`, t.token, { answers: [{ questionId: qs[0].id, selectedIndex: 1 }, { questionId: qs[1].id, selectedIndex: 3 }] });
}

// insights as owner lecturer
let r = await call("GET", `/courses/${course!.id}/insights?days=14`, bello.sessionToken);
check("owner reads insights", r.status === 200, `status=${r.status}`);
const ins = r.data as any;
const baseEnrolled: number = ins.enrolled;
const baseActive: number = ins.engagement.activeStudents ?? 0;
const baseReaders = new Map<string, number>();
for (const c of (ins.completion as any[])) baseReaders.set(c.materialId, c.readers ?? 0);
check("engagement: +4 enrolled, +3 active", ins.enrolled === baseEnrolled + 4 && ins.engagement.activeStudents === baseActive + 3, `enr=${ins.enrolled}(base ${baseEnrolled}) act=${ins.engagement?.activeStudents}(base ${baseActive})`);

check("engagement change present", typeof ins.engagement.dwellChangePct === "number" && typeof ins.engagement.studyMinutes === "number");
const comp = (ins.completion as any[]).find((c) => c.materialId === freeM!.id);
const expReaders = baseReaders + 3;
const expPct = Math.round((expReaders / (baseEnrolled + 4)) * 100);
check("completion: readers +3, pct recomputed", comp && comp.readers === expReaders && comp.readersPct === expPct, JSON.stringify(comp));
check("topics: mitosis clustered", (ins.topics as any[]).some((t) => t.term === "mitosis" && t.mentions >= 2), JSON.stringify((ins.topics || []).slice(0, 3)));
check("unresolved listed with ages", (ins.unresolved.openCount ?? 0) >= baseOpen + 3 && (ins.unresolved.unanswered as any[]).length > 0, `open=${ins.unresolved.openCount}(base ${baseOpen})`);
check("difficulty: hard question 0% correct", (ins.difficulty as any[]).some((d) => d.questionId === hardQid && d.correctPct === 0), JSON.stringify((ins.difficulty || []).slice(0, 3)));
check("suggestions have text+metric+ref", (ins.suggestions as any[]).length > 0 && (ins.suggestions as any[]).every((s) => s.text && s.metric && s.ref?.id));
check("summary plain language", typeof ins.summary === "string" && ins.summary.length > 20);
// assessment avg shows (class-level, lecturer grades these — allowed)
check("assessment avg present", (ins.assessmentStats as any[]).some((a) => a.id === aid && a.attempts === 3));
// window validation
r = await call("GET", `/courses/${course!.id}/insights?days=99`, bello.sessionToken);
check("bad window rejected", r.status === 400, `status=${r.status}`);

// PRIVACY SCAN: no student ids/names/emails/matric/CGPA/grade data anywhere
const blob = JSON.stringify(ins);
const studentIds = toks.map((t) => t.profileId);
const userIds = (await prisma.user.findMany({ where: { email: { endsWith: "@e2e.ng" } }, select: { id: true } })).map((u) => u.id);
const leaks = [...studentIds, ...userIds].filter((id) => blob.includes(id));
const emails = [`ins-0-${sem}@e2e.ng`, `ins-1-${sem}@e2e.ng`].filter((e) => blob.includes(e));
check("no student/user ids leak", leaks.length === 0, leaks.slice(0, 2).join(","));
check("no emails leak", emails.length === 0);
check("no CGPA/grades keys", !/cgpa|CGPA|gradeSemester|matricNo|passwordHash/i.test(blob));
check("no per-student rows", !/"studentId"/.test(blob));

// ownership fencing: unassigned verified lecturer from another chain blocked
const lecR = await call("POST", "/auth/signup", undefined, { name: "Ins Lec", email: `inslec-${sem}@e2e.ng`, password: "password123", role: "lecturer", departmentId: dept!.id, staffId: `INSE-${sem}` });
const lecBody = lecR.data as { id: string; sessionToken: string };
const lecProf = await prisma.lecturerProfile.findUnique({ where: { userId: lecBody.id } });
await call("POST", `/verifications/lecturer/${lecProf!.id}/decide`, admin.sessionToken, { decision: "approve" });
r = await call("GET", `/courses/${course!.id}/insights?days=14`, lecBody.sessionToken);
check("unassigned lecturer fenced (403)", r.status === 403, `status=${r.status}`);
// student fenced too
r = await call("GET", `/courses/${course!.id}/insights`, toks[0].token);
check("student fenced (403)", r.status === 403, `status=${r.status}`);

// cleanup
const ids = (await prisma.user.findMany({ where: { email: { endsWith: "@e2e.ng" } }, select: { id: true } })).map((u) => u.id);
const profIds = (await prisma.studentProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((p) => p.id);
await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
await prisma.session.deleteMany({ where: { userId: { in: ids } } });
await prisma.assessmentAttempt.deleteMany({ where: { studentId: { in: profIds } } });
await prisma.assessmentQuestion.deleteMany({ where: { assessment: { title: { contains: sem } } } });
await prisma.assessment.deleteMany({ where: { title: { contains: sem } } });
await prisma.question.deleteMany({ where: { title: { contains: sem } } });
await prisma.studyEvent.deleteMany({ where: { studentId: { in: profIds } } });
await prisma.enrollment.deleteMany({ where: { studentId: { in: profIds } } });
await prisma.verificationRecord.deleteMany({ where: { studentProfileId: { in: profIds } } });
await prisma.studentProfile.deleteMany({ where: { id: { in: profIds } } });
const lecProfIds = (await prisma.lecturerProfile.findMany({ where: { user: { email: { endsWith: "@e2e.ng" } } }, select: { id: true } })).map((p) => p.id);
await prisma.verificationRecord.deleteMany({ where: { lecturerProfileId: { in: lecProfIds } } });
await prisma.lecturerProfile.deleteMany({ where: { id: { in: lecProfIds } } });
await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e.ng" } } });
await prisma.user.update({ where: { email: "admin@edufarm.ng" }, data: { passwordHash: null } });
await prisma.user.update({ where: { email: "bello@demo-university.edu" }, data: { passwordHash: null } });
console.log(out.join("\n"));
console.log(`INSIGHTS: ${pass} passed, ${fail} failed`);
await prisma.$disconnect();
if (fail > 0) process.exit(1);
