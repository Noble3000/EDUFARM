# EDUFARM — External Services (wired vs mocked)

**Standing rule 023 applies:** no hosted migration and no paid-service activation without explicit owner instruction.
Tunnels (`trycloudflare.com`) are temporary local exposure, not deployments.

| Service | Status | Used for | To wire for real (owner steps) |
| :--- | :--- | :--- | :--- |
| Cloudflare R2 | **MOCK** (`fileKey: dev/mock.pdf`, mock page URLs) | Protected originals + rendered pages + backups | 1. Owner creates R2 account → bucket `edufarm-materials` (private), `edufarm-pages`, `edufarm-backups`. 2. Paste `R2_ACCOUNT_ID / ACCESS_KEY / SECRET` into `apps/api/.env` (never git). 3. Agent implements presigned PUT (upload) + short-lived GET (pages) + render worker + `MaterialFile` model. |
| Paystack | **MOCK** (instant-completed checkout) | Naira charges, transfers (settlement payouts), webhooks | 1. Owner creates Paystack account → **test** secret/public keys. 2. Paste into `.env`. 3. Agent implements inline checkout init + webhook verify + idempotency keys + `PAYSTACK_WEBHOOK_SECRET`; settlement `pay` switches from `dev-cash` refs to Transfer API. Flutterwave stays fallback. |
| LLM (OpenAI/Anthropic) | **MOCK** (extractive FTS snippets) | Generative answers with citations, topic clustering for insights | 1. Owner provides one API key + monthly cap. 2. Agent adds `LLM_API_KEY`, server-side call with entitlement-filtered chunks, token budgets, eval gate (≥85% grounded). |
| Email (Resend/Postmark) | **MOCK** (outbox log + console) | Receipts, grades, deadlines, settlements | 1. Owner provides key + verified sender domain. 2. Agent adds worker draining `EmailLog(status=logged)` → sent/failed + retry. |
| pgvector | **ABSENT** (extension missing in Postgres Pro 17.7) | Vector retrieval upgrade | Install pgvector build for Postgres Pro, or migrate DB to community Postgres 16/17. Then backfill embeddings. |
| Devotional source | **PLACEHOLDER** (`sourceRef: seed-placeholder`) | Licensed daily Word | Owner secures written authorization; agent swaps seed content + stores license proof (`Docs/`). |
| Better Auth infra | **TABLES ONLY** (handler unmounted) | Sessions/2FA/OAuth | No external key needed for email+password+TOTP. OAuth (Google) needs client id/secret later. |
| PostHog/analytics | **ABSENT** | Funnels per PRD §19 | Self-host later or use event tables + Metabase; no action now. |
| Push (Web Push/FCM) | **ABSENT** | Mobile notifications | Needs VAPID keys + service-worker push handler; after PWA stable. |
| Hosting/CDN/domain | **ABSENT by rule** | Public deployment | Only on explicit "deploy". Current: PM2 + Caddyfile present, tunnel-tested. |

## Key/cost checklist for the owner (when ready, one service at a time)

- [ ] R2 account + 3 private buckets + API token
- [ ] Paystack test keys + webhook secret + test bank details
- [ ] One LLM key + spend cap
- [] Sender domain + Resend/Postmark key
- [ ] Devotional written authorization
- [ ] Decision: stay on Postgres Pro (find pgvector build) or switch to community Postgres

## Security notes

- Secrets live in `apps/api/.env` (gitignored ✓) **except** the DB password committed in `infra/ecosystem.config.js` — move before any shared use (API_GAPS §B).
- Tunnel URLs in `logs/` are gitignored ✓ but anyone holding a link + demo-login can impersonate — see FINAL_AUDIT §C.
- Never commit `.env`, `*-key*.json`, or tunnel URLs. Rotate any key that touches chat/logs.
