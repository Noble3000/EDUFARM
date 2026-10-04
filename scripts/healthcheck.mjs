// Baseline healthcheck: verifies core processes are reachable.
// Usage: node scripts/healthcheck.mjs [--json]
// Exit 0 = all healthy, 1 = any failure. No dependencies (Node 20+ fetch).
const CHECKS = [
  { name: "api", url: "http://localhost:4000/health", expect: 200 },
  { name: "web-student", url: "http://localhost:3001/", expect: 200 },
  { name: "web-lecturer", url: "http://localhost:3002/", expect: 200 },
  { name: "web-admin", url: "http://localhost:3003/", expect: 200 },
  { name: "portal-static", url: "http://localhost:8080/", expect: 200 },
];

const results = [];
for (const c of CHECKS) {
  const t0 = Date.now();
  try {
    const r = await fetch(c.url);
    const ok = r.status === c.expect;
    results.push({ ...c, status: r.status, ms: Date.now() - t0, ok });
  } catch (e) {
    results.push({ ...c, status: "CONNREFUSED", ms: Date.now() - t0, ok: false, error: String(e.cause ?? e.message).slice(0, 120) });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ ok: results.every((r) => r.ok), checks: results }, null, 2));
} else {
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} ${r.url} -> ${r.status} (${r.ms}ms)${r.error ? " " + r.error : ""}`);
  console.log(results.every((r) => r.ok) ? "HEALTHCHECK OK" : "HEALTHCHECK FAILED");
}
// NOTE: set exitCode and let the loop drain instead of process.exit() —
// forced exit with live fetch sockets crashes Node on Windows (libuv assertion).
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
