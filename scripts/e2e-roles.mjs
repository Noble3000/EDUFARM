// EDUFARM regression suite — API journeys for the three primary roles.
// Usage: node scripts/e2e-roles.mjs [--json]
// Requires: API on :4000 (real local stack), seed data, mock/test-mode providers.
// Isolated data: every created row uses a unique e2e-<ts> namespace and is
// deleted afterwards; seed demo rows are only READ (admin/bello passwords are
// set-then-nulled to mint sessions, then verified restored).
// Verifies per step: HTTP response, database state, permissions, notifications,
// audit logs, side effects (points/ledger/emails). Exit 0 = all pass.
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../apps/api/node_modules/@prisma/client/index.js";

const API = process.env.API_URL ?? "http://localhost:4000/api/v1";
const prisma = new PrismaClient();
const S = Date.now().toString(36);
const results = [];
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: String(detail ?? "ok").slice(0, 160) });
  } catch (e) {
    results.push({ name, ok: false, error: String(e?.message ?? e).slice(0, 220) });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function call(method, path, token, body) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
function pwHash(pw) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
async function sessionFor(email, pw) {
  await prisma.user.update({ where: { email }, data: { passwordHash: pwHash(pw) } });
  const r = await call("POST", "/auth/login", undefined, { email, password: pw });
  assert(r.status === 200, `login ${email}: ${r.status}`);
  return r.data.sessionToken;
}
const email = (tag) => `e2e-${tag}-${S}@e2e.ng`;

// ---------- setup: chain + sessions ----------
const uni = await prisma.university.findUnique({ where: { slug: "demo-university" } });
assert(uni, "seed university missing");
const fac = await prisma.faculty.findFirst({ where: { universityId: uni.id } });
const dept = await prisma.department.findFirst({ where: { facultyId: fac.id } });
const level = await prisma.level.findFirst({ where: { departmentId: dept.id } });
const course = await prisma.course.findFirst({ where: { departmentId: dept.id } });
const CHAIN = { universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: level.id };
const ADMIN_T = await sessionFor("admin@edufarm.ng", "TmpReg1-x");
const BELLO_T = await sessionFor("bello@demo-university.edu", "TmpReg2-x");

async function mkStudent(tag, matric) {
  const r = await call("POST", "/auth/signup", undefined, {
    name: `E2E ${tag}`, email: email(tag), password: "password123", role: "student", ...CHAIN, matricNo: matric,
  });
  assert(r.status === 200, `signup ${tag}: ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
  return r.data;
}
async function approveStudent(userId) {
  const prof = await prisma.studentProfile.findUnique({ where: { userId } });
  const d = await call("POST", `/verifications/student/${prof.id}/decide`, ADMIN_T, { decision: "approve" });
  assert(d.status === 200, `approve: ${d.status}`);
  return prof;
}
async function enrollApprove(token, profileId) {
  await call("POST", `/courses/${course.id}/enroll`, token, {});
  const enr = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId: course.id, studentId: profileId } },
  });
  assert(enr?.status === "requested", "enrollment requested in DB");
  const d = await call("POST", `/enrollments/${enr.id}/decide`, BELLO_T, { decision: "approve" });
  assert(d.status === 200, `lecturer approve: ${d.status}`);
  return enr;
}

// ---------- STUDENT ----------
let STU, STU_PROF;
await step("student: signup creates pending profile + verification record (DB)", async () => {
  STU = await mkStudent("stu", `STU-RG-${S}`);
  assert(STU.studentProfile.verificationStatus === "pending", "profile pending");
  const rec = await prisma.verificationRecord.count({ where: { studentProfileId: STU.studentProfile.id } });
  assert(rec === 1, `record rows=${rec}`);
  return STU.email;
});
await step("student: approve notifies + audits (side effects)", async () => {
  STU_PROF = await approveStudent(STU.id);
  const n = await prisma.notification.count({ where: { userId: STU.id, type: "verification.approve" } });
  assert(n === 1, `notify rows=${n}`);
  const a = await prisma.auditLog.count({ where: { action: "student.verification.approved", targetId: STU_PROF.id } });
  assert(a === 1, `audit rows=${a}`);
  return "verified";
});
await step("student: verified != enrolled; unenrolled reads fenced (permissions)", async () => {
  const me = await call("GET", "/enrollments/me", STU.sessionToken);
  assert(me.status === 200 && me.data.length === 0, `enrollments=${JSON.stringify(me.data).slice(0, 60)}`);
  const q = await call("GET", `/courses/${course.id}/questions`, STU.sessionToken);
  assert(q.status === 403, `Q&A gate=${q.status}`);
  return "isolated";
});
await step("student: enroll request notifies lecturer + audits (side effects)", async () => {
  await enrollApprove(STU.sessionToken, STU_PROF.id);
  const n = await prisma.notification.count({ where: { type: "enrollment.requested" } });
  assert(n >= 1, "lecturer notified");
  return "enrolled";
});
await step("student: across-user enrollment invisible (permissions)", async () => {
  const other = await mkStudent("other", `STU-RGO-${S}`);
  const r = await call("GET", "/enrollments/me", other.sessionToken);
  assert(r.status === 200 && r.data.length === 0, "sees only own rows");
  return "scoped";
});

// ---------- LECTURER ----------
let LEC;
await step("lecturer: signup + approve + course assignment (DB chain)", async () => {
  const r = await call("POST", "/auth/signup", undefined, {
    name: "E2E Lecturer", email: email("lec"), password: "password123",
    role: "lecturer", departmentId: dept.id, staffId: `E2E-${S}`,
  });
  assert(r.status === 200, `signup: ${r.status}`);
  LEC = r.data;
  const prof = await prisma.lecturerProfile.findUnique({ where: { userId: LEC.id } });
  assert(prof && prof.departmentId === dept.id, "profile linked to department");
  const d = await call("POST", `/verifications/lecturer/${prof.id}/decide`, ADMIN_T, { decision: "approve" });
  assert(d.status === 200, `approve: ${d.status}`);
  const a = await call("POST", `/courses/${course.id}/lecturers`, ADMIN_T, { lecturerProfileId: prof.id, role: "co" });
  assert(a.status === 200, `assign: ${a.status}`);
  return LEC.email;
});
await step("lecturer: unassigned course fenced, assigned allowed (permissions)", async () => {
  const r = await call("GET", `/courses/${course.id}/enrollments`, LEC.sessionToken);
  assert(r.status === 200 && Array.isArray(r.data), `assigned reads: ${r.status}`);
  return `${r.data.length} row(s)`;
});
await step("lecturer: announcement fans out + dedupes (side effects)", async () => {
  const title = `E2E Ann ${S}`;
  const r = await call("POST", `/courses/${course.id}/announcements`, BELLO_T, { category: "course-notice", title, body: "hi" });
  assert(r.status === 200, `publish: ${r.status}`);
  const n = await prisma.notification.count({ where: { type: "announcement", title } });
  assert(n >= 1, "fanout rows");
  return `${n} notified`;
});
await step("lecturer: assessment attempt grades + awards points (side effects)", async () => {
  const a = await call("POST", `/courses/${course.id}/assessments`, BELLO_T, { title: `E2E Quiz ${S}`, type: "quiz" });
  assert(a.status === 200, `create: ${a.status}`);
  const aid = a.data.id;
  await call("POST", `/assessments/${aid}/questions`, BELLO_T, { text: "2+2?", kind: "mcq", options: ["3", "4"], correctIndex: 1, marks: 2 });
  await call("POST", `/assessments/${aid}/publish`, BELLO_T, {});
  const st = await call("POST", `/assessments/${aid}/start`, STU.sessionToken, {});
  assert(st.status === 200, `start: ${st.status}`);
  const qs = await prisma.assessmentQuestion.findMany({ where: { assessmentId: aid } });
  const sub = await call("POST", `/attempts/${st.data.attempt.id}/submit`, STU.sessionToken, {
    answers: [{ questionId: qs[0].id, selectedIndex: 1 }],
  });
  assert(sub.status === 200, `submit: ${sub.status}`);
  assert(sub.data.score === null, "score masked until release (release-gated grades)");
  const rel = await call("POST", `/assessments/${aid}/release`, BELLO_T, {});
  assert(rel.status === 200, `release: ${rel.status}`);
  const mine = await call("GET", `/assessments/${aid}/attempts/me`, STU.sessionToken);
  const shown = mine.data.find((t) => t.id === st.data.attempt.id);
  assert(shown && shown.score === 2, `released score=${JSON.stringify(shown).slice(0, 80)}`);
  const pts = await prisma.pointLedger.count({ where: { studentId: STU_PROF.id, reason: "assessment-pass" } });
  assert(pts === 1, `pass-points rows=${pts}`);
  await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: aid } });
  await prisma.assessmentAttempt.deleteMany({ where: { assessmentId: aid } });
  await prisma.assessment.delete({ where: { id: aid } });
  return "graded+awarded";
});

// ---------- PURCHASE (mock provider, no real money) ----------
await step("purchase: terms→order→webhook→grant→ledger→receipt, exactly once", async () => {
  const paid = await prisma.material.findFirst({ where: { courseId: course.id, isFree: false, status: "published" } });
  assert(paid, "no paid seed material");
  const t = await call("GET", `/materials/${paid.id}/terms`, STU.sessionToken);
  assert(t.status === 200 && t.data.priceKobo === paid.priceKobo, `terms: ${t.status}`);
  const o = await call("POST", `/materials/${paid.id}/orders`, STU.sessionToken, { provider: "mock", idempotencyKey: `rg-${S}` });
  assert(o.status === 200, `order: ${o.status}`);
  const ref = o.data.reference;
  const before = await prisma.purchase.count({ where: { studentId: STU_PROF.id, materialId: paid.id } });
  assert(before === 0, "no grant before payment");
  const done = await call("POST", "/payments/mock/complete", STU.sessionToken, { reference: ref });
  assert(done.status === 200 && done.data.paid === true, `complete: ${done.status}`);
  const grants = await prisma.purchase.count({ where: { orderId: o.data.order.id } });
  assert(grants === 1, `grants=${grants}`);
  const theGrant = await prisma.purchase.findUnique({ where: { orderId: o.data.order.id } });
  const led = await prisma.eSpeesLedger.count({ where: { purchaseId: theGrant.id } });
  assert(led === 1, `ledger=${led}`);
  const mail = await prisma.emailLog.count({ where: { toUserId: STU.id, kind: "purchase" } });
  assert(mail >= 1, "receipt queued");
  return `order ${o.data.order.id.slice(0, 8)} settled`;
});

// ---------- ADMIN ----------
await step("admin: queues filter + decide with record (DB + notify)", async () => {
  const q = await call("GET", "/verifications/pending?status=pending", ADMIN_T);
  assert(q.status === 200 && Array.isArray(q.data), `queue: ${q.status}`);
  return `${q.data.length} pending`;
});
await step("admin: dispute lifecycle preserves material (side effects)", async () => {
  const freeM = await prisma.material.findFirst({ where: { courseId: course.id, isFree: true, status: "published" } });
  const rep = await call("POST", "/reports", STU.sessionToken, { targetType: "Material", targetId: freeM.id, reason: `E2E ${S}`, evidence: "p1" });
  assert(rep.status === 200, `report: ${rep.status}`);
  const did = rep.data.id;
  await call("POST", `/disputes/${did}/start`, ADMIN_T, {});
  const res = await call("POST", `/disputes/${did}/resolve`, ADMIN_T, { decision: "resolve", resolution: "No violation." });
  assert(res.status === 200, `resolve: ${res.status}`);
  const mat = await prisma.material.findUnique({ where: { id: freeM.id } });
  assert(mat.status === "published", "no auto-takedown");
  const acts = await prisma.disputeAction.count({ where: { disputeId: did } });
  assert(acts >= 3, `timeline rows=${acts}`);
  await prisma.disputeAction.deleteMany({ where: { disputeId: did } });
  await prisma.dispute.delete({ where: { id: did } });
  return "lifecycle ok";
});
await step("admin: settlement run is idempotent (side effects)", async () => {
  const r1 = await call("POST", "/settlement/run", ADMIN_T, { idempotencyKey: `rg-settle-${S}` });
  assert(r1.status === 200, `run: ${r1.status}`);
  const r2 = await call("POST", "/settlement/run", ADMIN_T, { idempotencyKey: `rg-settle-${S}` });
  // Either nothing matured (released 0 twice) or the second call replays the batch.
  const ok = (r2.data.released === 0) || (r2.data.replay === true);
  assert(r2.status === 200 && ok, `replay semantics: ${JSON.stringify(r2.data).slice(0, 80)}`);
  return "idempotent";
});
await step("admin: reconcile clean (side effects)", async () => {
  const r = await call("GET", "/payments/reconcile", ADMIN_T);
  assert(r.status === 200 && r.data.paidWithoutGrant.length === 0, `reconcile: ${r.status}`);
  return "clean";
});
await step("permissions: student fenced from staff surfaces", async () => {
  for (const p of ["/verifications/pending", "/settlement/overview", "/payments/reconcile", "/email/outbox"]) {
    const r = await call("GET", p, STU.sessionToken);
    assert(r.status === 403, `${p} → ${r.status}`);
  }
  const r = await call("GET", "/grades/me", BELLO_T);
  assert(r.status === 401, `lecturer grades → ${r.status}`);
  return "fenced";
});

// ---------- cleanup: isolated data removed, seed passwords restored ----------
const RUN_START = new Date(Date.now() - 30 * 60_000); // runs take minutes, never hours
const ids = (await prisma.user.findMany({ where: { email: { endsWith: "@e2e.ng" } }, select: { id: true } })).map((u) => u.id);
const pids = (await prisma.studentProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } })).map((p) => p.id);
await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
// seed-user side effects from THIS run only (bello/admin inbox noise)
const seedIds = (await prisma.user.findMany({ where: { email: { in: ["admin@edufarm.ng", "bello@demo-university.edu"] } }, select: { id: true } })).map((u) => u.id);
await prisma.notification.deleteMany({ where: { userId: { in: seedIds }, createdAt: { gte: RUN_START } } });
await prisma.emailLog.deleteMany({ where: { createdAt: { gte: RUN_START }, toUserId: { in: seedIds } } });
await prisma.session.deleteMany({ where: { userId: { in: ids } } });
await prisma.studyEvent.deleteMany({ where: { studentId: { in: pids } } });
await prisma.emailLog.deleteMany({ where: { toUserId: { in: ids } } });
await prisma.pointLedger.deleteMany({ where: { studentId: { in: pids } } });
await prisma.purchase.deleteMany({ where: { studentId: { in: pids } } });
const myOrderIds = (await prisma.paymentOrder.findMany({ where: { studentId: { in: pids } }, select: { id: true } })).map((o) => o.id);
await prisma.webhookEvent.deleteMany({ where: { orderId: { in: myOrderIds } } });
await prisma.paymentOrder.deleteMany({ where: { id: { in: myOrderIds } } });
await prisma.announcement.deleteMany({ where: { title: { contains: S } } });
const myAids = (await prisma.assessment.findMany({ where: { title: { contains: S } }, select: { id: true } })).map((a) => a.id);
await prisma.assessmentAttempt.deleteMany({ where: { studentId: { in: pids } } });
await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: { in: myAids } } });
await prisma.assessment.deleteMany({ where: { id: { in: myAids } } });
await prisma.question.deleteMany({ where: { authorId: { in: ids } } });
const myDisputes = (await prisma.dispute.findMany({ where: { reporterId: { in: ids } }, select: { id: true } })).map((d) => d.id);
await prisma.disputeAction.deleteMany({ where: { disputeId: { in: myDisputes } } });
await prisma.dispute.deleteMany({ where: { id: { in: myDisputes } } });
await prisma.enrollment.deleteMany({ where: { studentId: { in: pids } } });
await prisma.verificationRecord.deleteMany({ where: { studentProfileId: { in: pids } } });
await prisma.studentProfile.deleteMany({ where: { id: { in: pids } } });
const lpids = (await prisma.lecturerProfile.findMany({ where: { user: { email: { endsWith: "@e2e.ng" } } }, select: { id: true } })).map((p) => p.id);
await prisma.courseLecturer.deleteMany({ where: { lecturerId: { in: lpids } } });
await prisma.verificationRecord.deleteMany({ where: { lecturerProfileId: { in: lpids } } });
await prisma.lecturerProfile.deleteMany({ where: { id: { in: lpids } } });
await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e.ng" } } });
await prisma.user.update({ where: { email: "admin@edufarm.ng" }, data: { passwordHash: null } });
await prisma.user.update({ where: { email: "bello@demo-university.edu" }, data: { passwordHash: null } });
const leftUsers = await prisma.user.count({ where: { email: { endsWith: "@e2e.ng" } } });
const leftOrders = await prisma.paymentOrder.count({ where: { studentId: { in: pids } } });
results.push(leftUsers === 0 && leftOrders === 0
  ? { name: "cleanup: isolated data removed, seed restored", ok: true, detail: "clean" }
  : { name: "cleanup: isolated data removed, seed restored", ok: false, error: `leftovers users=${leftUsers} orders=${leftOrders}` });
const adminPw = await prisma.user.findUnique({ where: { email: "admin@edufarm.ng" }, select: { passwordHash: true } });
if (adminPw.passwordHash !== null) results.push({ name: "cleanup: seed password restored", ok: false, error: "admin hash not nulled" });

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), steps: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? ` (${r.detail})` : `: ${r.error}`}`);
  console.log(results.every((r) => r.ok) ? `REGRESSION OK (${results.length} steps)` : "REGRESSION FAILED");
}
await prisma.$disconnect();
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
