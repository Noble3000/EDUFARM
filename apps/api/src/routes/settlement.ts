// eSpees settlement Phase 2b (§13.3): pending → available → settled.
// HOLD_DAYS (default 7) after purchase before funds become available.
// Admin runs settlement; payouts recorded in audit + lecturer notified.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";

const HOLD_DAYS = Number(process.env.SETTLEMENT_HOLD_DAYS ?? 7);

export async function settlementRoutes(app: FastifyInstance) {
  app.get("/settlement/overview", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Admins only." });
    const entries = await prisma.eSpeesLedger.findMany({});
    const sum = (s: string) => entries.filter((e) => e.status === s).reduce((t, e) => t + e.lecturerShareKobo, 0);
    return { pendingKobo: sum("pending"), availableKobo: sum("available"), settledKobo: sum("settled"), holdDays: HOLD_DAYS };
  });

  // flip matured pending → available
  app.post("/settlement/run", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const cutoff = new Date(Date.now() - HOLD_DAYS * 86400_000);
    const r = await prisma.eSpeesLedger.updateMany({
      where: { status: "pending", createdAt: { lt: cutoff } },
      data: { status: "available" },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "settlement.run", targetType: "ESpeesLedger", targetId: `released:${r.count}` },
    });
    return { released: r.count };
  });

  // pay out available → settled (bank transfer ref recorded in audit)
  app.post("/settlement/pay", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const b = (req.body ?? {}) as { lecturerId?: string; reference?: string };
    const due = await prisma.eSpeesLedger.findMany({
      where: { status: "available", ...(b.lecturerId ? { lecturerId: b.lecturerId } : {}) },
    });
    if (!due.length) return { settled: 0, totalKobo: 0 };
    await prisma.eSpeesLedger.updateMany({
      where: { id: { in: due.map((d) => d.id) } },
      data: { status: "settled" },
    });
    const total = due.reduce((s, d) => s + d.lecturerShareKobo, 0);
    await prisma.auditLog.create({
      data: {
        actorId: user.id, action: "settlement.pay", targetType: "ESpeesLedger",
        targetId: `${due.length} entries`, meta: `ref=${b.reference ?? "dev-cash"} total=${total}`,
      },
    });
    const lecturerIds = [...new Set(due.map((d) => d.lecturerId))];
    for (const lid of lecturerIds) {
      const prof = await prisma.lecturerProfile.findFirst({ where: { id: lid } });
      if (prof) {
        await prisma.notification.create({
          data: {
            userId: prof.userId, type: "settlement",
            title: "Settlement paid", body: `Ref ${b.reference ?? "dev-cash"}. Check earnings dashboard.`,
          },
        });
      }
    }
    return { settled: due.length, totalKobo: total };
  });
}
