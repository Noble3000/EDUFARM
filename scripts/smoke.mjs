// Baseline smoke test: role logins + one entitled read per role.
// Usage: node scripts/smoke.mjs [--json]
// Exit 0 = all pass, 1 = any failure. Requires API on :4000 with seed data.
// Uses passwordless demo/login (see FINAL_AUDIT P0 — gate before shared use).
const API = "http://localhost:4000/api/v1";

const results = [];
async function step(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message ?? e).slice(0, 200) });
  }
}

async function post(path, body, userId) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${data.error ?? ""}`.trim());
  return data;
}

async function get(path, userId) {
  const r = await fetch(API + path, { headers: userId ? { "x-user-id": userId } : {} });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${data.error ?? ""}`.trim());
  return data;
}

const student = await post("/demo/login", { email: "ada@student.demo-university.edu" }).catch(() => null);
const lecturer = await post("/demo/login", { email: "bello@demo-university.edu" }).catch(() => null);
const admin = await post("/demo/login", { email: "admin@edufarm.ng" }).catch(() => null);

await step("student login", async () => {
  if (!student || student.role !== "student") throw new Error("no student session");
  return student.email;
});
await step("lecturer login", async () => {
  if (!lecturer || lecturer.role !== "lecturer") throw new Error("no lecturer session");
  return lecturer.email;
});
await step("admin login", async () => {
  if (!admin || admin.role !== "platformAdmin") throw new Error("no admin session");
  return admin.email;
});
await step("student enrollments", async () => {
  const e = await get("/enrollments/me", student.id);
  if (!e.length) throw new Error("no enrollments");
  return `${e.length} enrollment(s), first=${e[0].status}`;
});
await step("student library", async () => {
  const l = await get("/library/me", student.id);
  return `purchased=${l.purchases.length} free=${l.freeMaterials.length}`;
});
await step("student points", async () => {
  const p = await get("/points/me", student.id);
  return `balance=${p.balance}`;
});
await step("lecturer earnings", async () => {
  const e = await get("/earnings/me", lecturer.id);
  return `pendingKobo=${e.pendingKobo}`;
});
await step("admin verification queue", async () => {
  const q = await get("/verifications/pending?type=student", admin.id);
  return Array.isArray(q) ? `${q.length} pending` : "unexpected shape";
});
await step("devotional today", async () => {
  const d = await get("/devotional/today");
  if (d.empty) throw new Error("no devotional seeded");
  return d.title;
});

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), steps: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? ` (${r.detail})` : `: ${r.error}`}`);
  console.log(results.every((r) => r.ok) ? "SMOKE OK" : "SMOKE FAILED");
}
// NOTE: set exitCode and let the loop drain instead of process.exit() —
// forced exit with live fetch sockets crashes Node on Windows (libuv assertion).
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
