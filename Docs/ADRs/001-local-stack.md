# EDUFARM ADR 001 — Local-first stack (locked 2026-09-27)

**Status:** Accepted. **Owner steering:** local Postgres, Better Auth, Cloudflare R2. No Supabase. No Vercel. Host on local device.

## Decision
- Web: 3× Next.js 14 self-hosted (`next start` :3001/:3002/:3003) behind Caddy :80.
- API: Fastify/NestJS + Prisma on :4000, PM2 supervised.
- DB: PostgreSQL 16 native on this device (`edufarm` + `edufarm_test`, `vector` ext). Backups `pg_dump` → R2.
- Auth: Better Auth + Prisma Postgres adapter, TOTP for staff, role-gated routes.
- Storage: Cloudflare R2 private buckets only, 60s presigned page URLs.
- AI: local FastAPI worker :8001 + pgvector, entitlement-scoped RAG.
- Deploy: `git pull + prisma migrate deploy + pm2 restart` on this device. Demos via Cloudflare Tunnel.

## Consequences
- No subscription infra. Device must stay on; Postgres service auto-start; weekly backup-restore test.
- 8GB RAM: prefer native Postgres over Docker Desktop; defer Redis (use pg-boss).
- R2 is the only cloud dependency (plus Paystack/LLM APIs).

## Alternatives rejected
Supabase (subscription + Auth/Storage lock-in), Vercel (hosting lock-in), Neon/RDS, Firebase Auth, public buckets.
