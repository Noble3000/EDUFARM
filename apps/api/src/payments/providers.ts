// Payment providers — the ONLY place provider SDKs/HTTP live.
// Business logic (orders, grants, earnings) talks to PaymentProvider, never to
// Paystack/Flutterwave directly. Secrets come from environment only.
// Amounts: Paystack uses kobo (minor units); Flutterwave uses naira (major) —
// conversion lives inside each provider, nowhere else.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ProviderName = "mock" | "paystack" | "flutterwave";

export interface OrderIntent {
  orderId: string;
  amountKobo: number;
  email: string;
  callbackUrl: string;
  metadata: Record<string, string>;
}

export interface InitResult {
  reference: string;
  authorizationUrl?: string;
  accessCode?: string;
  raw: unknown;
}

export type VerifyStatus = "success" | "failed" | "pending";

export interface VerifyResult {
  status: VerifyStatus;
  amountKobo: number;
  reference: string;
  paidAt?: Date;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  initialize(order: OrderIntent): Promise<InitResult>;
  verify(reference: string): Promise<VerifyResult>;
  validateWebhookSignature(rawBody: string, signature: string | undefined): boolean;
  /** Provider-unique event id for webhook idempotency (null = unprocessable). */
  eventId(event: unknown): string | null;
  eventType(event: unknown): string;
  /** Reference (transaction id) this event settles. */
  eventReference(event: unknown): string | null;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

export function isTestMode(): boolean {
  return (process.env.PAYMENTS_TEST_MODE ?? "true") !== "false";
}

export function defaultProvider(): ProviderName {
  const p = (process.env.PAYMENT_PROVIDER ?? "mock").toLowerCase();
  return p === "paystack" || p === "flutterwave" ? p : "mock";
}

// ---------------------------------------------------------------------------
// Mock provider — local E2E without real money. Behaves like a real provider:
// initialize returns a reference + a local pay page; completion happens only
// through the webhook pipeline (never by client assertion).
// ---------------------------------------------------------------------------
export class MockPaymentProvider implements PaymentProvider {
  readonly name: ProviderName = "mock";

  async initialize(order: OrderIntent): Promise<InitResult> {
    const reference = `mock_${order.orderId.slice(-8)}_${randomBytes(4).toString("hex")}`;
    const base = (process.env.PAYMENT_CALLBACK_BASE ?? "http://localhost:4000").replace(/\/$/, "");
    return {
      reference,
      authorizationUrl: `${base}/api/v1/payments/mock/pay/${reference}`,
      raw: { mock: true, orderId: order.orderId, amountKobo: order.amountKobo },
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    // Server-side truth only: success iff WE recorded a mock completion for it.
    const done = MockCompletions.has(reference);
    return {
      status: done ? "success" : "pending",
      amountKobo: MockCompletions.get(reference) ?? 0,
      reference,
      paidAt: done ? new Date() : undefined,
      raw: { mock: true, completed: done },
    };
  }

  validateWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = env("MOCK_WEBHOOK_SECRET") ?? "dev-mock-secret-change-me";
    if (!signature) return false;
    const mac = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(mac), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  sign(rawBody: string): string {
    const secret = env("MOCK_WEBHOOK_SECRET") ?? "dev-mock-secret-change-me";
    return createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  eventId(event: unknown): string | null {
    const e = event as { eventId?: unknown };
    return typeof e?.eventId === "string" && e.eventId ? `mock:${e.eventId}` : null;
  }

  eventType(event: unknown): string {
    return (event as { event?: unknown })?.event === "charge.success" ? "charge.success" : "mock.payment";
  }

  eventReference(event: unknown): string | null {
    const e = event as { reference?: unknown };
    return typeof e?.reference === "string" ? e.reference : null;
  }
}

/** Server-side record of mock user payments (test stand-in for provider ledger). */
export const MockCompletions = new Map<string, number>();

// ---------------------------------------------------------------------------
// Paystack — https://paystack.com/docs/api
// Secrets: PAYSTACK_SECRET_KEY (server-to-server + webhook HMAC-SHA512).
// Amounts in kobo. Webhook event: charge.success → data.reference.
// ---------------------------------------------------------------------------
export class PaystackProvider implements PaymentProvider {
  readonly name: ProviderName = "paystack";
  private base = "https://api.paystack.co";

  private key(): string {
    const k = env("PAYSTACK_SECRET_KEY");
    if (!k) throw new Error("PAYSTACK_SECRET_KEY not configured.");
    return k;
  }

  async initialize(order: OrderIntent): Promise<InitResult> {
    const res = await fetch(`${this.base}/transaction/initialize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: order.email,
        amount: order.amountKobo,
        reference: `edufarm_${order.orderId.slice(-12)}_${randomBytes(4).toString("hex")}`,
        callback_url: order.callbackUrl,
        metadata: { ...order.metadata, edufarm_order_id: order.orderId },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: boolean; message?: string;
      data?: { reference?: string; authorization_url?: string; access_code?: string };
    };
    if (!res.ok || !data.status || !data.data?.reference)
      throw new Error(`Paystack initialize failed: ${data.message ?? res.status}`);
    return {
      reference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      raw: data,
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    const res = await fetch(`${this.base}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.key()}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: boolean;
      data?: { status?: string; amount?: number; reference?: string; paid_at?: string };
    };
    if (!res.ok || !data.status || !data.data)
      throw new Error(`Paystack verify failed: HTTP ${res.status}`);
    const ok = data.data.status === "success";
    return {
      status: ok ? "success" : "failed",
      amountKobo: data.data.amount ?? 0,
      reference: data.data.reference ?? reference,
      paidAt: data.data.paid_at ? new Date(data.data.paid_at) : undefined,
      raw: data,
    };
  }

  validateWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false;
    const mac = createHmac("sha512", this.key()).update(rawBody).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(mac), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  eventId(event: unknown): string | null {
    const e = event as { data?: { id?: unknown; reference?: unknown } };
    const id = e?.data?.id;
    if (typeof id === "number" || typeof id === "string") return `paystack:${id}`;
    return null;
  }

  eventType(event: unknown): string {
    const e = event as { event?: unknown };
    return typeof e?.event === "string" ? e.event : "unknown";
  }

  eventReference(event: unknown): string | null {
    const e = event as { data?: { reference?: unknown } };
    return typeof e?.data?.reference === "string" ? e.data.reference : null;
  }
}

// ---------------------------------------------------------------------------
// Flutterwave — https://developer.flutterwave.com/docs
// Secrets: FLW_SECRET_KEY (server-to-server) + FLUTTERWAVE_WEBHOOK_HASH
// (dashboard webhook secret, compared against the `verif-hash` header).
// Amounts in NAIRA (major units) — converted here, kobo everywhere else.
// Webhook event carries data.id (transaction id); verify server-to-server.
// ---------------------------------------------------------------------------
export class FlutterwaveProvider implements PaymentProvider {
  readonly name: ProviderName = "flutterwave";
  private base = "https://api.flutterwave.com/v3";

  private key(): string {
    const k = env("FLW_SECRET_KEY");
    if (!k) throw new Error("FLW_SECRET_KEY not configured.");
    return k;
  }

  async initialize(order: OrderIntent): Promise<InitResult> {
    const txRef = `edufarm_${order.orderId.slice(-12)}_${randomBytes(4).toString("hex")}`;
    const res = await fetch(`${this.base}/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: (order.amountKobo / 100).toFixed(2),
        currency: "NGN",
        redirect_url: order.callbackUrl,
        customer: { email: order.email },
        customizations: { title: "EDUFARM", description: `Order ${order.orderId}` },
        meta: { ...order.metadata, edufarm_order_id: order.orderId },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string; message?: string;
      data?: { link?: string; tx_ref?: string };
    };
    if (!res.ok || data.status !== "success" || !data.data?.link)
      throw new Error(`Flutterwave initialize failed: ${data.message ?? res.status}`);
    return {
      reference: data.data.tx_ref ?? txRef,
      authorizationUrl: data.data.link,
      raw: data,
    };
  }

  async verify(reference: string): Promise<VerifyResult> {
    // reference here is the Flutterwave transaction id (from the webhook event).
    const res = await fetch(`${this.base}/transactions/${encodeURIComponent(reference)}/verify`, {
      headers: { Authorization: `Bearer ${this.key()}` },
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      data?: { status?: string; amount?: number; tx_ref?: string; created_at?: string };
    };
    if (!res.ok || data.status !== "success" || !data.data)
      throw new Error(`Flutterwave verify failed: HTTP ${res.status}`);
    const ok = data.data.status === "successful";
    return {
      status: ok ? "success" : "failed",
      amountKobo: Math.round((data.data.amount ?? 0) * 100),
      reference: data.data.tx_ref ?? reference,
      paidAt: data.data.created_at ? new Date(data.data.created_at) : undefined,
      raw: data,
    };
  }

  validateWebhookSignature(_rawBody: string, signature: string | undefined): boolean {
    const expected = env("FLUTTERWAVE_WEBHOOK_HASH");
    if (!expected || !signature) return false;
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  eventId(event: unknown): string | null {
    const e = event as { data?: { id?: unknown } };
    const id = e?.data?.id;
    if (typeof id === "number" || typeof id === "string") return `flutterwave:${id}`;
    return null;
  }

  eventType(event: unknown): string {
    const e = event as { event?: unknown };
    return typeof e?.event === "string" ? e.event : "unknown";
  }

  eventReference(event: unknown): string | null {
    // Flutterwave webhooks carry the transaction id; tx_ref lives in verify data.
    const e = event as { data?: { id?: unknown } };
    const id = e?.data?.id;
    return id != null ? String(id) : null;
  }
}

export function getProvider(name: string): PaymentProvider {
  if (name === "paystack") return new PaystackProvider();
  if (name === "flutterwave") return new FlutterwaveProvider();
  return new MockPaymentProvider();
}
