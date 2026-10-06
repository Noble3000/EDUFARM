// EDUFARM operational report: health + process state + memory + CPU + ports +
// database health + API latency. Complements scripts/healthcheck.mjs (which
// only checks HTTP reachability).
// Usage: node scripts/ops-report.mjs [--json]
// Exit 0 = all checks pass, 1 = any failure. Zero dependencies (node:os,
// node:net, node:child_process + the repo's own PM2).
import os from "node:os";
import net from "node:net";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PM2 = path.join(ROOT, "node_modules", "pm2", "bin", "pm2");
const EXPECTED = ["edufarm-api", "web-student", "web-lecturer", "web-admin", "portal-static"];
const PORTS = { "edufarm-api": 4000, "web-student": 3001, "web-lecturer": 3002, "web-admin": 3003, "portal-static": 8080 };
const MEM_CAP_MB = { "edufarm-api": 450, "web-student": 400, "web-lecturer": 400, "web-admin": 400, "portal-static": 200 };
const LATENCY_BUDGET_MS = { health: 1500, ready: 4000 };

const report = { ok: true, at: new Date().toISOString(), system: {}, processes: [], ports: [], api: {} };
function fail(msg) {
  report.ok = false;
  report.failures = [...(report.failures ?? []), msg];
}

// --- system ---
{
  const total = os.totalmem();
  const free = os.freemem();
  report.system = {
    cpus: os.cpus().length,
    load1: os.loadavg()[0].toFixed(2),
    memTotalMB: Math.round(total / 1048576),
    memFreeMB: Math.round(free / 1048576),
    memUsedPct: Math.round(((total - free) / total) * 100),
  };
  if ((total - free) / total > 0.94) fail("system RAM over 94% — Windows OOM-killer risk (see Docs/OPERATIONS.md)");
}

// --- pm2 process state ---
let procs = [];
try {
  const raw = execFileSync(process.execPath, [PM2, "jlist"], { encoding: "utf8", timeout: 15000 });
  procs = JSON.parse(raw);
} catch (e) {
  fail(`pm2 jlist failed: ${String(e.message).slice(0, 160)}`);
}
for (const name of EXPECTED) {
  const p = procs.find((x) => x.name === name);
  if (!p) {
    fail(`process missing: ${name}`);
    report.processes.push({ name, status: "missing", ok: false });
    continue;
  }
  const memMB = Math.round((p.monit?.memory ?? 0) / 1048576);
  const status = p.pm2_env?.status;
  const restarts = p.pm2_env?.restart_time ?? 0;
  const uptimeSec = status === "online" ? Math.round((Date.now() - (p.pm2_env?.pm_uptime ?? Date.now())) / 1000) : 0;
  // Fail on: not online, over memory cap, or flapping (many restarts + tiny uptime).
  // High restart counts alone are normal on a box with frequent local redeploys.
  const flapping = restarts >= 10 && uptimeSec < 120;
  const ok = status === "online" && memMB <= (MEM_CAP_MB[name] ?? 450) && !flapping;
  if (status !== "online") fail(`process not online: ${name} status=${status}`);
  if (memMB > (MEM_CAP_MB[name] ?? 450)) fail(`process over memory cap: ${name} mem=${memMB}MB (cap, not a target — investigate before raising)`);
  if (flapping) fail(`process flapping: ${name} restarts=${restarts} uptime=${uptimeSec}s`);
  if (restarts >= 25) report.warnings = [...(report.warnings ?? []), `${name} has ${restarts} restarts (redeploys?) — watch, not fatal`];
  report.processes.push({
    name, status: p.pm2_env?.status, ok,
    pid: p.pid, uptimeSec,
    cpuPct: p.monit?.cpu ?? null, memMB,
    memCapMB: MEM_CAP_MB[name] ?? null,
    restarts,
  });
}

// --- ports ---
async function tcpOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: "127.0.0.1", port, timeout: 3000 });
    s.on("connect", () => { s.end(); resolve(true); });
    s.on("timeout", () => { s.destroy(); resolve(false); });
    s.on("error", () => resolve(false));
  });
}
for (const [name, port] of Object.entries(PORTS)) {
  const open = await tcpOpen(port);
  if (!open) fail(`port closed: ${name} :${port}`);
  report.ports.push({ name, port, open, ok: open });
}

// --- api latency + db health (via /health and /ready) ---
async function timed(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url);
    const body = await r.json().catch(() => ({}));
    return { status: r.status, ms: Date.now() - t0, body };
  } catch (e) {
    return { status: "CONNREFUSED", ms: Date.now() - t0, error: String(e.cause ?? e.message).slice(0, 140) };
  }
}
{
  const h = await timed("http://localhost:4000/health");
  const okH = h.status === 200 && h.ms <= LATENCY_BUDGET_MS.health;
  if (!okH) fail(`api /health bad: status=${h.status} ms=${h.ms}`);
  const r = await timed("http://localhost:4000/ready");
  const okR = r.status === 200 && r.body?.ready === true && r.ms <= LATENCY_BUDGET_MS.ready;
  if (!okR) fail(`api /ready bad: status=${r.status} ms=${r.ms} body=${JSON.stringify(r.body).slice(0, 160)}`);
  report.api = {
    health: { status: h.status, ms: h.ms, ok: okH, uptimeSec: h.body?.uptimeSec ?? null, memoryMB: h.body?.memoryMB ?? null },
    ready: { status: r.status, ms: r.ms, ok: okR, dbMs: r.body?.dbMs ?? null, cache: r.body?.cache ?? null },
  };
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`system: ${report.system.cpus} cpu load=${report.system.load1} ram=${report.system.memUsedPct}% free=${report.system.memFreeMB}MB`);
  for (const p of report.processes) console.log(`${p.ok ? "PASS" : "FAIL"} proc ${p.name}: ${p.status} pid=${p.pid} up=${p.uptimeSec}s cpu=${p.cpuPct}% mem=${p.memMB}/${p.memCapMB}MB restarts=${p.restarts}`);
  for (const p of report.ports) console.log(`${p.ok ? "PASS" : "FAIL"} port ${p.name} :${p.port} ${p.open ? "open" : "CLOSED"}`);
  console.log(`${report.api.health.ok ? "PASS" : "FAIL"} api /health ${report.api.health.status} ${report.api.health.ms}ms`);
  console.log(`${report.api.ready.ok ? "PASS" : "FAIL"} api /ready ${report.api.ready.status} ${report.api.ready.ms}ms db=${report.api.ready.dbMs}ms cache=${JSON.stringify(report.api.ready.cache)}`);
  console.log(report.ok ? "OPS-REPORT OK" : `OPS-REPORT FAILED: ${(report.failures ?? []).join(" | ")}`);
  if (report.warnings?.length) console.log(`warnings: ${report.warnings.join(" | ")}`);
}
process.exitCode = report.ok ? 0 : 1;
