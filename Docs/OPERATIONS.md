# EDUFARM Local Operations — runbook (this device only)

> Standing rule: everything runs on the owner's local device. No cloud
> deploys unless explicitly requested. This file is the recovery manual.

## Normal state

- 5 PM2 processes: `edufarm-api` (:4000), `web-student` (:3001),
  `web-lecturer` (:3002), `web-admin` (:3003), `portal-static` (:8080).
- Typical RSS 55–90MB each; caps are api 450M / webs 400M / portal 200M.
- Postgres 17 runs as a Windows service with `edufarm` (+ `edufarm_test`) DBs.

## Daily checks

```powershell
node scripts/ops-report.mjs        # processes, memory, CPU, ports, DB, latency
node scripts/healthcheck.mjs       # quick HTTP reachability (also: pnpm verify)
```

`ops-report` exits 1 on: process missing/not-online, memory over cap,
flapping (≥10 restarts with <120s uptime), closed port, `/health` bad/slow,
`/ready` not-ready, system RAM >94%. High restart counts alone only warn
(frequent local redeploys look like churn, not failure).

## Recovery from total process shutdown

Symptoms: all `localhost` ports refuse connections, `pm2 ls` empty.

```powershell
cd C:\Users\HomePC\Downloads\EDUFARM
node node_modules/pm2/bin/pm2 resurrect   # restores the saved dump
node scripts/ops-report.mjs               # confirm green
```

If resurrect restores nothing (dump lost):

```powershell
node node_modules/pm2/bin/pm2 start infra/ecosystem.config.js
node node_modules/pm2/bin/pm2 save
```

If the API exits during boot, read the boot log first — it waits for
Postgres with backoff and says why:

```powershell
node node_modules/pm2/bin/pm2 logs edufarm-api --lines 30 --nostream
```

Database checklist (in order):

1. Postgres Windows service running? (Services → postgresql-x64-17).
2. `prisma migrate status` from `apps/api` — apply with `migrate deploy`.
   `/ready` reports `migrations-pending` with the count when behind.
3. Seed only if demo users are missing: `pnpm --filter @edufarm/api exec tsx prisma/seed.ts`.

## OOM playbook (this 8GB box)

1. Close heavy desktop apps first (browser/Spotify/Figma/TradingView have
   killed node processes at ~96% RAM before).
2. `ops-report` shows per-process RSS; a process AT its cap restarts itself —
   that is the guard working, not a failure.
3. **No-mask rule: never raise memory caps or add RAM-hungry caching to hide
   a leak.** Evidence first: `/ready` exposes `cache` stats (bounded at 500
   entries with eviction counters) and `/health` exposes heap MB. A leak shows
   as steady RSS growth between deploys — find it (heap snapshot, unbounded
   structure, missing cleanup) instead of masking it.

## Queues and webhooks after a crash

- Email outbox: rows stuck in `sending` reset to `queued` automatically at API
  boot (event keys make re-sends safe). Trigger delivery:
  `POST /email/drain` (platform admin). Failed rows keep `lastError`;
  `POST /email/:id/retry` re-queues.
- Payment orders stuck in `processing` are NEVER force-paid: a late provider
  webhook still settles them via server-to-server verify. `GET
  /payments/reconcile` (staff) lists `paidWithoutGrant` mismatches (expect: none).
- Payment webhooks: providers retry delivery themselves; replays are absorbed
  by the `(provider, eventId)` unique key.

## Logs

Per-service files in `logs/` (gitignored): `api`, `web-student`,
`web-lecturer`, `web-admin`, `portal` (`.out.log` / `.err.log`). Rotate with
`pm2-logrotate` (see `infra/ecosystem.config.js` header). API request logs go
through Fastify; unhandled errors return `{ error: "internal", id }` with the
full trace server-side only.

## Ports quick reference

:4000 api (`/health` alive, `/ready` ready) · :3001 student · :3002 lecturer ·
:3003 admin · :8080 portal static.

## Mobile & PWA Access (LAN / Tunnel)

All 4 web surfaces are Progressive Web Apps configured for standalone mobile use.

### Option A: Local Wi-Fi / LAN (Zero-tunnel, fastest on same router)
1. Find PC IPv4 address: `ipconfig` (e.g. `192.168.1.150`).
2. Open on phone browser:
   - Portal: `http://192.168.1.150:8080`
   - Student: `http://192.168.1.150:3001`
   - Lecturer: `http://192.168.1.150:3002`
   - Admin: `http://192.168.1.150:3003`
3. The web apps automatically detect the LAN IP and direct API calls to `http://192.168.1.150:4000/api/v1`.
4. Install to home screen: Tap the in-app "Install" banner or browser menu "Add to Home Screen".

### Option B: Remote / Cellular via Cloudflare Quick Tunnel
1. Start tunnel for API:
   ```powershell
   cloudflared tunnel --url http://localhost:4000
   ```
2. Start tunnel for Student app:
   ```powershell
   cloudflared tunnel --url http://localhost:3001
   ```
3. On phone, load the Student app tunnel URL with the API query parameter:
   `https://<student-tunnel>.trycloudflare.com/?api=https://<api-tunnel>.trycloudflare.com/api/v1`
4. The API URL is persisted to `localStorage['edufarm_api']` for all subsequent sessions.

### Offline Protection & Policy Verification
- Safe shell caching: The service worker caches static assets (`/manifest.webmanifest`, CSS/JS bundles, icons, shell layout).
- Protected material rule: When a phone goes offline (Airplane mode), the UI displays the `<OfflineNotice />`. Opening course reading materials strictly enforces the network guard, showing the "Protected Material Offline Policy" alert. Course materials, streaming tiles, and assessments are NEVER stored in persistent offline caches.
