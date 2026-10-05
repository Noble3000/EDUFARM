# EDUFARM Payments — provider abstraction + order pipeline

> Rule: business logic NEVER touches a provider SDK. All provider code lives in
> `apps/api/src/payments/providers.ts`. Secrets live in environment variables only.

## The 11-step purchase sequence

1. Student views price + access terms → `GET /materials/:id/terms` (rendered verbatim, creates nothing).
2. Order created `pending` → `POST /materials/:id/orders` (enrollment + usable-grant + server-side points math; `idempotencyKey` dedupes retries).
3. Payment initialized → provider returns `reference` + `authorizationUrl` (stored on the order, status → `processing`).
4. User completes the provider flow (Paystack/Flutterwave page, or local mock pay page — no real money).
5. Provider webhook/callback received → `POST /payments/webhook/:provider`.
6. Webhook signature validated over RAW bytes (HMAC-SHA512 Paystack / `verif-hash` Flutterwave / HMAC-SHA256 mock). Bad signatures are stored as forensic rows and answered 400.
7. Payment verified server-to-server (`verify(reference)`); amount must equal the order — mismatches fail the order with NO grant.
8. Order marked `paid` exactly once (conditional `pending|processing → paid` transition; 0 rows = already settled).
9. Library entitlement granted exactly once (`Purchase.orderId` UNIQUE — the database is the lock; concurrent settles converge on the winner).
10. Lecturer pending eSpees recorded exactly once (`ESpeesLedger.purchaseId` UNIQUE).
11. Receipt/notification emitted (in-app + email outbox).

Grant states after payment follow the library lifecycle (`active/expiring/expired/archived/revoked/suspended`).

## Trust model (critical)

- NEVER trust client-submitted `paid=true` — no endpoint accepts a paid flag. Unknown fields are ignored.
- NEVER grant from a frontend redirect — `GET /payments/callback` only REPORTS status; only the webhook pipeline grants.
- `pending`/`failed` orders and purchases grant nothing (`assertGrant` requires `completed`).
- Webhooks are idempotent: `WebhookEvent(provider, eventId)` UNIQUE absorbs replays (prior outcome returned, no double-settle).
- Reconciliation: `GET /payments/reconcile` (staff) — counts by status/provider, `paidWithoutGrant`, invalid-signature and unprocessed events.
- Every paid order carries `providerRef` (provider's transaction reference) for provider-dashboard reconciliation.

## Providers

| Provider | Env | Select |
| :--- | :--- | :--- |
| `mock` (default) | `PAYMENTS_TEST_MODE=true`, `MOCK_WEBHOOK_SECRET` | `PAYMENT_PROVIDER=mock` or per-order `provider` |
| Paystack | `PAYSTACK_SECRET_KEY` (kobo amounts, `charge.success`) | `"provider": "paystack"` at order create |
| Flutterwave | `FLW_SECRET_KEY` + `FLUTTERWAVE_WEBHOOK_HASH` (naira amounts, converted inside provider) | `"provider": "flutterwave"` at order create |

Real providers require configuration — without keys the order fails closed with
`<provider> is not configured.` Keys are never committed (see `.env.example`).

## Test mode + local E2E (no real money)

- Default env is mock + test mode: the full 11 steps run locally.
- `POST /materials/:id/checkout` (legacy reader path) runs the whole pipeline server-side in test mode; with a real provider configured it returns 409 → create an order and follow `authorizationUrl`, then poll `GET /payments/orders/:id`.
- `POST /payments/mock/complete` + `GET /payments/mock/pay/:reference` (test page) drive the mock user step through the real webhook pipeline.
- E2E script pattern (deleted after runs — see PRD entries): terms → order → 402 pre-payment → complete → exactly-once asserts → replay ×3 → tamper 400 → reconcile clean.

## What is intentionally NOT here

- No card data ever touches EDUFARM (provider-hosted pages only).
- No bundle checkout yet (`POST /bundles/:id/checkout` gap tracked in `Docs/API_GAPS.md`).
- Settlement payouts stay manual (`settlement pay` uses `dev-cash` refs; Transfer API later).
