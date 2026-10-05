// eSpees settlement as internal accounting (§13.3) — NOT a payment rail.
// State machine: pending → available → settled. Entries are append-only;
// money moves by linking rows to SettlementBatch periods, never by editing.
// Runs are idempotent (state filters + idempotency keys); every movement
// carries an audit row. Split/conversion/schedule stay configurable
// (see settlement-policy.ts TODOs) until business sign-off.

import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { audit, sessionUser as currentUser } from "../authz.js";
import { SETTLEMENT_POLICY, nextPeriodEstimate } from "../settlement-policy.js";

export async function settlementRoutes(app: FastifyInstance) {
  app.get("/settlement/overview", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:admin" });
    const entries = await prisma.eSpeesLedger.findMany({});
    const sum = (s: string) => entries.filter((e) => e.status === s).reduce((t, e) => t + e.lecturerShareKobo, 0);
    const batches = await prisma.settlementBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    const lastRun = batches[0]?.createdAt ?? null;
    return {
      pendingKobo: sum("pending"),
      availableKobo: sum("available"),
      settledKobo: sum("settled"),
      policy: SETTLEMENT_POLICY,
      next: nextPeriodEstimate(lastRun),
      batches,
    };
  });

  app.get("/settlement/batches", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:admin" });
    return prisma.settlementBatch.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  // Close a settlement period: group matured pending entries into a batch
  // and release them to available — atomically, exactly once per entry.
  app.post("/settlement/run", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:platformAdmin" });
    const b = (req.body ?? {}) as { periodStart?: string; periodEnd?: string; idempotencyKey?: string };
    const cutoff = new Date(Date.now() - SETTLEMENT_POLICY.holdDays * 86400_000);
    const key = (b.idempotencyKey ?? `run-${cutoff.toISOString().slice(0, 10)}`).slice(0, 64);
    const existing = await prisma.settlementBatch.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { batch: existing, replay: true };
    const out = await prisma.$transaction(async (tx) => {
      const matured = await tx.eSpeesLedger.findMany({ where: { status: "pending", createdAt: { lt: cutoff } } });
      if (!matured.length) return { batch: null, released: 0 };
      const batch = await tx.settlementBatch.create({
        data: {
          periodStart: b.periodStart ? new Date(b.periodStart) : cutoff,
          periodEnd: b.periodEnd ? new Date(b.periodEnd) : new Date(),
          status: "open",
          totalGrossKobo: matured.reduce((s, e) => s + e.grossKobo, 0),
          totalLecturerKobo: matured.reduce((s, e) => s + e.lecturerShareKobo, 0),
          totalPlatformKobo: matured.reduce((s, e) => s + e.platformShareKobo, 0),
          entryCount: matured.length,
          idempotencyKey: key,
        },
      });
      await tx.eSpeesLedger.updateMany({
        where: { id: { in: matured.map((e) => e.id) }, status: "pending" },
        data: { status: "available", settlementBatchId: batch.id },
      });
      return { batch, released: matured.length };
    });
    await audit(user.id, "settlement.run", "SettlementBatch", out.batch?.id ?? "empty", `released=${out.released}`);
    return out;
  });

  // Pay exactly one batch (or all available when no batch given — auto-batches).
  // Idempotent: same idempotencyKey returns the original batch, never re-settles.
  app.post("/settlement/pay", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:platformAdmin" });
    const b = (req.body ?? {}) as { batchId?: string; lecturerId?: string; reference?: string; idempotencyKey?: string };
    if (b.batchId) {
      const batch = await prisma.settlementBatch.findUnique({
        where: { id: b.batchId }, include: { entries: true },
      });
      if (!batch) return reply.code(404).send({ error: "not-found:batch" });
      if (batch.status === "paid") return { batch, replay: true };
      if (b.lecturerId && batch.entries.some((e) => e.lecturerId !== b.lecturerId))
        return reply.code(400).send({ error: "auth-invalid: batch mixes lecturers; pay without filter or per batch." });
      const reference = b.reference ?? `PAY-${batch.id.slice(0, 8).toUpperCase()}`;
      await prisma.$transaction(async (tx) => {
        await tx.eSpeesLedger.updateMany({ where: { settlementBatchId: batch.id, status: "available" }, data: { status: "settled" } });
        await tx.settlementBatch.update({ where: { id: batch.id }, data: { status: "paid", reference } });
      });
      await audit(user.id, "settlement.pay", "SettlementBatch", batch.id, `ref=${reference} total=${batch.totalLecturerKobo}`);
      await notifyLecturers(batch.entries.map((e) => e.lecturerId), reference);
      const done = await prisma.settlementBatch.findUnique({ where: { id: batch.id } });
      return { batch: done, replay: false };
    }
    // No batch: settle all available (optionally one lecturer), wrapped in a fresh batch.
    const key = (b.idempotencyKey ?? `pay-${randomBytes(8).toString("hex")}`).slice(0, 64);
    const existing = await prisma.settlementBatch.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { batch: existing, replay: true };
    const due = await prisma.eSpeesLedger.findMany({
      where: { status: "available", ...(b.lecturerId ? { lecturerId: b.lecturerId } : {}) },
    });
    if (!due.length) return { settled: 0, totalKobo: 0 };
    if (SETTLEMENT_POLICY.minPayoutKobo > 0) {
      const perLecturer = new Map<string, number>();
      for (const d of due) perLecturer.set(d.lecturerId, (perLecturer.get(d.lecturerId) ?? 0) + d.lecturerShareKobo);
      for (const total of perLecturer.values()) {
        if (total < SETTLEMENT_POLICY.minPayoutKobo)
          return reply.code(400).send({ error: `auth-invalid: lecturer total below minimum payout (${SETTLEMENT_POLICY.minPayoutKobo} kobo).` });
      }
    }
    const reference = b.reference ?? `PAY-${randomBytes(4).toString("hex").toUpperCase()}`;
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.settlementBatch.create({
        data: {
          periodStart: new Date(0), periodEnd: new Date(), status: "paid", reference,
          totalGrossKobo: due.reduce((s, d) => s + d.grossKobo, 0),
          totalLecturerKobo: due.reduce((s, d) => s + d.lecturerShareKobo, 0),
          totalPlatformKobo: due.reduce((s, d) => s + d.platformShareKobo, 0),
          entryCount: due.length, idempotencyKey: key,
        },
      });
      await tx.eSpeesLedger.updateMany({
        where: { id: { in: due.map((d) => d.id) }, status: "available" },
        data: { status: "settled", settlementBatchId: created.id },
      });
      return created;
    });
    await audit(user.id, "settlement.pay", "SettlementBatch", batch.id, `ref=${reference} total=${batch.totalLecturerKobo}`);
    await notifyLecturers(due.map((d) => d.lecturerId), reference);
    return { batch, replay: false };
  });

  // Lecturer's own settlement history (batches touching their entries).
  app.get("/lecturer/settlements", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.lecturerProfile) return reply.code(403).send({ error: "forbidden:role:lecturer" });
    const mine = await prisma.eSpeesLedger.findMany({
      where: { lecturerId: user.lecturerProfile.id, settlementBatchId: { not: null } },
      select: { settlementBatchId: true },
    });
    const ids = [...new Set(mine.map((m) => m.settlementBatchId as string))];
    if (!ids.length) return [];
    return prisma.settlementBatch.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "desc" } });
  });
}

async function notifyLecturers(lecturerIds: string[], reference: string) {
  for (const lid of [...new Set(lecturerIds)]) {
    const prof = await prisma.lecturerProfile.findFirst({ where: { id: lid } });
    if (prof) {
      await prisma.notification.create({
        data: {
          userId: prof.userId, type: "settlement",
          title: "Settlement paid", body: `Ref ${reference}. Check earnings dashboard.`,
        },
      });
    }
  }
}
