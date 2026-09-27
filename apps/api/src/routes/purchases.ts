// Purchases Phase 1 subset (§13.2): transparent price → mock checkout → library grant.
// Paystack wiring (keys + webhook verification) lands in payments spike; ledger split
// recorded now as pending eSpees (70/30 default, configurable via PLATFORM_FEE_BPS).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";
import { balanceOf, KOBO_PER_POINT, MIN_REDEEM_POINTS } from "./points.js";
import { logEmail } from "./email.js";

const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 3000);
const HOLD_NOTE = "pending";

export async function purchaseRoutes(app: FastifyInstance) {
  // dev checkout: creates completed purchase + pending eSpees ledger atomically
  app.post("/materials/:id/checkout", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({ where: { id } });
    if (!mat || mat.status !== "published") return reply.code(404).send({ error: "Material unavailable." });
    if (mat.isFree) return reply.code(400).send({ error: "Material is free — no purchase needed." });
    const existing = await prisma.purchase.findFirst({
      where: { studentId: user.studentProfile.id, materialId: id, status: "completed" },
    });
    if (existing) return existing;
    // points redemption (optional): {pointsToUse} → kobo discount, capped at 50% of price
    const body = (req.body ?? {}) as { pointsToUse?: number };
    let pointsToUse = Math.floor(Number(body.pointsToUse ?? 0));
    if (pointsToUse > 0) {
      const balance = await balanceOf(user.studentProfile.id);
      if (pointsToUse > balance) return reply.code(400).send({ error: `Insufficient points (balance ${balance}).` });
      if (pointsToUse < MIN_REDEEM_POINTS)
        return reply.code(400).send({ error: `Minimum redemption is ${MIN_REDEEM_POINTS} points.` });
      const maxDiscount = Math.floor(mat.priceKobo / 2);
      const discount = Math.min(pointsToUse * KOBO_PER_POINT, maxDiscount);
      pointsToUse = Math.floor(discount / KOBO_PER_POINT);
      if (pointsToUse <= 0) return reply.code(400).send({ error: "Points discount too small for this price." });
    }
    const discountKobo = pointsToUse * KOBO_PER_POINT;
    const result = await prisma.$transaction(async (tx) => {
      const accessExpiresAt = mat.accessDurationDays
        ? new Date(Date.now() + mat.accessDurationDays * 86400_000)
        : null;
      const purchase = await tx.purchase.create({
        data: {
          studentId: user.studentProfile!.id, materialId: id,
          amountKobo: mat.priceKobo - discountKobo, pointsUsed: discountKobo, status: "completed", accessExpiresAt,
        },
      });
      if (pointsToUse > 0) {
        await tx.pointLedger.create({
          data: {
            studentId: user.studentProfile!.id, amount: -pointsToUse,
            reason: "redemption", capKey: `redeem:${purchase.id}`,
          },
        });
      }
      const platformShare = Math.round((mat.priceKobo * PLATFORM_FEE_BPS) / 10000);
      await tx.eSpeesLedger.create({
        data: {
          lecturerId: mat.lecturerId, purchaseId: purchase.id,
          grossKobo: mat.priceKobo, lecturerShareKobo: mat.priceKobo - platformShare,
          platformShareKobo: platformShare, status: HOLD_NOTE,
        },
      });
      await tx.notification.create({
        data: {
          userId: user.id, type: "purchase",
          title: `Purchased: ${mat.title}`, body: `Receipt #${purchase.id.slice(0, 8)} · ₦${(mat.priceKobo / 100).toFixed(2)}`,
        },
      });
      return purchase;
    });
    await logEmail(
      user.id, `Receipt: ${mat.title}`,
      `You paid ₦${((mat.priceKobo - discountKobo) / 100).toFixed(2)}${discountKobo ? ` (${pointsToUse} points redeemed)` : ""}. Access: ${mat.accessDurationDays ?? "ongoing"}.`,
    );
    return { ...result, paystack: "mock — wire keys + webhook in payments spike" };
  });

  // bundles: create (lecturer) + list + checkout (grants all items)
  app.post("/bundles", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.lecturerProfile) return reply.code(403).send({ error: "Lecturer only." });
    const b = req.body as { title: string; priceKobo: number; materialIds: string[] };
    if (!b.title || !b.materialIds?.length) return reply.code(400).send({ error: "title + materialIds required." });
    if (b.priceKobo > 500000) return reply.code(400).send({ error: "Bundle cap ₦5,000." });
    const bundle = await prisma.bundle.create({
      data: {
        lecturerId: user.lecturerProfile.id, title: b.title, priceKobo: b.priceKobo,
        items: { create: b.materialIds.map((materialId) => ({ materialId })) },
      },
      include: { items: true },
    });
    return bundle;
  });

  app.get("/bundles", async () => prisma.bundle.findMany({ include: { items: true }, orderBy: { title: "asc" } }));

  // library: my entitled materials with access status
  app.get("/library/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const purchases = await prisma.purchase.findMany({
      where: { studentId: user.studentProfile.id, status: "completed" },
      orderBy: { createdAt: "desc" },
    });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.studentProfile.id, status: "approved" },
      include: { course: { include: { materials: { where: { status: "published", isFree: true } } } } },
    });
    return { purchases, freeMaterials: enrollments.flatMap((e) => e.course.materials) };
  });

  // lecturer earnings snapshot (pending only in Phase 1; settlement UI in Phase 2)
  app.get("/earnings/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.lecturerProfile) return reply.code(403).send({ error: "Lecturer only." });
    const entries = await prisma.eSpeesLedger.findMany({
      where: { lecturerId: user.lecturerProfile.id }, orderBy: { createdAt: "desc" },
    });
    const pending = entries.filter((e) => e.status === "pending").reduce((s, e) => s + e.lecturerShareKobo, 0);
    return { entries, pendingKobo: pending, note: "Settlement workflow lands in Phase 2." };
  });
}
