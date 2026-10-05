// Payments E2E (mock provider): 11-step sequence, exactly-once under replay,
// no client trust, tampered webhooks rejected, reconciliation clean.
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const API = "http://localhost:4000/api/v1";
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const out: string[] = [];
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; out.push(`PASS ${name}`); } else { fail++; out.push(`FAIL ${name} ${extra}`); }
}
async function call(method: string, path: string, token?: string, body?: unknown, rawHeaders?: Record<string, string>) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(rawHeaders ?? {}) },
    body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
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
const admin = await sessionFor("admin@edufarm.ng", "TmpP1-x");
const uni = await prisma.university.findUnique({ where: { slug: "demo-university" } });
const fac = await prisma.faculty.findFirst({ where: { universityId: uni!.id } });
const dept = await prisma.department.findFirst({ where: { facultyId: fac!.id } });
const level = await prisma.level.findFirst({ where: { departmentId: dept!.id } });
const course = await prisma.course.findFirst({ where: { departmentId: dept!.id } });
const CHAIN = { universityId: uni!.id, facultyId: fac!.id, departmentId: dept!.id, levelId: level!.id };
const sem = Date.now().toString(36);

// student setup: signup → approve → enroll → approve
let r = await call("POST", "/auth/signup", undefined, { name: "Pay E2E", email: `pay-${sem}@e2e.ng`, password: "password123", role: "student", ...CHAIN, matricNo: `STU-PAY-${sem}` });
const ST = (r.data as { sessionToken: string }).sessionToken;
const stuId = (r.data as { id: string }).id;
const prof = await prisma.studentProfile.findUnique({ where: { userId: stuId } });
await call("POST", `/verifications/student/${prof!.id}/decide`, admin.sessionToken, { decision: "approve" });
await call("POST", `/courses/${course!.id}/enroll`, ST, {});
const enr = await prisma.enrollment.findUnique({ where: { courseId_studentId: { courseId: course!.id, studentId: prof!.id } } });
const bello = await sessionFor("bello@demo-university.edu", "TmpP2-x");
await call("POST", `/enrollments/${enr!.id}/decide`, bello.sessionToken, { decision: "approve" });
const paid = await prisma.material.findFirst({ where: { courseId: course!.id, isFree: false, status: "published" } });
if (!paid) throw new Error("no paid seed material");

// 1+2. terms then order pending (no grant, no charge)
r = await call("GET", `/materials/${paid.id}/terms`, ST);
check("terms shown pre-payment", r.status === 200 && (r.data as { priceKobo?: number }).priceKobo === paid.priceKobo, `status=${r.status}`);
r = await call("POST", `/materials/${paid.id}/orders`, ST, { provider: "mock", idempotencyKey: `idem-${sem}` });
const reference = (r.data as { reference?: string }).reference;
const orderId = (r.data as { order?: { id: string; status: string } }).order?.id;
check("order pending + initialized", r.status === 200 && (r.data as { order?: { status: string } }).order?.status === "processing" && !!reference && !!(r.data as { authorizationUrl?: string }).authorizationUrl, `status=${r.status}`);
// idempotent retry with same key
const rDup = await call("POST", `/materials/${paid.id}/orders`, ST, { provider: "mock", idempotencyKey: `idem-${sem}` });
check("idempotency key reuses order", rDup.status === 200 && (rDup.data as { order?: { id: string } }).order?.id === orderId, `status=${rDup.status}`);
// 402 before payment; no grant rows
r = await call("GET", `/materials/${paid.id}/pages/1/url`, ST);
check("denied before payment", r.status === 402, `status=${r.status}`);
check("no purchase pre-payment", (await prisma.purchase.count({ where: { studentId: prof!.id, materialId: paid.id } })) === 0);

// 4+5+6. mock user pays → signed webhook through pipeline
r = await call("POST", "/payments/mock/complete", ST, { reference });
check("mock payment accepted", r.status === 200 && (r.data as { paid?: boolean }).paid === true, `status=${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
// 8+9+10. exactly once: one paid order, one purchase, one ledger
const paidOrders = await prisma.paymentOrder.count({ where: { id: orderId, status: "paid" } });
const theGrant = await prisma.purchase.findUnique({ where: { orderId } });
const grants = theGrant ? 1 : 0;
const ledgers = theGrant ? await prisma.eSpeesLedger.count({ where: { purchaseId: theGrant.id } }) : 0;
check("exactly-once settlement", paidOrders === 1 && grants === 1 && ledgers === 1, `o=${paidOrders} g=${grants} l=${ledgers}`);
r = await call("GET", `/materials/${paid.id}/pages/1/url`, ST);
check("page allowed post-payment", r.status === 200, `status=${r.status}`);
// order status + callback report paid, never grant from redirect
r = await call("GET", `/payments/orders/${orderId}`, ST);
check("order status paid + purchase linked", (r.data as { order?: { status: string }; purchaseId?: string }).order?.status === "paid" && !!(r.data as { purchaseId?: string }).purchaseId, `status=${r.status}`);
r = await call("GET", `/payments/callback?order=${orderId}`, ST);
check("callback reports, not grants", r.status === 200 && (r.data as { status?: string }).status === "paid");

// replay same webhook → absorbed, still exactly one of each
const secret = process.env.MOCK_WEBHOOK_SECRET ?? "dev-mock-secret-change-me";
const evt = JSON.stringify({ event: "charge.success", eventId: `evt_${reference}`, reference, amountKobo: paid.priceKobo, orderId });
const sig = createHmac("sha256", secret).update(evt).digest("hex");
for (let i = 0; i < 3; i++) {
  r = await call("POST", "/payments/webhook/mock", undefined, evt, { "x-mock-signature": sig, "Content-Type": "application/json" });
  if (!(r.status === 200 && (r.data as { replay?: boolean }).replay === true)) break;
}
check("webhook replays absorbed", r.status === 200, `status=${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
const g2 = await prisma.purchase.findUnique({ where: { orderId } });
const l2 = g2 ? await prisma.eSpeesLedger.count({ where: { purchaseId: g2.id } }) : 0;
check("still exactly one grant+ledger", !!g2 && l2 === 1);

// tampered signature → 400, no state change
r = await call("POST", "/payments/webhook/mock", undefined, evt, { "x-mock-signature": "deadbeef", "Content-Type": "application/json" });
check("tampered webhook rejected", r.status === 400, `status=${r.status}`);
// forged paid=true body is meaningless (no such field accepted anywhere)
r = await call("POST", `/materials/${paid.id}/orders`, ST, { provider: "mock", idempotencyKey: `idem2-${sem}`, paid: true } as unknown as Record<string, unknown>);
check("client paid flag ignored (order stays unpaid)", r.status === 200 && (r.data as { order?: { status: string } }).order?.status !== "paid", `status=${r.status}`);
// unknown provider + unknown order fenced
r = await call("POST", "/payments/webhook/nope", undefined, evt, { "x-mock-signature": sig });
check("unknown provider 404", r.status === 404, `status=${r.status}`);
r = await call("GET", "/payments/orders/does-not-exist", ST);
check("unknown order 404", r.status === 404, `status=${r.status}`);

// legacy checkout still works end-to-end via pipeline (mock test mode)
r = await call("POST", `/materials/${paid.id}/checkout`, ST, {});
check("legacy checkout grants via pipeline", r.status === 200 && !!(r.data as { id?: string }).id, `status=${r.status} ${JSON.stringify(r.data).slice(0, 140)}`);

// reconciliation clean
r = await call("GET", "/payments/reconcile", admin.sessionToken);
const rec = r.data as { paidWithoutGrant?: unknown[]; invalidSignatureEvents?: number; byStatus?: unknown };
check("reconcile clean", r.status === 200 && Array.isArray(rec.paidWithoutGrant) && rec.paidWithoutGrant.length === 0, `status=${r.status} ${JSON.stringify(rec.paidWithoutGrant)}`);
r = await call("GET", "/payments/reconcile", ST);
check("reconcile staff-only", r.status === 403, `status=${r.status}`);

// cleanup
const ids = (await prisma.user.findMany({ where: { email: { endsWith: "@e2e.ng" } }, select: { id: true } })).map((u) => u.id);
const myOrders = await prisma.paymentOrder.findMany({ where: { student: { user: { email: { endsWith: "@e2e.ng" } } } }, select: { id: true } });
const myOrderIds = myOrders.map((o) => o.id);
await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
await prisma.session.deleteMany({ where: { userId: { in: ids } } });
await prisma.purchase.deleteMany({ where: { student: { user: { email: { endsWith: "@e2e.ng" } } } } });
await prisma.paymentOrder.deleteMany({ where: { id: { in: myOrderIds } } });
await prisma.webhookEvent.deleteMany({ where: { orderId: { in: myOrderIds } } });
await prisma.webhookEvent.deleteMany({ where: { provider: "mock", eventType: "invalid-signature" } });
await prisma.enrollment.deleteMany({ where: { student: { user: { email: { endsWith: "@e2e.ng" } } } } });
await prisma.verificationRecord.deleteMany({ where: { studentProfile: { user: { email: { endsWith: "@e2e.ng" } } } } });
await prisma.studentProfile.deleteMany({ where: { user: { email: { endsWith: "@e2e.ng" } } } });
await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e.ng" } } });
await prisma.user.update({ where: { email: "admin@edufarm.ng" }, data: { passwordHash: null } });
await prisma.user.update({ where: { email: "bello@demo-university.edu" }, data: { passwordHash: null } });
console.log(out.join("\n"));
console.log(`PAYMENTS: ${pass} passed, ${fail} failed`);
await prisma.$disconnect();
if (fail > 0) process.exit(1);
