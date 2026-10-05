// Payment orders — the 11-step purchase sequence lives here, provider-agnostic.
// 1 view terms → 2 order pending → 3 initialize → 4 user pays at provider →
// 5 webhook → 6 signature check → 7 server-to-server verify → 8 order paid once →
// 9 grant once → 10 earnings once → 11 receipt.
// Exactly-once: WebhookEvent(provider,eventId) unique absorbs replays; the
// pending→paid transition is conditional (0 rows = already settled); Purchase
// .orderId and ESpeesLedger.purchaseId are UNIQUE (the database is the lock).

import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { balanceOf, KOBO_PER_POINT, MIN_REDEEM_POINTS } from "../routes/points.js";
import { logEmail } from "../routes/email.js";
import { notifyUser } from "../hierarchy-guard.js";
import {
  MockCompletions,
  defaultProvider,
  getProvider,
  isTestMode,
  type PaymentProvider,
  type ProviderName,
  type VerifyResult,
} from "./providers.js";

const PLATFORM_FEE_BPS = Number(process.env.PLATFORM_FEE_BPS ?? 3000);
const ORDER_TTL_MS = 30 * 60_000;

export function providerFor(name?: string): PaymentProvider {
  return getProvider((name ?? defaultProvider()).toLowerCase());
}

function callbackUrl(orderId: string): string {
  const base = (process.env.PAYMENT_CALLBACK_BASE ?? "http://localhost:3001").replace(/\/$/, "");
  return `${base}/library?order=${orderId}`;
}

// --- step 2: create a pending order (idempotent on idempotencyKey) ---
export async function createOrder(opts: {
  studentId: string;
  userId: string;
  email: string;
  materialId: string;
  pointsToUse?: number;
  provider?: string;
  idempotencyKey?: string;
}) {
  const mat = await prisma.material.findUnique({ where: { id: opts.materialId }, include: { course: true } });
  if (!mat || mat.status !== "published") throw Object.assign(new Error("Material unavailable."), { statusCode: 404 });
  if (mat.isFree) throw Object.assign(new Error("Material is free — no purchase needed."), { statusCode: 400 });
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId: mat.courseId, studentId: opts.studentId } },
  });
  if (!enrollment || enrollment.status !== "approved")
    throw Object.assign(
      new Error("Enrolment required — your lecturer must approve course access before purchase."),
      { statusCode: 403 }
    );
  let pointsToUse = Math.floor(Number(opts.pointsToUse ?? 0));
  if (pointsToUse > 0) {
    const balance = await balanceOf(opts.studentId);
    if (pointsToUse > balance)
      throw Object.assign(new Error(`Insufficient points (balance ${balance}).`), { statusCode: 400 });
    if (pointsToUse < MIN_REDEEM_POINTS)
      throw Object.assign(new Error(`Minimum redemption is ${MIN_REDEEM_POINTS} points.`), { statusCode: 400 });
    const maxDiscount = Math.floor(mat.priceKobo / 2);
    const discount = Math.min(pointsToUse * KOBO_PER_POINT, maxDiscount);
    pointsToUse = Math.floor(discount / KOBO_PER_POINT);
    if (pointsToUse <= 0)
      throw Object.assign(new Error("Points discount too small for this price."), { statusCode: 400 });
  }
  const key = opts.idempotencyKey?.trim() || `order_${randomBytes(8).toString("hex")}`;
  const provider = providerFor(opts.provider);
  if (provider.name !== "mock" && !isTestMode() && (provider.name === "paystack" ? !process.env.PAYSTACK_SECRET_KEY : !process.env.FLW_SECRET_KEY))
    throw Object.assign(new Error(`${provider.name} is not configured.`), { statusCode: 400 });
  try {
    return await prisma.paymentOrder.create({
      data: {
        studentId: opts.studentId, materialId: mat.id, courseId: mat.courseId,
        versionGranted: mat.version, amountKobo: mat.priceKobo - pointsToUse * KOBO_PER_POINT,
        pointsUsed: pointsToUse, status: "pending", provider: provider.name,
        idempotencyKey: key,
      },
    });
  } catch (e) {
    if (String((e as Error).message).includes("idempotencyKey")) {
      const existing = await prisma.paymentOrder.findUnique({ where: { idempotencyKey: key } });
      if (existing) return existing;
    }
    throw e;
  }
}

// --- step 3: initialize with the provider (stores reference, marks processing) ---
export async function initializeOrder(orderId: string, email: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order) throw Object.assign(new Error("Order not found."), { statusCode: 404 });
  if (order.status === "paid") return { order, alreadyPaid: true as const };
  if (!["pending", "processing"].includes(order.status))
    throw Object.assign(new Error(`Order is ${order.status}.`), { statusCode: 400 });
  const provider = providerFor(order.provider);
  const init = await provider.initialize({
    orderId: order.id, amountKobo: order.amountKobo, email,
    callbackUrl: callbackUrl(order.id),
    metadata: { materialId: order.materialId ?? "", studentId: order.studentId },
  });
  const updated = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { providerRef: init.reference, providerData: init.raw as object, status: "processing" },
  });
  return { order: updated, authorizationUrl: init.authorizationUrl, accessCode: init.accessCode, reference: init.reference };
}

// --- steps 5–11: webhook pipeline (shared by HTTP webhooks + mock completion) ---
export async function processWebhook(providerName: string, rawBody: string, signature: string | undefined) {
  const provider = providerFor(providerName);
  if (!provider.validateWebhookSignature(rawBody, signature)) {
    await prisma.webhookEvent.create({
      data: { provider: provider.name, eventId: `invalid_${randomBytes(8).toString("hex")}`, eventType: "invalid-signature", raw: { rawBody: rawBody.slice(0, 2000) }, signatureValid: false },
    }).catch(() => {});
    return { ok: false as const, code: 400, error: "Invalid webhook signature." };
  }
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { ok: false as const, code: 400, error: "Malformed webhook JSON." };
  }
  const eventId = provider.eventId(event);
  if (!eventId) return { ok: false as const, code: 400, error: "Unprocessable event (no event id)." };
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: provider.name, eventId, eventType: provider.eventType(event),
        raw: event as object, signatureValid: true,
      },
    });
  } catch {
    // replay: unique (provider, eventId) already seen — report prior outcome
    const prior = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: provider.name, eventId } } });
    return { ok: true as const, replay: true, processed: prior?.processed ?? false, orderId: prior?.orderId ?? null };
  }
  const record = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: provider.name, eventId } } });
  // 7. server-to-server verify — never trust the event payload amount
  const ref = provider.eventReference(event);
  if (!ref) {
    await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
    return { ok: false as const, code: 400, error: "Event carries no transaction reference." };
  }
  let vr: VerifyResult;
  try {
    vr = await provider.verify(ref);
  } catch (e) {
    await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
    return { ok: false as const, code: 502, error: `Provider verify failed: ${(e as Error).message}` };
  }
  const order = await prisma.paymentOrder.findFirst({ where: { providerRef: vr.reference } })
    ?? await prisma.paymentOrder.findFirst({ where: { providerRef: ref } });
  if (!order) {
    await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
    return { ok: false as const, code: 404, error: "Order not found for reference." };
  }
  await prisma.webhookEvent.update({ where: { id: record!.id }, data: { orderId: order.id } });
  if (vr.status !== "success") {
    await prisma.paymentOrder.updateMany({ where: { id: order.id, status: { in: ["pending", "processing"] } }, data: { status: "failed", failureReason: `provider: ${vr.status}` } });
    await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
    return { ok: true as const, paid: false, orderId: order.id };
  }
  if (vr.amountKobo !== order.amountKobo) {
    await prisma.paymentOrder.updateMany({ where: { id: order.id, status: { in: ["pending", "processing"] } }, data: { status: "failed", failureReason: `amount mismatch: paid ${vr.amountKobo} vs order ${order.amountKobo}` } });
    await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
    return { ok: true as const, paid: false, orderId: order.id, mismatch: true };
  }
  // 8–11. settle exactly once
  const settled = await settleOrder(order.id);
  await prisma.webhookEvent.update({ where: { id: record!.id }, data: { processed: true } });
  return { ok: true as const, paid: settled.paid, replay: settled.replay, orderId: order.id };
}

// Settle an order: paid flag + grant + earnings, each guarded by a UNIQUE
// constraint so concurrent/duplicate webhooks settle exactly once.
export async function settleOrder(orderId: string): Promise<{ paid: boolean; replay: boolean; purchaseId?: string }> {
  const claimed = await prisma.paymentOrder.updateMany({
    where: { id: orderId, status: { in: ["pending", "processing"] } },
    data: { status: "paid", paidAt: new Date() },
  });
  if (claimed.count === 0) {
    const existing = await prisma.purchase.findUnique({ where: { orderId } });
    return { paid: true, replay: true, purchaseId: existing?.id };
  }
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || !order.materialId) {
    await prisma.paymentOrder.update({ where: { id: orderId }, data: { status: "failed", failureReason: "order missing material" } });
    return { paid: false, replay: false };
  }
  const mat = await prisma.material.findUnique({ where: { id: order.materialId } });
  if (!mat) {
    await prisma.paymentOrder.update({ where: { id: orderId }, data: { status: "failed", failureReason: "material gone" } });
    return { paid: false, replay: false };
  }
  try {
    // Serializable: concurrent settlements for one student serialize, so two
    // simultaneous redemptions cannot both spend the same balance.
    const out = await prisma.$transaction(async (tx) => {
      const accessExpiresAt = mat.accessDurationDays ? new Date(Date.now() + mat.accessDurationDays * 86400_000) : null;
      const purchase = await tx.purchase.create({
        data: {
          studentId: order.studentId, materialId: mat.id, courseId: mat.courseId,
          versionGranted: order.versionGranted ?? mat.version, accessType: "purchase",
          orderId: order.id, providerRef: order.providerRef,
          amountKobo: order.amountKobo, pointsUsed: order.pointsUsed, status: "completed", accessExpiresAt,
        },
      });
      if (order.pointsUsed > 0) {
        // Re-validate inside the settlement transaction: the balance checked at
        // order creation may have moved (concurrent redemption). Never overdraw.
        const rows = await tx.pointLedger.findMany({ where: { studentId: order.studentId } });
        const balance = rows.reduce((s, r) => s + r.amount, 0);
        if (order.pointsUsed > balance) {
          throw Object.assign(
            new Error(`Insufficient points at settlement (balance ${balance}).`),
            { statusCode: 402, failOrder: true }
          );
        }
        await tx.pointLedger.create({
          data: {
            studentId: order.studentId, amount: -order.pointsUsed, reason: "redemption",
            capKey: `redeem:${purchase.id}`, sourceRef: purchase.id, ruleVersion: "v1",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: order.studentId, action: "points.redeemed", targetType: "PointLedger",
            targetId: `redeem:${purchase.id}`, meta: `-${order.pointsUsed}pts rule=v1`,
          },
        });
      }
      const platformShare = Math.round((mat.priceKobo * PLATFORM_FEE_BPS) / 10000);
      await tx.eSpeesLedger.create({
        data: {
          lecturerId: mat.lecturerId, purchaseId: purchase.id,
          grossKobo: mat.priceKobo, lecturerShareKobo: mat.priceKobo - platformShare,
          platformShareKobo: platformShare, status: "pending",
        },
      });
      const sp = await tx.studentProfile.findUnique({ where: { id: order.studentId } });
      if (sp) {
        await tx.notification.create({
          data: {
            userId: sp.userId, type: "purchase",
            title: `Purchased: ${mat.title}`,
            body: `Receipt #${purchase.id.slice(0, 8)} · ₦${(order.amountKobo / 100).toFixed(2)} · ref ${order.providerRef ?? order.id.slice(0, 8)}`,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: sp?.userId ?? order.studentId, action: "purchase.completed", targetType: "Purchase", targetId: purchase.id,
          meta: `order=${order.id} provider=${order.provider} ref=${order.providerRef} amount=${order.amountKobo} redeemed=${order.pointsUsed}`,
        },
      });
      return purchase;
    }, { isolationLevel: "Serializable" });
    const { logEmail } = await import("../routes/email.js");
    const sp = await prisma.studentProfile.findUnique({ where: { id: order.studentId } });
    if (sp) {
      await logEmail(
        sp.userId, `Receipt: ${mat.title}`,
        `You paid ₦${(order.amountKobo / 100).toFixed(2)}${order.pointsUsed ? ` (${order.pointsUsed} points redeemed)` : ""} via ${order.provider}. Ref: ${order.providerRef ?? order.id.slice(0, 8)}. Access: ${mat.accessDurationDays ?? "ongoing"}.`
      );
    }
    return { paid: true, replay: false, purchaseId: out.id };
  } catch (e) {
    // UNIQUE violation on purchase.orderId = a concurrent settle won; adopt it.
    if (String((e as Error).message).includes("orderId")) {
      const existing = await prisma.purchase.findUnique({ where: { orderId } });
      return { paid: true, replay: true, purchaseId: existing?.id };
    }
    await prisma.paymentOrder.update({ where: { id: orderId }, data: { status: "failed", failureReason: `settle: ${(e as Error).message.slice(0, 200)}` } });
    return { paid: false, replay: false };
  }
}

// Mock user payment (TEST MODE ONLY): records the mock intent, signs an event,
// and feeds the SAME webhook pipeline — no shortcuts, no client trust.
export async function mockComplete(reference: string): Promise<{ ok: boolean; code?: number; error?: string; paid?: boolean; orderId?: string }> {
  if (!isTestMode()) return { ok: false, code: 403, error: "Mock completion only in test mode." };
  const order = await prisma.paymentOrder.findFirst({ where: { providerRef: reference, provider: "mock" } });
  if (!order) return { ok: false, code: 404, error: "Mock order not found for reference." };
  if (order.status === "paid") return { ok: true, paid: true, orderId: order.id };
  if (!["pending", "processing"].includes(order.status))
    return { ok: false, code: 400, error: `Order is ${order.status}.` };
  MockCompletions.set(reference, order.amountKobo);
  const provider = new (await import("./providers.js")).MockPaymentProvider();
  const event = JSON.stringify({
    event: "charge.success",
    eventId: `evt_${reference}`,
    reference,
    amountKobo: order.amountKobo,
    orderId: order.id,
  });
  const res = await processWebhook("mock", event, provider.sign(event));
  if (!res.ok) return res;
  return { ok: true, paid: (res as { paid?: boolean }).paid ?? false, orderId: order.id };
}

// Lazy expiry for abandoned pending orders (checked on read).
export async function touchOrder(orderId: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (order && order.status === "pending" && Date.now() - order.createdAt.getTime() > ORDER_TTL_MS) {
    await prisma.paymentOrder.update({ where: { id: orderId }, data: { status: "expired" } });
    return { ...order, status: "expired" as const };
  }
  return order;
}
