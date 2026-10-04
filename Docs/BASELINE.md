# EDUFARM — Frozen Baseline

**Frozen:** 2026-10-04 · **Commit:** `7d32f78` (branch `main`, clean tree except this report)
**Remote:** `https://github.com/Noble3000/EDUFARM` · **Rule 023 in force:** local-first, no deploy without explicit instruction.

## 1. Toolchain (this device)

| Tool | Version | Source |
| :--- | :--- | :--- |
| Node.js | v24.19.0 | `node --version` |
| npm | 11.17.0 | `npm --version` |
| pnpm | 9.15.9 | `pnpm --version` (project `packageManager: pnpm@9.0.0`) |
| yarn | not installed | n/a — project is pnpm-only |
| TypeScript | 5.9.3 (root) / ^5.5.0 (workspaces) | lockfile |
| Next.js | 14.2.35 | lockfile |
| Prisma | 5.22.0 | lockfile |
| PostgreSQL | 17.7 (Postgres Pro) | `psql --version`, local service |
| PM2 | ^7.0.4 (local devDep) | `node node_modules/pm2/bin/pm2` |

## 2. Processes & ports (PM2 production, `infra/ecosystem.config.js` + `portal-static`)

| Process | Port | Purpose |
| :--- | :--- | :--- |
| edufarm-api | 4000 | Fastify API (`dist/src/main.js`) |
| web-student | 3001 | Student PWA (`next start`) |
| web-lecturer | 3002 | Lecturer console (`next start`) |
| web-admin | 3003 | Admin (`next start`) |
| portal-static | 8080 | Static `index.html`/`design.html` |

Restore after reboot/sleep: `node node_modules/pm2/bin/pm2 resurrect` from repo root.

## 3. Database (secrets redacted)

- Engine: PostgreSQL 17.7 localhost:5432 · Databases present: `edufarm`, `edufarm_test`
- Migrations: **6/6 in sync** (`prisma migrate status`: "Database schema is up to date!")
  `20260927221958_init`, `20260927225750_assessments`, `20260927234056_phase2b`,
  `20260927235817_phase3_chunks`, `20260929151903_password_hash`, `20260929154343_grades`
- Connection string lives in untracked `apps/api/.env` (gitignored ✓) and PM2 env.
  **Known issue:** the same password is also hardcoded in committed `infra/ecosystem.config.js` (FINAL_AUDIT P1).

## 4. Verification results (this freeze)

| Check | Command | Result |
| :--- | :--- | :--- |
| lint | `pnpm lint` | **FAIL (exit 1)** — `@edufarm/api`: `eslint` binary not installed (script exists, no dep/config); 3 web apps: `next lint` prompts interactively (no ESLint config) and fails non-TTY. No eslint/vitest/playwright configs exist in repo. |
| typecheck | `pnpm typecheck` (turbo) | **PASS** — 4/4 (api + 3 webs) |
| test | `pnpm test` (= `turbo run typecheck`) | **NO UNIT TESTS** — script added this freeze as alias; zero test files in repo (explicit gap, see API_GAPS §E) |
| build | `pnpm build` (turbo) | **PASS** — 4/4 after one safe fix (`clipboard` added to `IconName`; lecturer build was failing — the freeze caught a real bug) |
| healthcheck | `pnpm healthcheck` (new `scripts/healthcheck.mjs`) | **PASS** — 5/5 (api :4000, :3001, :3002, :3003, :8080) |
| smoke | `pnpm smoke` (new `scripts/smoke.mjs`) | **PASS** — 9/9 (3 role logins, enrollments, library 2+1, points 30, earnings 70000, verify queue 1, devotional) |
| **One-command verify** | `pnpm verify` (= typecheck && healthcheck && smoke) | **PASS** (lint excluded — broken, tracked below) |

Fixes applied during this freeze (safe, required to run/verify): `clipboard` IconName addition; `process.exit` → exitCode drain in both scripts (Windows libuv crash on forced exit).

## 5. Route inventory (frozen)

**App pages (23):** student `/ /login /signup /verify /courses /courses/[id] /library /grades /materials/[id] /assessments/[id]` (10) · lecturer `/ /login /signup /courses/[id]` (4) · admin `/ /login /signup /verifications /reviews /settlements /disputes /email /onboarding` (9). All return HTTP 200 (verified this freeze for 19 static + spot dynamic; full 17/17 sweep recorded in entry 016).
**Portal files:** `index.html` (unified dashboard), `design.html` (v2), `Docs/DESIGN_SYSTEM_PREVIEW.html` (v1).
**API endpoints (88):** `/health` + `/demo/login` + `/demo/users` + per-module: ai 3, announcements 2, assessments 11, auth-local 4, devotional 6, email 1, enrollments 4, grades 5, hierarchy 11, materials 7, points 2, progress 4, purchases 5, qa 4, reviews 7, settlement 3, verification 6.

## 6. Explicit failures / gaps at freeze (nothing hidden)

1. `pnpm lint` FAILs (no eslint setup) — needs `eslint` + flat config per app or removal of lint scripts.
2. Zero unit/integration/E2E tests — `pnpm test` is a typecheck alias until a runner lands.
3. Demo auth (`/demo/*`) open — gated plan exists (FINAL_AUDIT P0), not yet executed.
4. `infra/ecosystem.config.js` contains the live DB password (committed).
5. Money moves lack audit rows; expiry/bundles/ownership gaps per API_GAPS §B.
6. Device runs at 85–96% RAM with user apps — shells and node processes get OOM-killed; `pm2 resurrect` is the recovery path.

## 7. How to re-verify this baseline

```powershell
git log -1 --format="%H %s"        # baseline code freeze = 7d32f78; this report commits on top
pnpm verify                        # typecheck + healthcheck + smoke, exit 0
pnpm build                         # 4/4 green (takes ~10 min, run services stopped if RAM is tight)
```
