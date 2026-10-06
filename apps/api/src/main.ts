// EDUFARM API entry: build + listen (local-first).
// All wiring lives in app.ts so matrix tests can import buildApp() directly.
// Boot order: wait for Postgres (retry/backoff) → build app → listen →
// signal PM2 readiness (wait_ready) → recover orphaned jobs. SIGTERM/SIGINT
// shut down gracefully (drain Fastify, disconnect Prisma).
import { buildApp } from "./app.js";
import { prisma } from "./db.js";

async function waitForDb(tries = 30): Promise<void> {
  for (let i = 1; i <= tries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      if (i > 1) console.log(`[boot] postgres ready after ${i} tries`);
      return;
    } catch (e) {
      const wait = Math.min(1000 * i, 5000);
      console.log(`[boot] postgres not ready (try ${i}/${tries}): ${(e as Error).message.slice(0, 120)} — retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("Postgres never became ready — refusing to boot half-alive.");
}

async function recoverOrphanedJobs(): Promise<void> {
  // Rows claimed (`sending`) by a process that died before finishing must go
  // back to the queue. Event-key/idempotency-key uniques make re-sending and
  // re-settling safe — recovery can never double-grant or double-email.
  const emails = await prisma.emailLog.updateMany({
    where: { status: "sending" },
    data: { status: "queued", nextRetryAt: null },
  });
  const deadSessions = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  const staleOrders = await prisma.paymentOrder.count({
    where: { status: "processing", updatedAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
  });
  console.log(`[boot] recovered ${emails.count} orphaned email claims + pruned ${deadSessions.count} expired sessions; ${staleOrders} stale processing orders left for webhook settlement (never force-paid)`);
}

const app = await buildApp();
const port = Number(process.env.API_PORT ?? 4000);

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} — draining…`);
  try {
    await app.close();
  } catch (e) {
    console.error("[shutdown] fastify close failed", e);
  }
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error("[shutdown] prisma disconnect failed", e);
  }
  console.log("[shutdown] clean exit");
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await waitForDb();
await recoverOrphanedJobs();
await app.listen({ port, host: "0.0.0.0" });
console.log(`[boot] edufarm-api listening on :${port}`);
if (typeof process.send === "function") process.send("ready");
