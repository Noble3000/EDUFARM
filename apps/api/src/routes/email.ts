// Email outbox (§17): every meaningful event queues an EmailLog row via
// notify/center (event-key idempotent). Sending runs through the provider
// adapter (mock|resend|sendgrid|smtp) with retry backoff and failed-delivery
// state. logEmail() keeps its old signature and never breaks callers.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { drainOutbox, queueEmail } from "../notify/center.js";
import { isTestMode } from "../payments/providers.js";

export async function logEmail(
  toUserId: string,
  subject: string,
  body: string,
  opts?: { kind?: string; eventKey?: string }
): Promise<void> {
  try {
    await queueEmail({ toUserId, subject, body, kind: opts?.kind, eventKey: opts?.eventKey });
  } catch (e) {
    console.error("[email] queue failed", e);
  }
}

export async function emailRoutes(app: FastifyInstance) {
  app.get("/email/outbox", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const q = req.query as { status?: string; kind?: string };
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.kind) where.kind = q.kind;
    return prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  });

  // retry a failed row (re-queues; eventKey still guards duplicates)
  app.post("/email/:id/retry", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const { id } = req.params as { id: string };
    const row = await prisma.emailLog.findUnique({ where: { id } });
    if (!row) return reply.code(404).send({ error: "Not found." });
    if (row.status !== "failed") return reply.code(400).send({ error: `Only failed rows retry (now ${row.status}).` });
    return prisma.emailLog.update({
      where: { id }, data: { status: "queued", attempts: 0, lastError: null, nextRetryAt: null },
    });
  });

  // drain due rows now (admin trigger for local-first ops; force skips backoff in test mode only)
  app.post("/email/drain", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const q = req.query as { force?: string; limit?: string };
    const force = q.force === "true" && isTestMode();
    return drainOutbox(Math.min(Number(q.limit ?? 25) || 25, 100), force);
  });
}
