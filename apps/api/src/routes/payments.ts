// Payment orders + webhooks (§13). The 11-step sequence runs through
// src/payments/orders.ts; business logic never touches provider SDKs.
//
// Raw bodies: webhook HMACs must run over the EXACT provider bytes, so this
// module registers as an ENCAPSULATED fastify plugin with its own parsers —
// the raw-string JSON parser applies only to these routes, nowhere else.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import {
  createOrder,
  initializeOrder,
  mockComplete,
  processWebhook,
  touchOrder,
} from "../payments/orders.js";
import { isTestMode } from "../payments/providers.js";

export async function paymentsPlugin(app: FastifyInstance) {
  // keep exact bytes for HMAC validation (scoped to this plugin only)
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
  });

  // --- step 2+3: create order + initialize (terms viewed first via /materials/:id/terms) ---
  app.post("/materials/:id/orders", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    if (!user.email) return reply.code(400).send({ error: "Account email required for receipts." });
    const { id } = req.params as { id: string };
    const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {})) as {
      pointsToUse?: number; provider?: string; idempotencyKey?: string;
    };
    try {
      const order = await createOrder({
        studentId: user.studentProfile.id, userId: user.id, email: user.email,
        materialId: id, pointsToUse: b.pointsToUse, provider: b.provider,
        idempotencyKey: b.idempotencyKey,
      });
      const init = await initializeOrder(order.id, user.email);
      if ((init as { alreadyPaid?: boolean }).alreadyPaid) return { order: init.order, alreadyPaid: true };
      return {
        order: init.order,
        authorizationUrl: (init as { authorizationUrl?: string }).authorizationUrl,
        accessCode: (init as { accessCode?: string }).accessCode,
        reference: (init as { reference: string }).reference,
      };
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode ?? 500).send({ error: (e as Error).message });
    }
  });

  // --- order status (owner or staff) ---
  app.get("/payments/orders/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const order = await touchOrder(id);
    if (!order) return reply.code(404).send({ error: "Order not found." });
    const staff = ["deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role);
    if (!staff && (!user.studentProfile || order.studentId !== user.studentProfile.id))
      return reply.code(403).send({ error: "Not your order." });
    const purchase = await prisma.purchase.findUnique({ where: { orderId: order.id } });
    return { order, purchaseId: purchase?.id ?? null };
  });

  // --- my orders (student) ---
  app.get("/payments/orders", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    return prisma.paymentOrder.findMany({
      where: { studentId: user.studentProfile.id },
      orderBy: { createdAt: "desc" }, take: 30,
    });
  });

  // --- reconciliation (staff): counts + mismatches ---
  app.get("/payments/reconcile", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["institutionAdmin", "platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Staff only." });
    const [byStatus, paidCount, grantCount, invalidEvents, unprocessed] = await Promise.all([
      prisma.paymentOrder.groupBy({ by: ["status", "provider"], _count: true }),
      prisma.paymentOrder.count({ where: { status: "paid" } }),
      prisma.purchase.count({ where: { orderId: { not: null } } }),
      prisma.webhookEvent.count({ where: { signatureValid: false } }),
      prisma.webhookEvent.count({ where: { signatureValid: true, processed: false } }),
    ]);
    const paidOrders = await prisma.paymentOrder.findMany({ where: { status: "paid" }, select: { id: true } });
    const paidIds = new Set(paidOrders.map((o) => o.id));
    const granted = await prisma.purchase.findMany({ where: { orderId: { in: [...paidIds] } }, select: { orderId: true } });
    const grantedIds = new Set(granted.map((g) => g.orderId));
    const paidWithoutGrant = [...paidIds].filter((id) => !grantedIds.has(id));
    return {
      byStatus, paidOrders: paidCount, orderGrants: grantCount,
      paidWithoutGrant, invalidSignatureEvents: invalidEvents, unprocessedEvents: unprocessed,
    };
  });

  // --- mock pay page (test mode): local user-payment step, no real money ---
  app.get("/payments/mock/pay/:reference", async (req, reply) => {
    if (!isTestMode()) return reply.code(403).send({ error: "Mock pay page only in test mode." });
    const { reference } = req.params as { reference: string };
    const order = await prisma.paymentOrder.findFirst({ where: { providerRef: reference, provider: "mock" } });
    if (!order) return reply.code(404).send({ error: "Order not found." });
    reply.type("text/html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>EDUFARM test checkout</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 16px">
<h2>Test checkout — no real money</h2>
<p>Order <strong>${order.id.slice(0, 8)}</strong> · <strong>₦${(order.amountKobo / 100).toFixed(2)}</strong> · status ${order.status}</p>
<button id="pay" style="min-height:44px;padding:12px 20px;font-size:16px">Pay ₦${(order.amountKobo / 100).toFixed(2)} (test)</button>
<p id="msg"></p>
<p><small>Simulates the provider flow: completion travels the webhook pipeline (signed, verified, idempotent).</small></p>
<script>
document.getElementById("pay").onclick = async () => {
  const r = await fetch("/api/v1/payments/mock/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: "${reference}" }) });
  const j = await r.json();
  document.getElementById("msg").textContent = j.paid ? "Paid — check your library." : ("Failed: " + (j.error || r.status));
};
</script>
</body></html>`);
  });

  // --- mock completion (test mode): feeds the SAME webhook pipeline ---
  app.post("/payments/mock/complete", async (req, reply) => {
    const b = (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {})) as { reference?: string };
    if (!b.reference) return reply.code(400).send({ error: "reference required." });
    const res = await mockComplete(b.reference);
    if (!res.ok) return reply.code(res.code ?? 500).send({ error: res.error });
    return res;
  });

  // --- provider webhooks: raw bytes preserved for HMAC validation ---
  app.post("/payments/webhook/:provider", async (req, reply) => {
    const { provider } = req.params as { provider: string };
    if (!["mock", "paystack", "flutterwave"].includes(provider))
      return reply.code(404).send({ error: "Unknown provider." });
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const sig = first(headers["x-paystack-signature"]) ?? first(headers["verif-hash"]) ?? first(headers["x-mock-signature"]);
    const res = await processWebhook(provider, raw, sig);
    if (!res.ok) return reply.code(res.code).send({ error: res.error });
    return res;
  });

  // --- provider redirect landing (never grants — only reports; grant comes via webhook) ---
  app.get("/payments/callback", async (req, reply) => {
    const q = req.query as { order?: string; reference?: string };
    if (!q.order && !q.reference) return reply.code(400).send({ error: "order or reference required." });
    const order = q.order
      ? await touchOrder(q.order)
      : await prisma.paymentOrder.findFirst({ where: { providerRef: q.reference } });
    if (!order) return reply.code(404).send({ error: "Order not found." });
    return {
      orderId: order.id, status: order.status,
      note: order.status === "paid"
        ? "Payment confirmed — your library is updated."
        : "If you just paid, the provider is still confirming — refresh shortly. Access is granted only after confirmation.",
    };
  });
}
