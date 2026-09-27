// Reviews + disputes Phase 2b (§15–16).
// Reviews: eligible after meaningful access (completed purchase OR ≥3 dwell events).
// Lecturer can reply. Report → Dispute (no auto-takedown).
// Disputes: report → review → resolve (+ appeal note). Admin queue with timeline via AuditLog.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

async function hasMeaningfulAccess(studentId: string, materialId: string): Promise<boolean> {
  const purchase = await prisma.purchase.findFirst({ where: { studentId, materialId, status: "completed" } });
  if (purchase) return true;
  const dwells = await prisma.studyEvent.count({ where: { studentId, materialId, type: "page-dwell", durationSec: { gte: 8 } } });
  return dwells >= 3;
}

export async function reviewRoutes(app: FastifyInstance) {
  app.post("/materials/:id/reviews", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { rating: number; body?: string };
    if (!b.rating || b.rating < 1 || b.rating > 5) return reply.code(400).send({ error: "rating 1–5 required." });
    if (!(await hasMeaningfulAccess(user.studentProfile.id, id)))
      return reply.code(403).send({ error: "Meaningful access required before reviewing." });
    return prisma.review.create({
      data: { materialId: id, studentId: user.studentProfile.id, rating: b.rating, body: b.body },
    });
  });

  app.get("/materials/:id/reviews", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.review.findMany({
      where: { materialId: id, status: "visible" },
      include: { replies: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/reviews/:id/reply", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { body: string };
    if (!b.body) return reply.code(400).send({ error: "body required." });
    const isLecturer = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role);
    return prisma.reviewReply.create({ data: { reviewId: id, authorId: user.id, isLecturer, body: b.body } });
  });

  app.post("/reviews/:id/report", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { reason?: string };
    const dispute = await prisma.dispute.create({
      data: { reporterId: user.id, targetType: "Review", targetId: id, reason: b.reason ?? "reported", status: "open" },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "dispute.opened", targetType: "Dispute", targetId: dispute.id },
    });
    return dispute;
  });

  // generic content report (material / user)
  app.post("/reports", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = req.body as { targetType: string; targetId: string; reason: string };
    if (!b.targetType || !b.targetId || !b.reason) return reply.code(400).send({ error: "targetType + targetId + reason required." });
    const dispute = await prisma.dispute.create({
      data: { reporterId: user.id, targetType: b.targetType, targetId: b.targetId, reason: b.reason, status: "open" },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "dispute.opened", targetType: "Dispute", targetId: dispute.id },
    });
    return dispute;
  });

  app.get("/disputes", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Admins only." });
    return prisma.dispute.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  });

  app.post("/disputes/:id/resolve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Admins only." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { resolution?: string };
    const updated = await prisma.dispute.update({
      where: { id }, data: { status: "resolved", resolution: b.resolution ?? null },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "dispute.resolved", targetType: "Dispute", targetId: id, meta: b.resolution ?? null },
    });
    return updated;
  });
}
