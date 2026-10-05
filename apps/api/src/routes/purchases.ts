// Purchases Phase 1 subset (§13.2): transparent price → mock checkout → library grant.
// Paystack wiring (keys + webhook verification) lands in payments spike; ledger split
// recorded now as pending eSpees (70/30 default, configurable via PLATFORM_FEE_BPS).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { KOBO_PER_POINT, MIN_REDEEM_POINTS, POINTS_RULE_VERSION } from "./points.js";
import { logEmail } from "./email.js";
import { canControlCourse, notifyUser, usableGrant } from "../hierarchy-guard.js";

const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 3000);
const HOLD_NOTE = "pending";

async function grantStudentUserId(studentId: string): Promise<string> {
  const sp = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  return sp?.userId ?? studentId;
}

export async function purchaseRoutes(app: FastifyInstance) {
  // Legacy instant checkout — REPLACED by the order pipeline (routes/payments.ts).
  // In test mode with the mock provider it runs the FULL pipeline server-side
  // (order → initialize → mock user payment → webhook → verify → grant), so the
  // student reader keeps working locally with zero shortcuts: no grant is ever
  // created from a client assertion. With a real provider configured it returns
  // 409 directing the client to create an order and follow the provider flow.
  app.post("/materials/:id/checkout", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    if (!user.email) return reply.code(400).send({ error: "Account email required for receipts." });
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { pointsToUse?: number; provider?: string; idempotencyKey?: string };
    const { createOrder, initializeOrder, mockComplete } = await import("../payments/orders.js");
    const { isTestMode, defaultProvider } = await import("../payments/providers.js");
    const provider = (body.provider ?? defaultProvider()).toLowerCase();
    if (provider !== "mock" || !isTestMode()) {
      return reply.code(409).send({
        error: "Checkout moved to orders — create an order, complete the provider flow, and wait for webhook confirmation.",
        next: `/materials/${id}/orders`,
      });
    }
    try {
      const order = await createOrder({
        studentId: user.studentProfile.id, userId: user.id, email: user.email,
        materialId: id, pointsToUse: body.pointsToUse, provider: "mock",
        idempotencyKey: body.idempotencyKey,
      });
      const init = await initializeOrder(order.id, user.email);
      if (init.alreadyPaid) {
        return prisma.purchase.findUnique({ where: { orderId: order.id } });
      }
      const done = await mockComplete(init.reference);
      if (!done.ok || !done.paid)
        return reply.code(402).send({ error: done.error ?? "Mock payment did not complete." });
      return prisma.purchase.findUnique({ where: { orderId: order.id } });
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      return reply.code(err.statusCode ?? 500).send({ error: err.message ?? "Checkout failed." });
    }
  });

  // exact access terms BEFORE payment — the reader buy card renders this verbatim.
  app.get("/materials/:id/terms", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({
      where: { id },
      include: {
        course: { include: { department: { include: { faculty: { include: { university: true } } } } } },
        lecturer: { include: { user: true } },
      },
    });
    if (!mat || mat.status !== "published") return reply.code(404).send({ error: "Material unavailable." });
    const grant = user.studentProfile ? await usableGrant(user.studentProfile.id, id) : null;
    return {
      materialId: mat.id, title: mat.title, edition: mat.version, type: mat.type,
      course: { id: mat.courseId, code: mat.course.code, title: mat.course.title },
      lecturer: mat.lecturer.user.name, department: mat.course.department.name,
      university: mat.course.department.faculty.university.name,
      isFree: mat.isFree, classification: mat.isFree ? "free" : "paid",
      priceKobo: mat.priceKobo,
      points: { koboPerPoint: KOBO_PER_POINT, minRedeem: MIN_REDEEM_POINTS, maxShare: "50% of price" },
      accessDurationDays: mat.accessDurationDays, permanent: mat.accessDurationDays == null,
      accessType: "purchase", inEcosystemOnly: true,
      alreadyHeld: !!grant,
    };
  });

  // grant revoke / suspend / reinstate — assigned course lecturer or staff.
  // Free access follows enrollment (no purchase row); revoke the enrollment instead.
  app.post("/purchases/:id/revoke", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { reason?: string };
    const p = await prisma.purchase.findUnique({ where: { id } });
    if (!p) return reply.code(404).send({ error: "Grant not found." });
    const courseId = p.courseId ?? (p.materialId
      ? (await prisma.material.findUnique({ where: { id: p.materialId } }))?.courseId ?? null
      : null);
    if (!courseId || !(await canControlCourse(user.id, user.role, courseId)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may revoke grants." });
    if (p.status !== "completed") return reply.code(400).send({ error: `Cannot revoke a ${p.status} grant.` });
    const updated = await prisma.purchase.update({ where: { id }, data: { status: "revoked" } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "grant.revoked", targetType: "Purchase", targetId: id, meta: b.reason ?? null },
    });
    await notifyUser(await grantStudentUserId(p.studentId), "grant.revoked", "Library access revoked",
      `Access was revoked${b.reason ? `: ${b.reason}` : ""}. Contact the course lecturer.`);
    return updated;
  });

  app.post("/purchases/:id/suspend", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { reason?: string };
    const p = await prisma.purchase.findUnique({ where: { id } });
    if (!p) return reply.code(404).send({ error: "Grant not found." });
    const courseId = p.courseId ?? (p.materialId
      ? (await prisma.material.findUnique({ where: { id: p.materialId } }))?.courseId ?? null
      : null);
    if (!courseId || !(await canControlCourse(user.id, user.role, courseId)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may suspend grants." });
    if (p.status !== "completed") return reply.code(400).send({ error: `Cannot suspend a ${p.status} grant.` });
    const updated = await prisma.purchase.update({ where: { id }, data: { status: "suspended" } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "grant.suspended", targetType: "Purchase", targetId: id, meta: b.reason ?? null },
    });
    await notifyUser(await grantStudentUserId(p.studentId), "grant.suspended", "Library access suspended",
      `Access is suspended${b.reason ? `: ${b.reason}` : ""}. Contact the course lecturer.`);
    return updated;
  });

  app.post("/purchases/:id/reinstate", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const p = await prisma.purchase.findUnique({ where: { id } });
    if (!p) return reply.code(404).send({ error: "Grant not found." });
    const courseId = p.courseId ?? (p.materialId
      ? (await prisma.material.findUnique({ where: { id: p.materialId } }))?.courseId ?? null
      : null);
    if (!courseId || !(await canControlCourse(user.id, user.role, courseId)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may reinstate grants." });
    if (!["suspended", "revoked"].includes(p.status))
      return reply.code(400).send({ error: `Cannot reinstate a ${p.status} grant.` });
    const updated = await prisma.purchase.update({ where: { id }, data: { status: "completed" } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "grant.reinstated", targetType: "Purchase", targetId: id },
    });
    await notifyUser(await grantStudentUserId(p.studentId), "grant.reinstated", "Library access restored", "Your access is active again.");
    return updated;
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

  // library: unified entitlement ledger — every item knows student, material,
  // edition, course, type, start, end/permanent, order ref, classification,
  // validity and revoked/suspended state. Paid rows persist; free items derive
  // from approved enrollments (access ends if enrollment ends).
  app.get("/library/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const sid = user.studentProfile.id;
    const now = Date.now();
    const purchases = await prisma.purchase.findMany({
      where: { studentId: sid, status: { in: ["completed", "revoked", "suspended"] } },
      orderBy: { createdAt: "desc" },
    });
    const materialIds = [...new Set(purchases.map((p) => p.materialId).filter((v): v is string => !!v))];
    const bundleIds = [...new Set(purchases.map((p) => p.bundleId).filter((v): v is string => !!v))];
    const [mats, bundles] = await Promise.all([
      materialIds.length
        ? prisma.material.findMany({
          where: { id: { in: materialIds } },
          select: { id: true, title: true, version: true, status: true, isFree: true, priceKobo: true, accessDurationDays: true, courseId: true, course: { select: { code: true, title: true } } },
        })
        : [],
      bundleIds.length
        ? prisma.bundle.findMany({ where: { id: { in: bundleIds } }, select: { id: true, title: true } })
        : [],
    ]);
    const matById = new Map(mats.map((m) => [m.id, m]));
    const bundleById = new Map(bundles.map((b) => [b.id, b]));
    const paid = purchases.map((p) => {
      const m = p.materialId ? matById.get(p.materialId) ?? null : null;
      const b = p.bundleId ? bundleById.get(p.bundleId) ?? null : null;
      const expired = !!p.accessExpiresAt && p.accessExpiresAt.getTime() < now;
      const archived = m?.status === "archived";
      const replaced = m != null && p.versionGranted != null && m.version > p.versionGranted;
      const state = p.status === "revoked" ? "revoked"
        : p.status === "suspended" ? "suspended"
        : expired ? "expired"
        : archived ? "archived"
        : p.accessExpiresAt && p.accessExpiresAt.getTime() - now <= 14 * 86400_000 ? "expiring"
        : "active";
      return {
        kind: "paid" as const,
        purchaseId: p.id, studentId: sid,
        materialId: p.materialId, materialTitle: m?.title ?? b?.title ?? null,
        versionGranted: p.versionGranted, versionCurrent: m?.version ?? null,
        editionReplaced: replaced,
        courseId: p.courseId ?? m?.courseId ?? null,
        courseCode: m?.course.code ?? null, courseTitle: m?.course.title ?? null,
        accessType: p.accessType, accessStart: p.createdAt,
        accessEnd: p.accessExpiresAt, permanent: p.accessExpiresAt == null,
        orderRef: p.id.slice(0, 8), classification: "paid" as const,
        amountKobo: p.amountKobo, pointsUsed: p.pointsUsed,
        state, stateReason: replaced ? `Edition v${m?.version} replaces your v${p.versionGranted}` : null,
        material: m, bundle: b,
      };
    });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: sid, status: "approved" },
      include: {
        course: {
          include: {
            materials: { where: { status: { in: ["published", "archived"] }, isFree: true } },
          },
        },
      },
    });
    const free = enrollments.flatMap((e) => e.course.materials.map((m) => ({
      kind: "free" as const,
      purchaseId: null, studentId: sid,
      materialId: m.id, materialTitle: m.title,
      versionGranted: m.version, versionCurrent: m.version,
      editionReplaced: false,
      courseId: e.courseId, courseCode: e.course.code, courseTitle: e.course.title,
      accessType: "free", accessStart: e.createdAt,
      accessEnd: null, permanent: false,
      orderRef: null, classification: "free" as const,
      amountKobo: 0, pointsUsed: 0,
      state: (m.status === "archived" ? "archived" : "active") as "archived" | "active",
      stateReason: m.status === "archived" ? "Lecturer archived this edition" : "Ends if your enrollment ends",
      material: { id: m.id, title: m.title, version: m.version, status: m.status },
      bundle: null,
    })));
    const items = [...paid, ...free];
    const summary = {
      active: items.filter((i) => i.state === "active").length,
      expiring: items.filter((i) => i.state === "expiring").length,
      expired: items.filter((i) => i.state === "expired").length,
      archived: items.filter((i) => i.state === "archived").length,
      revoked: items.filter((i) => i.state === "revoked").length,
      suspended: items.filter((i) => i.state === "suspended").length,
      permanent: items.filter((i) => i.permanent && (i.state === "active" || i.state === "expiring")).length,
    };
    // backward-compatible keys (home counts + legacy readers)
    return {
      items, summary,
      purchases: paid, freeMaterials: free.map((f) => ({ id: f.materialId, title: f.materialTitle })),
    };
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
