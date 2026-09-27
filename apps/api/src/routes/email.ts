// Email outbox Phase 2b (§17): every meaningful event writes an EmailLog row.
// Dev transport = logged + server console. Prod: Resend/Postmark worker drains `logged` rows.
// logEmail() is fire-and-forget (never breaks the main transaction).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

export async function logEmail(toUserId: string, subject: string, body: string): Promise<void> {
  try {
    await prisma.emailLog.create({ data: { toUserId, subject, body, status: "logged" } });
    console.log(`[email] to=${toUserId} subject=${subject}`);
  } catch (e) {
    console.error("[email] failed", e);
  }
}

export async function emailRoutes(app: FastifyInstance) {
  app.get("/email/outbox", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    return prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  });
}
