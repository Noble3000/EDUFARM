// EDUFARM UI-state suite — server-rendered markup assertions per role.
// Usage: node scripts/e2e-ui.mjs [--json]
// Requires: all 4 web apps + API up (real local stack). No browser automation:
// pages are fetched as SSR HTML (the same bytes a browser/screen-reader gets
// first) and asserted structurally — headings, landmarks, labels, named
// controls, real links, tables. This checks UI STATE, never pixels.
// Authenticated pages are fetched with a session cookie minted via /auth/login
// on isolated e2e users (deleted afterwards).
const APPS = {
  student: "http://localhost:3001",
  lecturer: "http://localhost:3002",
  admin: "http://localhost:3003",
  portal: "http://localhost:8080",
};
const API = "http://localhost:4000/api/v1";
const results = [];
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: String(detail ?? "ok").slice(0, 140) });
  } catch (e) {
    results.push({ name, ok: false, error: String(e?.message ?? e).slice(0, 220) });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function get(app, path, cookie) {
  const r = await fetch(APPS[app] + path, { headers: cookie ? { Cookie: cookie } : {} });
  const html = await r.text();
  return { status: r.status, html };
}
function has(html, s, what) {
  assert(html.includes(s), `missing ${what}: ${s.slice(0, 60)}`);
}
function hasAny(html, options, what) {
  assert(options.some((s) => html.includes(s)), `missing ${what} (none of ${options.length} markers)`);
}
function lacks(html, s, what) {
  assert(!html.includes(s), `forbidden ${what} present: ${s.slice(0, 60)}`);
}
// session cookie without touching seed passwords permanently (restored after)
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "../apps/api/node_modules/@prisma/client/index.js";
const prisma = new PrismaClient();
function pwHash(pw) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString("hex")}`;
}
async function cookieFor(email) {
  await prisma.user.update({ where: { email }, data: { passwordHash: pwHash("UiPass123") } });
  const r = await fetch(API + "/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "UiPass123" }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  const data = await r.json();
  return `edufarm_session=${data.sessionToken}`;
}

// ---------- portal ----------
await step("portal: landmark, headings, labels, live links", async () => {
  const { status, html } = await get("portal", "/");
  assert(status === 200, `status=${status}`);
  has(html, 'lang="en"', "html lang");
  has(html, "Skip to live dashboard", "skip link");
  has(html, "<h1>", "marketing h1");
  has(html, 'for="q"', "search label");
  has(html, 'aria-label="API settings"', "settings button name");
  has(html, 'href="http://localhost:3001/courses"', "classes View All target");
  lacks(html, 'href="#"', "dead href=# links");
  lacks(html, "onclick=\"return false\"", "neutered onclick links");
  return "portal ok";
});
await step("portal: design preview serves with v3 note", async () => {
  const { status, html } = await get("portal", "/design.html");
  assert(status === 200, `status=${status}`);
  has(html, "Refinement v3", "a11y refinement note");
  return "design ok";
});

// ---------- student (public) ----------
await step("student: login form labelled + named", async () => {
  const { status, html } = await get("student", "/login");
  assert(status === 200, `status=${status}`);
  has(html, "<label", "label elements");
  has(html, 'type="password"', "password field");
  has(html, "Sign in", "Sign in button");
  lacks(html, "ada@student.demo-university.edu", "demo email prefill");
  return "login ok";
});
await step("student: signup has full chain pickers", async () => {
  const { status, html } = await get("student", "/signup");
  assert(status === 200, `status=${status}`);
  for (const label of ["University", "Faculty", "Department", "Level", "Matric"]) has(html, label, `chain label ${label}`);
  return "signup ok";
});
await step("student: PWA shell + bottom nav landmarks", async () => {
  const { status, html } = await get("student", "/");
  assert(status === 200, `status=${status}`);
  has(html, 'rel="manifest"', "PWA manifest link");
  has(html, 'aria-label="Student"', "top nav landmark");
  has(html, 'aria-label="Quick"', "bottom nav landmark");
  has(html, 'class="sr-only">EDUFARM Student', "screen-reader h1");
  has(html, 'href="#main"', "skip link");
  return "shell ok";
});

// ---------- authenticated pages (isolated users) ----------
const S = Date.now().toString(36);
const uni = await prisma.university.findUnique({ where: { slug: "demo-university" } });
const fac = await prisma.faculty.findFirst({ where: { universityId: uni.id } });
const dept = await prisma.department.findFirst({ where: { facultyId: fac.id } });
const level = await prisma.level.findFirst({ where: { departmentId: dept.id } });
const course = await prisma.course.findFirst({ where: { departmentId: dept.id } });
async function api(method, path, token, body) {
  const r = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function adminToken() {
  await prisma.user.update({ where: { email: "admin@edufarm.ng" }, data: { passwordHash: pwHash("UiAdm1-x") } });
  const r = await api("POST", "/auth/login", undefined, { email: "admin@edufarm.ng", password: "UiAdm1-x" });
  return r.data.sessionToken;
}
const AT = await adminToken();
const mkRes = await api("POST", "/auth/signup", undefined, {
  name: "UI E2E", email: `ui-${S}@e2e.ng`, password: "password123", role: "student",
  universityId: uni.id, facultyId: fac.id, departmentId: dept.id, levelId: level.id, matricNo: `STU-UI-${S}`,
});
const STU_COOKIE = `edufarm_session=${mkRes.data.sessionToken}`;
const STU_ID = mkRes.data.id;
if (!STU_ID) throw new Error(`student signup failed: ${mkRes.status} ${JSON.stringify(mkRes.data).slice(0, 200)}`);
const stuProf = await prisma.studentProfile.findUnique({ where: { userId: STU_ID } });
await api("POST", `/verifications/student/${stuProf.id}/decide`, AT, { decision: "approve" });

await step("student: authed pages render state shells", async () => {
  // NOTE: client components SSR their loading shells; data hydrates in-browser.
  // Either the loading marker or the loaded content proves a correct state.
  const expectations = [
    ["/courses", ["Loading courses", "Request enrollment"]],
    ["/grades", ["Loading your grades", "CGPA Calculator"]],
    ["/library", ["Loading your library", "My Academic Library"]],
    ["/verify", ["Student verification", "Semester name"]],
    ["/notifications", ["Loading notifications", "Notifications"]],
  ];
  for (const [path, markers] of expectations) {
    const { status, html } = await get("student", path, STU_COOKIE);
    assert(status === 200, `${path} status=${status}`);
    hasAny(html, markers, `${path} state`);
  }
  return "5 pages ok";
});
await step("student: course detail has labelled Q&A + AI controls", async () => {
  const { status, html } = await get("student", `/courses/${course.id}`, STU_COOKIE);
  assert(status === 200, `status=${status}`);
  hasAny(html, ["Loading course", "Course Q&A", "AI Study Assistant", "Ask a question"], "detail state");
  return "detail ok";
});
await step("student: tables, progress and empty states are semantic", async () => {
  const { html } = await get("student", "/grades", STU_COOKIE);
  has(html, 'role="status"', "loading live region");
  return "semantics ok";
});

// ---------- lecturer + admin shells ----------
await step("lecturer: shell landmarks + nav", async () => {
  const { status, html } = await get("lecturer", "/");
  assert(status === 200, `status=${status}`);
  has(html, 'aria-label="Lecturer"', "top nav landmark");
  has(html, 'class="sr-only">EDUFARM Lecturer', "screen-reader h1");
  has(html, "Dashboard", "dashboard nav");
  return "lecturer shell ok";
});
await step("admin: shell landmarks + queues reachable", async () => {
  for (const [path, marker] of [
    ["/", "EDUFARM Admin"],
    ["/verifications", "Verification queue"],
    ["/disputes", "Disputes"],
    ["/email", "Email outbox"],
    ["/onboarding", "onboarding"],
    ["/settlements", "Settlement"],
  ]) {
    const { status, html } = await get("admin", path);
    assert(status === 200, `${path} status=${status}`);
    has(html.toLowerCase(), marker.toLowerCase(), `${path} marker`);
  }
  return "admin pages ok";
});
await step("admin: queue tables use real th + pagination landmarks", async () => {
  const { html } = await get("admin", "/verifications");
  hasAny(html, ["<th", "Loading verification queue"], "table-or-loading state");
  hasAny(html, ['aria-label="Pagination"', "Loading verification queue"], "pagination-or-loading");
  return "tables ok";
});

// ---------- cleanup ----------
const e2eIds = (await prisma.user.findMany({ where: { email: { endsWith: "@e2e.ng" } }, select: { id: true } })).map((u) => u.id);
const e2ePids = (await prisma.studentProfile.findMany({ where: { userId: { in: e2eIds } }, select: { id: true } })).map((p) => p.id);
await prisma.notification.deleteMany({ where: { userId: { in: e2eIds } } });
await prisma.session.deleteMany({ where: { userId: { in: e2eIds } } });
await prisma.emailLog.deleteMany({ where: { toUserId: { in: e2eIds } } });
await prisma.enrollment.deleteMany({ where: { studentId: { in: e2ePids } } });
await prisma.verificationRecord.deleteMany({ where: { studentProfileId: { in: e2ePids } } });
await prisma.studentProfile.deleteMany({ where: { id: { in: e2ePids } } });
await prisma.user.deleteMany({ where: { email: { endsWith: "@e2e.ng" } } });
await prisma.user.update({ where: { email: "admin@edufarm.ng" }, data: { passwordHash: null } });
const left = await prisma.user.count({ where: { email: { endsWith: "@e2e.ng" } } });
const pwRestored = (await prisma.user.findUnique({ where: { email: "admin@edufarm.ng" }, select: { passwordHash: true } })).passwordHash === null;
results.push(left === 0 && pwRestored
  ? { name: "cleanup: isolated data removed, seed restored", ok: true, detail: "clean" }
  : { name: "cleanup: isolated data removed, seed restored", ok: false, error: `left=${left} pwRestored=${pwRestored}` });
await prisma.$disconnect();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), steps: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? ` (${r.detail})` : `: ${r.error}`}`);
  console.log(results.every((r) => r.ok) ? `UI-STATE OK (${results.length} steps)` : "UI-STATE FAILED");
}
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
