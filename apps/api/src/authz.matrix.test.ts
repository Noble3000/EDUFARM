// Role × resource authorization matrix (auth hardening).
// Runs against the TEST database via fastify.inject (no network).
// Run: $env:DATABASE_URL="postgresql://edufarm:edufarm-dev-local@localhost:5432/edufarm_test"; pnpm --filter @edufarm/api test
import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app.js";

// Matrix suites re-login revoked users, exceeding the 10/min production
// brute-force budget — raise the ceiling for tests only (default stays 10).
process.env.AUTH_LOGIN_MAX = "1000";

const prisma = new PrismaClient();
let app: FastifyInstance;
const S = `m${Date.now()}`;

async function req(method: string, url: string, token?: string, body?: unknown) {
  const res = await app.inject({
    method: method as never,
    url,
    headers: { "content-type": "application/json", ...(token ? { "x-session-token": token } : {}) },
    payload: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.statusCode, body: res.json() as any };
}

async function login(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ email, password }),
  });
  if (res.statusCode !== 200) throw new Error(`login failed for ${email}: ${res.statusCode}`);
  return (res.json() as { sessionToken: string }).sessionToken;
}

let T: Record<string, string>;
let ids: { courseId: string; dept2CourseId: string; materialId: string; questionId: string };
// Hermetic grade users, shared across suites (module scope so every
// describe can use them; initialized in the grades suite's beforeAll).
let GT1 = "";
let GT2 = "";

beforeAll(async () => {
  // Force demo endpoints closed: whatever loads apps/api/.env locally must
  // not leak into test assertions (gate is read per-request).
  delete process.env.ALLOW_DEMO_LOGIN;
  app = await buildApp();
  // --- fixture hierarchy ---
  const uni = await prisma.university.create({ data: { name: `TU-${S}`, slug: `tu-${S}`, verified: true } });
  const fac = await prisma.faculty.create({ data: { universityId: uni.id, name: "F" } });
  const dept = await prisma.department.create({ data: { facultyId: fac.id, name: "D1" } });
  const dept2 = await prisma.department.create({ data: { facultyId: fac.id, name: "D2" } });
  const lvl = await prisma.level.create({ data: { departmentId: dept.id, name: "100" } });
  const lvl2 = await prisma.level.create({ data: { departmentId: dept2.id, name: "100" } });
  const course = await prisma.course.create({ data: { departmentId: dept.id, levelId: lvl.id, code: `T101-${S}`, title: "T", isOfficial: true } });
  const course2 = await prisma.course.create({ data: { departmentId: dept2.id, levelId: lvl2.id, code: `T102-${S}`, title: "T2", isOfficial: true } });
  // --- users ---
  async function mkUser(email: string, role: never, pw = "password123") {
    const { randomBytes, scryptSync } = await import("node:crypto");
    const salt = randomBytes(16).toString("hex");
    const dk = scryptSync(pw, salt, 64).toString("hex");
    return prisma.user.create({ data: { email, name: email, passwordHash: `scrypt$${salt}$${dk}`, role } });
  }
  const stu = await mkUser(`s-${S}@t.ng`, "student" as never);
  await prisma.studentProfile.create({
    data: { userId: stu.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: lvl.id, matricNo: `M-${S}`, verificationStatus: "verified", verifiedAt: new Date() },
  });
  const stuUnv = await mkUser(`su-${S}@t.ng`, "student" as never);
  await prisma.studentProfile.create({
    data: { userId: stuUnv.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: lvl.id, matricNo: `MU-${S}`, verificationStatus: "pending" },
  });
  const stu2 = await mkUser(`s2-${S}@t.ng`, "student" as never);
  await prisma.studentProfile.create({
    data: { userId: stu2.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: lvl.id, matricNo: `M2-${S}`, verificationStatus: "verified", verifiedAt: new Date() },
  });
  const lect = await mkUser(`l-${S}@t.ng`, "lecturer" as never);
  const lectProf = await prisma.lecturerProfile.create({
    data: { userId: lect.id, departmentId: dept.id, staffId: `S-${S}`, verificationStatus: "verified", verifiedAt: new Date() },
  });
  await prisma.courseLecturer.create({ data: { courseId: course.id, lecturerId: lectProf.id, role: "owner" } });
  const lectUnv = await mkUser(`lu-${S}@t.ng`, "lecturer" as never);
  await prisma.lecturerProfile.create({
    data: { userId: lectUnv.id, departmentId: dept2.id, staffId: `SU-${S}`, verificationStatus: "pending" },
  });
  const plat = await mkUser(`p-${S}@t.ng`, "platformAdmin" as never);
  const inst = await mkUser(`i-${S}@t.ng`, "institutionAdmin" as never);
  const deptA = await mkUser(`d-${S}@t.ng`, "deptAdmin" as never);
  // enrollment for verified student
  const sp = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: stu.id } });
  await prisma.enrollment.create({ data: { courseId: course.id, studentId: sp.id, status: "approved" } });
  // material + question fixtures
  const mat = await prisma.material.create({
    data: { courseId: course.id, lecturerId: lectProf.id, title: `M-${S}`, type: "lecture-notes", isFree: true, priceKobo: 0, status: "published", version: 1 },
  });
  const q = await prisma.question.create({ data: { courseId: course.id, authorId: stu2.id, title: `Q-${S}`, body: "b", status: "unanswered" } });
  ids = { courseId: course.id, dept2CourseId: course2.id, materialId: mat.id, questionId: q.id };

  T = {
    stu: await login(`s-${S}@t.ng`, "password123"),
    stuUnv: await login(`su-${S}@t.ng`, "password123"),
    stu2: await login(`s2-${S}@t.ng`, "password123"),
    lect: await login(`l-${S}@t.ng`, "password123"),
    lectUnv: await login(`lu-${S}@t.ng`, "password123"),
    plat: await login(`p-${S}@t.ng`, "password123"),
    inst: await login(`i-${S}@t.ng`, "password123"),
    deptA: await login(`d-${S}@t.ng`, "password123"),
  };
}, 60000);

describe("anonymous", () => {
  it("401 on staff queue without token", async () => {
    expect((await req("GET", "/api/v1/verifications/pending")).status).toBe(401);
  });
  it("401 on student library without token", async () => {
    expect((await req("GET", "/api/v1/library/me")).status).toBe(401);
  });
  it("401 on wrong password", async () => {
    const r = await req("POST", "/api/v1/auth/login", undefined, { email: `s-${S}@t.ng`, password: "nope-nope1" });
    expect(r.status).toBe(401);
  });
  it("403 demo endpoints closed without flag", async () => {
    expect((await req("POST", "/api/v1/demo/login", undefined, { email: "x" })).status).toBe(403);
    expect((await req("GET", "/api/v1/demo/users")).status).toBe(403);
  });
  it("401 on forged user id (legacy header rejected)", async () => {
    const r = await app.inject({ method: "GET", url: "/api/v1/library/me", headers: { "x-user-id": "any-id" } });
    expect(r.statusCode).toBe(401);
  });
  it("401 on garbage token", async () => {
    expect((await req("GET", "/api/v1/points/me", "deadbeef")).status).toBe(401);
  });
});

describe("student boundaries", () => {
  it("403 staff queues", async () => {
    for (const u of ["/api/v1/verifications/pending", "/api/v1/reviews/queue", "/api/v1/disputes", "/api/v1/email/outbox", "/api/v1/settlement/overview"]) {
      expect((await req("GET", u, T.stu)).status).toBe(403);
    }
  });
  it("403 lecturer-only writes", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.stu, { title: "H", type: "lecture-notes" })).status).toBe(403);
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/assessments`, T.stu, { title: "H" })).status).toBe(403);
    expect((await req("POST", "/api/v1/points/recognize", T.stu, { studentId: "x" })).status).toBe(403);
  });
  it("unverified student blocked from enrollment", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/enroll`, T.stuUnv, {})).status).toBe(403);
  });
  it("cannot resolve another student's question", async () => {
    expect((await req("POST", `/api/v1/questions/${ids.questionId}/resolve`, T.stu, {})).status).toBe(403);
  });
  it("own reads work", async () => {
    expect((await req("GET", "/api/v1/library/me", T.stu)).status).toBe(200);
    expect((await req("GET", "/api/v1/points/me", T.stu)).status).toBe(200);
    expect((await req("GET", "/api/v1/grades/me", T.stu)).status).toBe(200);
  });
  it("logout invalidates session", async () => {
    const t = T.stu;
    expect((await req("POST", "/api/v1/auth/logout", t, {})).status).toBe(200);
    expect((await req("GET", "/api/v1/library/me", t)).status).toBe(401);
    T.stu = await login(`s-${S}@t.ng`, "password123"); // re-login for later suites
  });
});

describe("lecturer boundaries", () => {
  it("unverified lecturer cannot create materials", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.lectUnv, { title: "H", type: "lecture-notes" })).status).toBe(403);
  });
  it("verified lecturer cannot write outside own department", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.dept2CourseId}/materials`, T.lect, { title: "H", type: "lecture-notes" })).status).toBe(403);
  });
  it("verified lecturer creates in own course", async () => {
    const r = await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.lect, { title: `T-${S}`, type: "lecture-notes" });
    expect(r.status).toBe(200);
  });
  it("lecturer blocked from platform-admin ops", async () => {
    expect((await req("POST", "/api/v1/settlement/run", T.lect, {})).status).toBe(403);
    expect((await req("GET", "/api/v1/email/outbox", T.lect)).status).toBe(403);
  });
});

describe("staff boundaries", () => {
  it("deptAdmin denied course writes (fail closed)", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.deptA, { title: "H", type: "lecture-notes" })).status).toBe(403);
  });
  it("institutionAdmin can review materials", async () => {
    expect((await req("GET", "/api/v1/reviews/queue", T.inst)).status).toBe(200);
  });
  it("platformAdmin suspends → sessions die", async () => {
    const stu = await prisma.user.findFirst({ where: { email: `s2-${S}@t.ng` } });
    const susp = await req("POST", `/api/v1/admin/users/${stu!.id}/suspend`, T.plat, {});
    expect(susp.status).toBe(200);
    expect((await req("GET", "/api/v1/library/me", T.stu2)).status).toBe(401);
    expect((await req("POST", `/api/v1/admin/users/${stu!.id}/unsuspend`, T.plat, {})).status).toBe(200);
    // Unsuspend does NOT resurrect killed sessions by design — re-login for later suites.
    T.stu2 = await login(`s2-${S}@t.ng`, "password123");
  });
  it("platformAdmin cannot suspend self", async () => {
    const me = await prisma.user.findFirst({ where: { email: `p-${S}@t.ng` } });
    expect((await req("POST", `/api/v1/admin/users/${me!.id}/suspend`, T.plat, {})).status).toBe(400);
  });
});

describe("verification enforced at API", () => {
  it("student sees own verification state", async () => {
    const me = await req("GET", "/api/v1/verifications/me", T.stuUnv);
    expect(me.status).toBe(200);
    expect(me.body.studentProfile.verificationStatus).toBe("pending");
  });
});

describe("material lifecycle", () => {
  let mid: string;
  it("lecturer upload lands in pendingLecturer (not published)", async () => {
    const r = await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.lect, {
      title: `LC-${Date.now()}`, type: "lecture-notes",
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("pendingLecturer");
    expect(r.body.version).toBe(0);
    mid = r.body.id;
  });
  it("invalid type rejected", async () => {
    const r = await req("POST", `/api/v1/courses/${ids.courseId}/materials`, T.lect, {
      title: "Bad type", type: "podcast",
    });
    expect(r.status).toBe(400);
  });
  it("approval requires attestation", async () => {
    expect((await req("POST", `/api/v1/materials/${mid}/approve`, T.lect, {})).status).toBe(400);
  });
  it("student cannot approve", async () => {
    expect((await req("POST", `/api/v1/materials/${mid}/approve`, T.stu, { attest: true })).status).toBe(403);
  });
  it("approve → pendingReview, review approve → published v1", async () => {
    expect((await req("POST", `/api/v1/materials/${mid}/approve`, T.lect, { attest: true })).status).toBe(200);
    const rev = await req("POST", `/api/v1/materials/${mid}/review`, T.plat, { decision: "approve" });
    expect(rev.status).toBe(200);
    expect(rev.body.status).toBe("published");
  });
  it("double approve rejected", async () => {
    expect((await req("POST", `/api/v1/materials/${mid}/approve`, T.lect, { attest: true })).status).toBe(400);
  });
  it("new version stages v2, live stays v1", async () => {
    const nv = await req("POST", `/api/v1/materials/${mid}/new-version`, T.lect, { fileKey: "t.pdf" });
    expect(nv.status).toBe(200);
    expect(nv.body.status).toBe("pendingReview");
    expect(nv.body.version).toBe(1);
    expect(nv.body.pendingVersion).toBe(2);
  });
  it("reject restores published v1 and drops staged row", async () => {
    const rej = await req("POST", `/api/v1/materials/${mid}/review`, T.plat, { decision: "reject", reason: "typo" });
    expect(rej.status).toBe(200);
    expect(rej.body.status).toBe("published");
    expect(rej.body.version).toBe(1);
    expect(rej.body.pendingVersion).toBeNull();
  });
  it("approve v2 goes live", async () => {
    await req("POST", `/api/v1/materials/${mid}/new-version`, T.lect, { fileKey: "t2.pdf" });
    const rev = await req("POST", `/api/v1/materials/${mid}/review`, T.plat, { decision: "approve" });
    expect(rev.body.version).toBe(2);
  });
  it("archived editions block reading", async () => {
    expect((await req("POST", `/api/v1/materials/${mid}/archive`, T.lect, {})).status).toBe(200);
    expect((await req("GET", `/api/v1/materials/${mid}/pages/1/url`, T.lect)).status).toBe(403);
  });
  it("signed page tokens verify and expire", async () => {
    const { mintPageToken, verifyPageToken } = await import("./routes/storage.js");
    const { token } = mintPageToken("m", 1, 1);
    const ok = verifyPageToken(token);
    expect(ok?.materialId).toBe("m");
    // tamper a middle character (trailing junk is ignored by base64 decoding)
    const mid = Math.floor(token.length / 2);
    const bad = token.slice(0, mid) + (token[mid] === "A" ? "B" : "A") + token.slice(mid + 1);
    expect(verifyPageToken(bad)).toBeNull();
    expect(verifyPageToken("garbage")).toBeNull();
  });
});

describe("grades privacy (student-only, no lecturer/admin read path)", () => {
  // hermetic grade users (immune to earlier logout tests killing shared tokens)
  beforeAll(async () => {
    async function mkGradeStudent(email: string, matric: string) {
      const { randomBytes, scryptSync } = await import("node:crypto");
      const salt = randomBytes(16).toString("hex");
      const dk = scryptSync("password123", salt, 64).toString("hex");
      const u = await prisma.user.create({
        data: { email, name: email, passwordHash: `scrypt$${salt}$${dk}`, role: "student" as never },
      });
      const uni = await prisma.university.create({ data: { name: `GU-${S}-${email}`, slug: `gu-${S}-${email}`, verified: true } });
      const fac = await prisma.faculty.create({ data: { universityId: uni.id, name: "F" } });
      const dept = await prisma.department.create({ data: { facultyId: fac.id, name: "D" } });
      const lvl = await prisma.level.create({ data: { departmentId: dept.id, name: "100" } });
      await prisma.studentProfile.create({
        data: { userId: u.id, universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: lvl.id, matricNo: matric, verificationStatus: "verified", verifiedAt: new Date() },
      });
      return login(email, "password123");
    }
    GT1 = await mkGradeStudent(`g1-${S}@t.ng`, `GM1-${S}`);
    GT2 = await mkGradeStudent(`g2-${S}@t.ng`, `GM2-${S}`);
  });

  it("lecturer cannot read grades", async () => {
    expect((await req("GET", "/api/v1/grades/me", T.lect)).status).toBe(401);
  });
  it("admins cannot read grades", async () => {
    for (const t of [T.plat, T.inst, T.deptA]) {
      expect((await req("GET", "/api/v1/grades/me", t)).status).toBe(401);
    }
  });
  it("anonymous cannot read grades", async () => {
    expect((await req("GET", "/api/v1/grades/me")).status).toBe(401);
  });
  it("lecturer cannot write grades", async () => {
    expect((await req("POST", "/api/v1/grades/semesters", T.lect, { name: "X" })).status).toBe(401);
  });
  it("one student cannot touch another's semester", async () => {
    const sem = await req("POST", "/api/v1/grades/semesters", GT1, { name: `G-${S}` });
    expect(sem.status).toBe(200);
    const id = (sem.body as { id: string }).id;
    expect((await req("PATCH", `/api/v1/grades/semesters/${id}`, GT2, { name: "Hijack" })).status).toBe(404);
    expect((await req("DELETE", `/api/v1/grades/semesters/${id}`, GT2, {})).status).toBe(404);
    expect((await req("DELETE", `/api/v1/grades/semesters/${id}`, GT1, {})).status).toBe(200);
  });
  it("validation rejects impossible values", async () => {
    expect((await req("POST", "/api/v1/grades/semesters", GT1, { name: "   " })).status).toBe(400);
    const sem = await req("POST", "/api/v1/grades/semesters", GT1, { name: `V-${S}` });
    const id = (sem.body as { id: string }).id;
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: "X 1", units: 0, grade: "A" })).status).toBe(400);
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: "X 1", units: 13, grade: "A" })).status).toBe(400);
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: "X 1", units: 2.5, grade: "A" })).status).toBe(400);
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: "X 1", units: 3, grade: "G" })).status).toBe(400);
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: "   ", units: 3, grade: "A" })).status).toBe(400);
    const ok = await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: `x 9-${S}`, units: 3, grade: "b" });
    expect(ok.status).toBe(200);
    expect((ok.body as { code: string; grade: string }).code).toBe(`X 9-${S}`.toUpperCase());
    expect((ok.body as { code: string; grade: string }).grade).toBe("B");
    const cid = (ok.body as { id: string }).id;
    expect((await req("POST", `/api/v1/grades/semesters/${id}/courses`, GT1, { code: `x 9-${S}`, units: 3, grade: "A" })).status).toBe(400);
    expect((await req("PATCH", `/api/v1/grades/courses/${cid}`, GT1, { units: 0 })).status).toBe(400);
    expect((await req("PATCH", `/api/v1/grades/courses/${cid}`, GT2, { grade: "A" })).status).toBe(404);
    expect((await req("PATCH", `/api/v1/grades/courses/${cid}`, GT1, { grade: "A" })).status).toBe(200);
    expect((await req("DELETE", `/api/v1/grades/semesters/${id}`, GT1, {})).status).toBe(200);
  });
});

describe("assessment workflow guarantees", () => {
  let aid: string;
  beforeAll(async () => {
    // GT1/GT2 live in their own hierarchy — enroll GT1 in the workflow course.
    const u = await prisma.user.findUnique({ where: { email: `g1-${S}@t.ng` }, include: { studentProfile: true } });
    await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: ids.courseId, studentId: u!.studentProfile!.id } },
      update: { status: "approved" },
      create: { courseId: ids.courseId, studentId: u!.studentProfile!.id, status: "approved" },
    });
  });
  it("lecturer creates test with instructions + timing + attempts cap", async () => {
    const r = await req("POST", `/api/v1/courses/${ids.courseId}/assessments`, T.lect, {
      title: `WF-${Date.now()}`, type: "test", instructions: "Show workings.",
      timeLimitMin: 30, maxAttempts: 2,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(r.status).toBe(200);
    expect(r.body.timeLimitMin).toBe(30);
    expect(r.body.gradesReleased).toBe(false);
    aid = r.body.id;
  });
  it("invalid type/timing rejected", async () => {
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/assessments`, T.lect, { title: "X", type: "exam" })).status).toBe(400);
    expect((await req("POST", `/api/v1/courses/${ids.courseId}/assessments`, T.lect, { title: "X", timeLimitMin: 9999 })).status).toBe(400);
  });
  it("theory question + marks; published locks questions", async () => {
    const q = await req("POST", `/api/v1/assessments/${aid}/questions`, T.lect, { text: "Explain.", kind: "theory", marks: 5 });
    expect(q.status).toBe(200);
    const m = await req("POST", `/api/v1/assessments/${aid}/questions`, T.lect, { text: "2+2?", kind: "mcq", options: ["3", "4"], correctIndex: 1, marks: 2 });
    expect(m.status).toBe(200);
    expect((await req("POST", `/api/v1/assessments/${aid}/publish`, T.lect, {})).status).toBe(200);
    expect((await req("POST", `/api/v1/assessments/${aid}/questions`, T.lect, { text: "Late", kind: "theory" })).status).toBe(400);
  });
  it("student cannot publish/close/release", async () => {
    for (const a of ["publish", "close", "release"]) {
      expect((await req("POST", `/api/v1/assessments/${aid}/${a}`, GT1, {})).status).toBe(403);
    }
  });
  it("start resumes in-progress attempt (no fork)", async () => {
    const s1 = await req("POST", `/api/v1/assessments/${aid}/start`, GT1, {});
    expect(s1.status).toBe(200);
    expect(s1.body.resumed).toBe(false);
    const s2 = await req("POST", `/api/v1/assessments/${aid}/start`, GT1, {});
    expect(s2.body.resumed).toBe(true);
    expect(s2.body.attempt.id).toBe(s1.body.attempt.id);
  });
  it("submit once; double submit rejected", async () => {
    const list = await req("GET", `/api/v1/courses/${ids.courseId}/assessments`, GT1);
    const full = list.body.find((a: any) => a.id === aid);
    const mcq = full.questions.find((q: any) => q.kind === "mcq");
    const th = full.questions.find((q: any) => q.kind === "theory");
    expect(full.questions.every((q: any) => q.correctIndex === undefined)).toBe(true);
    const st = await req("POST", `/api/v1/assessments/${aid}/start`, GT1, {});
    const sub = await req("POST", `/api/v1/attempts/${st.body.attempt.id}/submit`, GT1, {
      answers: [
        { questionId: mcq.id, selectedIndex: 1 },
        { questionId: th.id, body: "Because." },
      ],
    });
    expect(sub.status).toBe(200);
    expect(sub.body.status).toBe("submitted");
    const dup = await req("POST", `/api/v1/attempts/${st.body.attempt.id}/submit`, GT1, { answers: [] });
    expect(dup.status).toBe(400);
  });
  it("results hidden until release; lecturer grades with audit; release reveals", async () => {
    const mine = await req("GET", `/api/v1/assessments/${aid}/attempts/me`, GT1);
    const att = mine.body.find((a: any) => a.status === "submitted");
    expect(att.score).toBeNull();
    const all = await req("GET", `/api/v1/assessments/${aid}/attempts`, T.lect);
    const target = all.body.find((a: any) => a.id === att.id);
    expect(target.student.user.email).toContain("@t.ng");
    const th = target.answers.find((a: any) => a.question.kind === "theory");
    const g = await req("POST", `/api/v1/attempts/${att.id}/grade`, T.lect, {
      marks: [{ questionId: th.questionId, marksAwarded: 4 }], feedback: "Good depth.",
    });
    expect(g.status).toBe(200);
    expect(g.body.gradedBy).toBeTruthy();
    expect(g.body.gradedAt).toBeTruthy();
    const still = await req("GET", `/api/v1/assessments/${aid}/attempts/me`, GT1);
    expect(still.body.find((a: any) => a.id === att.id).score).toBeNull();
    expect((await req("POST", `/api/v1/assessments/${aid}/release`, T.lect, {})).status).toBe(200);
    const now = await req("GET", `/api/v1/assessments/${aid}/attempts/me`, GT1);
    const vis = now.body.find((a: any) => a.id === att.id);
    expect(vis.score).toBe(6);
    expect(vis.feedback).toBe("Good depth.");
  });
  it("cross-course lecturer blocked from attempts + grade", async () => {
    expect((await req("GET", `/api/v1/assessments/${aid}/attempts`, T.deptA)).status).toBe(403);
  });
  it("student cannot view another student's attempt", async () => {
    const mine = await req("GET", `/api/v1/assessments/${aid}/attempts/me`, GT1);
    const id = mine.body[0]?.id;
    if (id) {
      const other = await req("GET", `/api/v1/attempts/${id}`, GT2);
      expect(other.status).toBe(404);
    }
  });
  it("close hides from students; reopen restores", async () => {
    expect((await req("POST", `/api/v1/assessments/${aid}/close`, T.lect, {})).status).toBe(200);
    const list = await req("GET", `/api/v1/courses/${ids.courseId}/assessments`, GT1);
    expect(list.body.find((a: any) => a.id === aid)).toBeUndefined();
    expect((await req("POST", `/api/v1/assessments/${aid}/reopen`, T.lect, {})).status).toBe(200);
    const list2 = await req("GET", `/api/v1/courses/${ids.courseId}/assessments`, GT1);
    expect(list2.body.find((a: any) => a.id === aid)).toBeTruthy();
  });
});
