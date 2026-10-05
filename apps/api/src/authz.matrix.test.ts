// Role × resource authorization matrix (auth hardening).
// Runs against the TEST database via fastify.inject (no network).
// Run: $env:DATABASE_URL="postgresql://edufarm:edufarm-dev-local@localhost:5432/edufarm_test"; pnpm --filter @edufarm/api test
import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "./app.js";

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
  return { status: res.statusCode, body: res.json() as { error?: string } & Record<string, any> };
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
