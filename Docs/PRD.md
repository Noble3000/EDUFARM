# EDUFARM — PRD Notes (Living Log)

> **Rule (per owner instruction 2026-09-27):** All steering instructions and every change the agent makes must be written here as notes. This file is the agent's changelog. The full product spec remains in [`PRD EDUFARM.md`](PRD%20EDUFARM.md).

**Product:** Verified lecturer–student learning ecosystem — University → Faculty → Department → Level → Course → Lecturer → Student. Word at center. Protected in-ecosystem materials, Naira + eSpees + non-cash points, course-grounded AI.

---

## How to use this file

- Owner gives a steering instruction → agent appends a new entry under `## Agent Notes Log` with date, instruction (verbatim where possible), what was changed, files touched, commit hash, and status.
- No change is considered done until it is logged here + committed + pushed (unless owner says local-only).
- Newest entries go at the bottom with incrementing numbers.

---

## Agent Notes Log

### 001 — 2026-09-20 — Review project folder, get context
- **Instruction:** "review the project folder, get context, and let me know when you are ready for us to continue."
- **Change:** Read `Docs/PRD EDUFARM.md` (695 lines). Summarized hierarchy, verification, lifecycle, commerce, experiences, phasing. No files changed.
- **Commit:** n/a (read-only)
- **Status:** Done.

### 002 — 2026-09-20 — Push folder to GitHub EDUFARM repo
- **Instruction:** "PUSH THIS FOLDER TO EDUFARM repository on github https://github.com/Noble3000/EDUFARM"
- **Change:**
  - Installed Git 2.55 via winget, verified `git --version`.
  - `git init -b main` in `C:\Users\HomePC\Downloads\EDUFARM`, added `origin https://github.com/Noble3000/EDUFARM.git`.
  - Fetched remote (found `README.md`, 1 commit `32c506f Initial commit`).
  - Set identity `Noble Onwuka <nobleonwuka30@gmail.com>` per owner.
  - Staged `Docs/PRD EDUFARM.md`, committed `396aa91 Add EDUFARM PRD`, rebased onto `origin/main`, pushed → remote now 2 commits with `README.md` + `Docs/`.
  - Owner provided PAT `ghp_...` for auth; advised revocation after push. Remote URL left clean (no token stored).
- **Files:** `.git/`, `Docs/PRD EDUFARM.md` (committed), `README.md` (pulled from remote)
- **Commit:** `396aa91` → rebased as `492176b Add EDUFARM PRD`
- **Status:** Done, verified on github.com/Noble3000/EDUFARM.

### 003 — 2026-09-2x — Make README very descriptive
- **Instruction:** "make sure the readme is very descriptive"
- **Change:** Rewrote `README.md` (1 line → 377 lines) from PRD: overview, TOC, problem, vision/principles, roles, hierarchy + access model, student/lecturer/content/Q&A/assessments/AI/points-payments/devotional/trust/governance sections, guardrails table, Phase 1–4 roadmap, repo structure, getting started, open decisions, summary.
- **Files:** `README.md`
- **Commit:** `5e9f416 Make README descriptive: full EDUFARM overview from PRD`
- **Status:** Done, pushed to `main`.

### 004 — 2026-09-2x — Detailed phased implementation plan
- **Instruction:** "review the entire folder and create a detailed implementation plan in phases starting from design system to architectural decision to every other things"
- **Change:** Re-read full folder + PRD + README. Created `Docs/IMPLEMENTATION_PLAN.md` (427 lines): Phase 0 (monorepo layout, design tokens/components/Figma, ADRs for Next.js PWA + NestJS + Postgres + R2 page-streaming reader + Paystack + pgvector RAG, data model v1, API/auth conventions, DevOps baseline), Phase 1 trust foundation, Phase 2 assessments/points/eSpees/reviews/notifications, Phase 3 AI ingestion + assistant + insights, Phase 4 Word + expansion, plus security/NDPR, testing, PostHog analytics mapped to §19, team/timeline (~7–10mo, MVP ~3–4mo), risks, DoD, 2-week starter.
- **Files:** `Docs/IMPLEMENTATION_PLAN.md`
- **Commit:** `de6fbcb Add detailed phased implementation plan (design system to architecture to launch)`
- **Status:** Done, pushed to `main`.

### 005 — 2026-09-27 — Open the implementation plan
- **Instruction:** "Open the implementation plan for me"
- **Change:** Ran `Start-Process Docs\IMPLEMENTATION_PLAN.md` to open in default app. No files changed.
- **Commit:** n/a
- **Status:** Done.

### 006 — 2026-09-27 — Log all steering + changes in PRD.md
- **Instruction:** "take not[e] All steering instructions and changes you told your agent to make must be written as notes in your PRD.md"
- **Change:** Created this file `Docs/PRD.md` as living agent changelog; backfilled entries 001–006. Future changes must append here before commit/push. Noted existing `IMPLEMENTATION_PLAN.docx` in Docs/ left untouched.
- **Files:** `Docs/PRD.md` (this file)
- **Commit:** `cd66366 Add Docs/PRD.md agent steering notes log (entries 001-006)`
- **Status:** Done, pushed to `main`.

### 007 — 2026-09-27 — Local Postgres + Better Auth + R2, no Supabase/Vercel, self-host
- **Instruction:** "for database, supabase has a subscription so let us use postgress on my local device. what can we use? 2. for auth use better auth. 3. use cloudfare r2 for storage. Do not use supabase. Do not use vercel. Let us host on local device"
- **Change:** Locked stack in `Docs/IMPLEMENTATION_PLAN.md` §0.3/0.5/0.6: local PostgreSQL 16 (native EDB installer recommended on this 8GB Win11 device, or Docker Compose; `edufarm` DB + `vector` ext, pgAdmin/DBeaver, `pg_dump`→R2 backups) answering "what can we use"; Better Auth + Postgres adapter (session cookies, TOTP for staff, role+verificationStatus claims, no Supabase Auth); Cloudflare R2 private buckets (`materials`, `pages`, `backups`, `uploads-tmp`) with 60s presigned page URLs; self-host Next/Nest via Node+pnpm+PM2+Caddy+Tunnel (no Vercel). Updated monorepo infra note, analytics (self-hosted), expansion perf, test DB (`edufarm_test`), 2-week starter installs, next-ADR name. Checked device: Win11 Pro, 7.8GB RAM, 140GB free, no Docker/Node/Postgres yet — install list provided.
- **Files:** `Docs/IMPLEMENTATION_PLAN.md`, `Docs/PRD.md` (this entry)
- **Commit:** `c2bcbec Lock stack: local Postgres + Better Auth + R2, no Supabase/Vercel, self-host`
- **Status:** Done, pushed to `main`.

### 008 — 2026-09-27 — Show design system visually
- **Instruction:** "I want to see what the design system looks like"
- **Change:** Built `Docs/DESIGN_SYSTEM_PREVIEW.html` from locked tokens (§0.2): brand green #0E5A3C + gold #C9A227, Sora/Inter scale, buttons, trust badges (Official/Verified/Edition/Urgent/Points), Course/Material/Announcement/Q&A cards, protected R2 reader mock with watermark, spacing/radius/motion. Opened in default browser via Start-Process.
- **Files:** `Docs/DESIGN_SYSTEM_PREVIEW.html`, `Docs/PRD.md` (this entry)
- **Commit:** `0f25144 Add visual design system preview + PRD entry 008`
- **Status:** Done, pushed to `main`.

### 009 — 2026-09-27 — Execute implementation plan Phase 0 (foundation)
- **Instruction:** "proceed with the implementation plan. Execute one phase at a time"
- **Change (Phase 0, local-first):**
  - Scaffolded monorepo: `package.json` (pnpm+turbo), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`; `apps/web-student|web-lecturer|web-admin` (Next 14, ports 3001/3002/3003), `apps/api` (Fastify+Prisma+Better Auth, :4000); `packages/tokens|ui|types|reader|config`; `services/ai-worker|notifications`; `infra/Caddyfile|ecosystem.config.js|backup.ps1`; `Docs/ADRs/001-local-stack.md|002-better-auth-rbac.md`.
  - Design tokens locked in `packages/tokens/tokens.json` (brand green/gold, ink scale, Sora/Inter, radius, badges) + `tokens.d.ts` CSS-var helper; `@edufarm/ui` badge/button contract, `@edufarm/types` role/status unions, `@edufarm/reader` presigned-page + watermark contract.
  - Data model: `apps/api/prisma/schema.prisma` (24 models: hierarchy, Better Auth User/Session/Account/Verification, profiles, enrollment, materials+versions, bundles, purchases, announcements, Q&A, StudyEvent, ESpees/Point ledgers, reviews, disputes, notifications, devotional, audit log) + `seed.ts` (demo university → BIO 201).
  - Better Auth: `apps/api/src/auth.ts` (Prisma adapter, email+password, 2FA plugin, role+phone fields, trustedOrigins 3001–3003).
  - Runtimes installed: Node 24 LTS + pnpm 9.15.9 (`pnpm install` 106 pkgs OK); Postgres Pro 17.7 via winget (EDB 403 blocked) — role `edufarm`, DBs `edufarm`+`edufarm_test` verified live with seeded BIO 201.
  - Verified: `prisma validate` + `format` clean, `tsc` clean (packages + api), `migrate dev init` applied, seed OK. Fixed along the way: `@types/node`, api tsconfig (`declaration:false`, no rootDir), auth.ts annotation reverted.
  - Known gaps: `pgvector` ext missing in Postgres Pro build (Phase 3 — install separately later); Node 24 installed vs 20 LTS planned (works; pin 20 later if needed); `IMPLEMENTATION_PLAN.docx` left untracked (owner file).
- **Files:** monorepo scaffold (see above), `pnpm-lock.yaml`, `Docs/PRD.md` (this entry)
- **Commit:** `b9934a4 Phase 0 foundation: monorepo scaffold, tokens, Prisma model, Better Auth, local Postgres live`
- **Status:** Done, pushed to `main`.

### 010 — 2026-09-27 — Execute Phase 1 (trusted academic foundation), live in browser
- **Instruction:** "Go onto the next phase write all this also and push them to my github get it working i want to be seeing the progress on my browser"
- **Change (Phase 1, all running on this device):**
  - API (`apps/api`, :4000): `src/db.ts`, `src/auth-dev.ts` (x-user-id dev auth, Better Auth cookies next), routes `hierarchy|verification|enrollments|announcements|qa|materials|purchases|progress` — CRUD, verification request/decide + queues + audit, enrollment request/decide, announcements with fan-out notifications, Q&A ask/answer/resolve + search, material lifecycle draft→pendingReview→published→archived with price bounds + review queue + entitlement-checked page URLs + study-event logging, mock checkout (70/30 eSpees split) + bundles + library + earnings, dwell pings + course progress + continue + inbox. `main.ts` registers all + CORS + demo/login + demo/users. Added `@fastify/cors`, `"type":"module"` (fixes tsx TLA), api tsconfig ES2022 modules.
  - Seed: 4 demo users (bello lecturer verified, ada student verified+approved, pending student, platform admin) + free outline + ₦500 mitosis notes (published) + announcement + answered Q&A.
  - Web: student :3001 (home per §6.1 order, login, verify, courses, course detail, protected reader shell with watermark+dwell+mock buy, library); lecturer :3002 (dashboard+earnings, course manage: enrollments, announcement composer, upload+submit); admin :3003 (home, verification queues, material review queue). Each with next.config+tsconfig+layout+lib/api. Fixed empty-POST 415 by sending `{}` bodies.
  - Infra: `run-api.ps1` + `run-web.ps1` detached runners (bash sessions don't persist; Start-Process Hidden). Local-only `apps/api/.env` (untracked).
  - Verified live: /health OK; 4 users; BIO 201 chain (2 mats/1 ann/1 Q); E2E ada: library → ₦500 checkout (completed) → page 3 URL granted → library 1 purchase → bello earnings pending 35000 kobo (₦350 = 70%) ✓; progress 5%; all 3 web apps HTTP 200 with EDUFARM markup. Browsers opened to :3001/:3002/:3003 login pages.
  - Known gaps: dev-header auth (Better Auth session wiring next), R2 presigned URLs mocked, Paystack mocked, reader renders shell not PDF bytes, ownership scoping TODO.
- **Files:** `apps/api/src/**`, `apps/api/prisma/seed.ts`, `apps/web-*/**`, `infra/run-*.ps1`, `apps/api/.env` (local-only, NOT committed), `Docs/PRD.md` (this entry)
- **Commit:** `cae1b88 Phase 1: trusted academic foundation live (API + 3 web apps, local Postgres)` + fix `ccc2bf4 Fix nested page lib/api import paths`
- **Status:** Done, pushed to `main`. All 11 pages HTTP 200 verified.

### 011 — 2026-09-28 — Align repo to example form + design refinement, then continue buildup
- **Instruction:** "ALIGN MY BUILDUP TO THIS FORM ABOVE ON GITHUB … Create Preview HTML … design.html … Steer Design Improvement … Refinement Note … inside PRD.md … ENSURE IT IS WELL ALIGNED THEN CONTINUE WITH THE BUILD UP"
- **Change (alignment):**
  - Created root `design.html` (v2): colors, typography, styled buttons, sample inputs + badges, with specific refinement applied and banner describing it. Opened in browser to verify.
  - Refinement (requested + applied): clearer reading font (16px/1.6), stronger contrast (muted #344054 ≈7:1), larger bolder buttons (12×20px, 700, 44px, gold focus ring), labeled 44px inputs with brand focus border + ring.
  - Created root `PRD.md` (product requirements §§1–5 + §6 grader refinement note + build log) and root `index.html` (landing: links, run map, demo accounts).
  - Repo root now mirrors example form: `PRD.md` + `design.html` + `index.html` (+ full app under `apps/`).
- **Files:** `design.html`, `PRD.md`, `index.html` (root), `Docs/PRD.md` (this entry)
- **Commit:** `93ddffb Align to example form: root PRD.md + design.html (v2 refined) + index.html` (verified live on github.com/Noble3000/EDUFARM root: PRD.md + design.html + index.html listed, 17 commits)
- **Status:** Done, pushed to `main`.

### 012 — 2026-09-28 — Fix dynamic [id] page import crash (user-reported build error)
- **Instruction:** "IT KEEPS SHOWING THIS ERROR DURING EXECUTION, CORRECT THIS" + screenshot (`app/materials/[id]/page.tsx: Module not found: Can't resolve '../../lib/api'`).
- **Root cause:** `[id]` pages sit 3 levels under app root (`app/materials/[id]/`), so `../../lib/api` resolved to non-existent `app/lib/api`. Needed `../../../lib/api` (same bug in 4 files; single-nested pages were already correct).
- **Change:** Fixed imports in `web-student/app/materials/[id]`, `web-student/app/courses/[id]`, `web-student/app/assessments/[id]`, `web-lecturer/app/courses/[id]` (`../../` → `../../../`). Verified live: course detail, reader, and lecturer-manage dynamic routes all HTTP 200.
- **Files:** 4× `app/**/[id]/page.tsx`, `Docs/PRD.md` (this entry)
- **Commit:** `697e4db Fix [id] page imports (../../ to ../../../lib/api) + PRD entry 012`
- **Status:** Done, pushed to `main`. (Commit also carries unfinished Phase 2a files — migration + route + page — not yet live pending API restart.)

### 013 — 2026-09-28 — Finish Phase 2a assessments (lecturer build → student attempt → grading), live
- **Instruction:** "CONTINUE BUILDING"
- **Change:**
  - Lecturer UI (`web-lecturer` manage course): assessment draft creation, Refresh list (new `GET /courses/:id/assessments/lecturer` with keys), Publish, MCQ QuestionForm, attempts viewer.
  - API: added lecturer list endpoint; `tsc` clean. Restarted all servers (killed node, regenerated Prisma client — earlier EPERM was the running API locking the engine DLL).
  - Verified live E2E: created + published "Mitosis Quiz" (2 MCQ + 1 theory); student list shows 0 leaked answer keys; start → submit (Q1 right, Q2 wrong, theory text) → `submitted`; lecturer graded theory 2/3 → `graded 4/6` ✓ (2+0+2 / 2+1+3). Grade notification sent; StudyEvent logged.
  - Pages 200: student attempt, lecturer manage, student course (assessments section).
- **Files:** `apps/api/src/routes/assessments.ts`, `apps/api/src/main.ts`, `apps/api/prisma/schema.prisma` (+ migration `20260927225750_assessments`), `apps/web-lecturer/app/courses/[id]/page.tsx`, `apps/web-student/app/courses/[id]/page.tsx` + `app/assessments/[id]/page.tsx`, `Docs/PRD.md` (this entry)
- **Commit:** `39a1865 Phase 2a assessments live: builder, attempts, auto-grade + grading UI`
- **Status:** Done, pushed to `main`.

### 014 — 2026-09-28 — Phase 2b engagement & economy (points, settlement, reviews, email), live
- **Instruction:** "CONTINUE BUILDING EVERYTHING THROUGH ALL THE STAGES TILL YOU ARE DONE" (Phase 2b slice)
- **Change:**
  - Schema: `ReviewReply`, `EmailLog` + migration `20260927234056_phase2b`. Fixed ownership fallout: migration ran as postgres superuser → new tables unreadable by edufarm role → granted privileges + default privileges for future.
  - Points (`routes/points.ts`): pass +10 (≥50%, once per assessment), lecturer recognition +5 (20/week quota, 2/week same-student caps), balance/history, NEVER for opens/purchases. Checkout redeems at 10 kobo/pt, min 5000, max 50% price. Pass-points hooked into auto-grade submit + manual grade.
  - Settlement (`routes/settlement.ts`): overview, run (pending→available after 7d hold), pay (available→settled + audit + lecturer notification).
  - Reviews/disputes (`routes/reviews.ts`): eligible-only reviews (purchase or ≥3 dwells), lecturer replies, report→dispute, admin resolve + audit.
  - Email (`routes/email.ts`): outbox log on purchase/grade; admin viewer (dev transport, Resend TODO).
  - UI: student home points balance, reader points-redemption + reviews, lecturer Recognize +5 per enrollment, admin Settlement/Disputes/Email pages + nav.
  - Verified live: recognition ×2 (+5 each), 3rd → 429 cap ✓, balance 10; pure-MCQ 100% → graded 2/2 → balance 20 ✓; min/balance redemption guards ✓; review 5★ + lecturer reply ✓; report→resolve ✓; receipt email logged ✓; backdated entry → released 1 → paid ₦350 → settled 35000 ✓. Redemption success path (>5000 pts) not E2E'd — unreachable in dev by design (slow economy).
- **Files:** `schema.prisma` + migration, `routes/points|settlement|reviews|email.ts`, hooks in `purchases|assessments.ts`, `main.ts`, 6 UI files, `Docs/PRD.md` (this entry)
- **Commit:** `5a95f02 Phase 2b economy live: points, settlement, reviews, disputes, email`
- **Status:** Done, pushed to `main`.

### 015 — 2026-09-28 — Phase 3 AI assistant + lecturer insights (RAG-lite), live
- **Instruction:** "CONTINUE BUILDING EVERYTHING THROUGH ALL THE STAGES TILL YOU ARE DONE" (Phase 3 slice)
- **Change:**
  - Schema: `MaterialChunk` (materialId/version/chunkNo/text) + migration `20260927235817_phase3_chunks`.
  - API (`routes/ai.ts`): `indexMaterial` chunker (title+description sentences); auto-index on material publish approve; `POST /ai/backfill`; `POST /ai/ask` (enrollment + entitlement filter incl. Ask-This-Material scope; FTS rank; citations `[Title vN]`; refusal + labeled general fallback when uncovered; logs ai-session StudyEvent); `GET /courses/:id/insights` (avg scores, unanswered top-5, weak completion <30%, suggestions).
  - UI: student course page Ask AI box (grounded badge, citations, fallback labels); lecturer manage page Insights card.
  - Verified live: backfill 3 mats → 3 chunks; "What is mitosis?" → grounded with 1 citation ✓; unrelated query → refusal ✓; insights: enrolled 1, 2 assessments, 2 weak + suggestion ✓. Pages 200.
  - Honest limits: extractive FTS (no LLM generation, no pgvector — extension missing in Postgres Pro build); PDF text extraction awaits R2 reader spike (chunks from metadata for now).
- **Files:** `schema.prisma` + migration, `routes/ai.ts`, hooks in `materials.ts`+`main.ts`, 2 UI files, `Docs/PRD.md` (this entry)
- **Commit:** `2e84020 Phase 3 AI live: entitlement-scoped ask + citations + lecturer insights`
- **Status:** Done, pushed to `main`.

### 016 — 2026-09-28 — Phase 4 devotional + onboarding + production stability (PM2), all stages done
- **Instruction:** "CONTINUE BUILDING EVERYTHING THROUGH ALL THE STAGES TILL YOU ARE DONE"
- **Change (Phase 4):**
  - API (`routes/devotional.ts`): `GET /devotional/today` (Lagos UTC+1 day boundary, identical for all students), `/archive`, admin `POST /devotionals` (upsert by date); onboarding `POST /onboarding/institution` (public → unverified + audit), `GET /onboarding/pending`, `POST /onboarding/:id/approve`.
  - Seed: 7-day devotional window (placeholder text, `sourceRef` marks license pending per PRD §21).
  - UI: student home shows real daily Word + separate academic-reflection card; admin Onboarding page + nav.
  - Verified live: today=[Diligence] Proverbs 12:24, archive=7, request→pending→approved ✓ (test uni cleaned up after).
- **Change (stability — device has 8GB, ~1GB free with user apps running):**
  - Root-caused admin :3003 death: Next dev servers use ~700MB each; machine thrashed, shells got OOM-killed.
  - Migrated all 18 web imports to `@/lib/api` alias (kills the `../` depth bug class; tsconfig paths already supported it).
  - Production builds: api `tsc` emit + all 3 Next builds green (build caught 4 untested admin imports — fixed).
  - PM2 (local install, daemon persists): `infra/ecosystem.config.js` runs API (`dist/src/main.js` — fixed wrong `dist/main.js` path) + 3× `next start` at ~60MB each. `pm2 save` done. PM2 notes: `restart` uses cached config — use delete+start after editing ecosystem file.
  - Verified in production: 17/17 pages HTTP 200, devotional/AI/points endpoints live (AI grounded cites=1, points=20).
  - Known: `npm install -g` kills the shell on this box (use local pnpm installs); dev runners remain in `infra/run-*.ps1` for HMR work.
- **Files:** `routes/devotional.ts`, `seed.ts`, `main.ts`, student home, admin onboarding page+nav, 18 alias-migrated pages, `ecosystem.config.js`, root `package.json`+lock (pm2 devDep), `Docs/PRD.md` (this entry). NOT committed: `dist/`, `.next/` (gitignored), `apps/api/.env` (secrets).
- **Commit:** `0231373 Phase 4 Word+onboarding live; production PM2; @/lib alias; all builds green`
- **Status:** Done, pushed to `main`.

### 017 — 2026-09-28 — Localhost outage: Windows OOM-killed all services, resurrected via PM2
- **Instruction:** "why is my local host showing error"
- **Root cause:** Device RAM hit ~96% (Chrome + Spotify + Figma + TradingView + 8GB total). Windows killed all 4 node service processes; only the PM2 daemon survived. API :4000 + all web ports refused connections.
- **Fix:** `pm2 resurrect` (from saved dump) — all 4 online at ~55MB each, RAM back to ~85%, all ports verified open, browsers reopened. No code changed.
- **Prevention:** Keep heavy desktop apps closed while running EDUFARM; if it recurs, run `node node_modules/pm2/bin/pm2 resurrect` from repo root. Consider `pm2 startup` for auto-boot (not enabled yet).
- **Files:** none (ops only)
- **Commit:** n/a
- **Status:** Done.

### 018 — 2026-09-28 — Unified EduPortal-style landing (index.html) combining student + lecturer + admin
- **Instruction:** "give me a craft as neat as this combine all the features of the app, the admin, students and lecturer to one landing page and can be accessible then on different other pages, ensure that all this corrections are written and documented also to my github repository" + EduPortal dashboard screenshot.
- **Change:** Rebuilt root `index.html` as a unified portal matching the screenshot's craft: dark sidebar nav (role-aware), topbar with live search + notification bell + profile role-switcher (Ada Student / Bello Lecturer / Platform Admin), greeting + date + schedule + daily-Word quote, stat cards, classes table, SVG performance chart, announcements, quick actions deep-linking into :3001/:3002/:3003 pages. All panels render from live API data (demo-login per role, entitlement-respecting endpoints). Fixed: search no longer wipes admin institutions table.
- **Role views:** student (progress, pending assessments, points, classes, announcements, grades chart); lecturer (courses, approval queue, Q&A load, eSpees earnings); admin (verification counts, review queue, open disputes, settlement totals, onboarding).
- **Verified:** opened in browser; file is static (zero RAM cost) reading localhost:4000.
- **Files:** `index.html`, `Docs/PRD.md` (this entry)
- **Commit:** `63dbd44 Unified EduPortal-style landing (student+lecturer+admin) + PRD entry 018`
- **Status:** Done, pushed to `main`.

### 019 — 2026-09-28 — Phone access via Cloudflare tunnels + configurable API URL
- **Instruction:** "give me a link for view on my mobile phone"
- **Change:**
  - Installed `cloudflared` (winget) and opened 5 quick tunnels (portal :8080, student :3001, lecturer :3002, admin :3003, api :4000). Verified portal + API + student login through the public URLs.
  - New `infra/static-server.js` (zero-dep node static server for `index.html`/`design.html`) running under PM2 as `portal-static`; tunnel recipe documented in `infra/ecosystem.config.js`.
  - Remote API support: `index.html` accepts `?api=` + ⚙️ button (localStorage); all 3 `lib/api.ts` clients read the override; all 3 login pages gained an API URL field. Rebuilt all 3 apps (builds green) and restarted PM2.
  - Note: quick-tunnel URLs are temporary — they change whenever tunnels restart (device reboot / network drop). Re-read them from `logs/tunnel-<port>.err.log`.
- **Files:** `infra/static-server.js`, `infra/ecosystem.config.js`, `index.html`, 3× `lib/api.ts`, 3× login pages, `Docs/PRD.md` (this entry)
- **Commit:** `ca5057a Phone access: tunnels recipe, static portal server, configurable API URL`
- **Status:** Done, pushed to `main`.

### 020 — 2026-09-29 — Step 1: marketing home + role-aware email/password signup/login
- **Instruction:** "I want you to completely build now… home page intro → sign in/up … indicate admin/student/lecturer … different homes … hardening track … step by step, ask questions" — Q&A decided: email+password (staff 2FA next), no API keys yet (mocks + walkthroughs later), open signup + verification queues.
- **Change:**
  - `index.html`: marketing hero (company intro, PRD/Design links) + 3 role cards → per-app /signup + /login; live portal dashboard kept below as preview.
  - API (`routes/auth-local.ts`, scrypt hashing, zero new deps): `POST /auth/signup` (student: institution+matric → pending profile; lecturer: dept+staffId → pending), `POST /auth/login` (401 on bad password, never reveals which field failed), `POST /access-requests` (admin requests → disputes queue), `POST /admin/users` (platformAdmin creates staff). New `User.passwordHash` column + migration `password-hash`.
  - UI: 3 signup pages (role-specific verification fields), 3 login pages rewritten (password + demo shortcut + API-URL field + signup links), nav Signup links.
  - Fixes en route: missing `passwordHash` column caught by tsc; wrong `./auth-dev.js` import path; stale `dist/` (rebuilt via tsc emit + PM2 restart).
  - Verified live: signup → pending → admin approve → verified → password login ✓; wrong password 401 ✓; test user cleaned up; signup/login pages 200 on all apps.
- **Files:** `index.html`, `routes/auth-local.ts`, `main.ts`, `schema.prisma` + migration, 3 signup + 3 login pages, 3 layouts, `Docs/PRD.md` (this entry)
- **Commit:** `ed4c525 Step 1: marketing home + role signup/login (scrypt, verification queues)`
- **Status:** Done, pushed to `main`.

### 021 — 2026-09-29 — CGPA Calculator (Amendment A1), live + documented everywhere
- **Instruction:** "add a cgpa calculator to my product also update this on my PRD and other documents including the readme file"
- **Change:**
  - Spec: `Docs/PRD EDUFARM.md` gained Amendment A1 (5-point scale, formula, class bands, privacy rule).
  - API (`routes/grades.ts`): `GradeSemester`/`GradeCourse` models + migration `grades`; CRUD scoped to own student; server computes GPA/CGPA (rounded 2dp); grades A–F validated, units 1–12, unique code per semester.
  - UI: student `/grades` page (CGPA hero + class badge, semester cards, add/delete flows) + nav CGPA link.
  - Docs: README Study Journey section, root `PRD.md` §2.6b + build log, `IMPLEMENTATION_PLAN.md` §2.6.
  - Fixes en route: TS computed-key overwrite in form helper; rebuilt student app; regenerated client; recompiled `dist/` + PM2 restarts.
  - Verified live: BIO 201 A(3u) + CHM 201 B(3u) + PHY 201 C(2u) → GPA 4.13 = 33/8 ✓; `/grades` page 200; test data deleted.
- **Files:** `schema.prisma` + migration, `routes/grades.ts`, `main.ts`, student grades page + nav, all 4 docs, `Docs/PRD.md` (this entry)
- **Commit:** `8fb744e` (code) + `cd4abf5` (Amendment A1, README, PRDs, plan, migration)
- **Status:** Done, pushed to `main`.

### 022 — 2026-09-29 — Real SVG icons everywhere, zero emoji
- **Instruction:** "for my entire bildup work with realtime icons not emojis"
- **Change:**
  - New shared set `packages/ui/src/icons.tsx` (37 stroke SVG icons, currentColor, `Icon` + `Dot` exports) wired into all apps via `transpilePackages`; `@edufarm/ui` gained react devDeps.
  - Apps: reader lock/chevrons/star, points star, grades delete-X, lecturer-check badge, lecturer insight bulb, icon nav bars in all 3 layouts.
  - `index.html`: `ic()` helper + status dots; nav, stats, announcements, quick actions, headers, logo, search/gear/bell all SVG.
  - `design.html` + `Docs/DESIGN_SYSTEM_PREVIEW.html`: check/lock glyphs swapped to inline SVG.
  - Verified: all 3 production builds green, PM2 restarted, 4/4 pages 200, served grades page scans emoji-free.
- **Files:** `packages/ui/{src/icons.tsx,src/index.ts,package.json}`, 3 `next.config.js`, 9 app files, `index.html`, `design.html`, `DESIGN_SYSTEM_PREVIEW.html`, `Docs/PRD.md` (this entry)
- **Commit:** `03a9e90 SVG icon set replaces all emoji (apps + portal + design docs)`
- **Status:** Done, pushed to `main`.

### 023 — 2026-09-29 — STANDING RULE: local-first, deploy only on explicit instruction
- **Instruction:** "i want you to build a lot on my local system before any deployment, this information is very important, deploy only when i ask you to"
- **Rule (permanent until explicitly lifted):** all building, testing, and verification happen on the owner's local device (PM2 + local Postgres + localhost). No cloud deployment of any kind — no Vercel/Render/Railway/Fly, no custom domains, no production hosting setup, no hosted databases/storage migration — unless the owner explicitly says "deploy". Temporary Cloudflare tunnels for viewing on phone/browser remain allowed only when asked for (they expose local ports, they are not deployments). GitHub pushes continue as source control (not deployment).
- **Files:** `Docs/PRD.md` (this entry)
- **Commit:** `b7da183 PRD entry 023: standing local-first no-deploy rule`
- **Status:** Done, pushed to `main`.

### 026 — Lead-engineer baseline audit (read-only; 4 audit docs)
- **Instruction:** full audit brief — read all sources, inspect screen-by-screen + API-by-API, produce FINAL_AUDIT/COMPLETION_MATRIX/API_GAPS/EXTERNAL_SERVICES, no broad code changes, do not declare production-ready.
- **Change:** Audited 23 pages (19 static + 4 dynamic, all 200), 19 API modules, 6 migrations, role-boundary probes (student blocked 403 on all staff routes; price bounds 400; answer keys stripped; AI refusal works). Wrote the 4 docs. No code touched.
- **Headline findings:** auth spoofable via header + open demo login (P0); no file bytes (P0 vs PRD); secret committed in ecosystem.config.js (P1); expiry/bundles/ownership gaps (P1); verbose 500s + no rate limits (P1); multi-institution UI traversal bug (P1). Full detail in Docs/FINAL_AUDIT.md.
- **Files:** `Docs/FINAL_AUDIT.md`, `Docs/COMPLETION_MATRIX.md`, `Docs/API_GAPS.md`, `Docs/EXTERNAL_SERVICES.md`, `Docs/PRD.md` (this entry)
- **Commit:** `71febae Baseline audit: FINAL_AUDIT + COMPLETION_MATRIX + API_GAPS + EXTERNAL_SERVICES + entry 026`
- **Status:** Done, pushed to `main`.

### 024 — 2026-10-01 — PWA-first + aligned youthful student ecosystem (standing instruction)
- **Instruction:** "remember build first as a PWA or a web application, take note of this information and ensure all the text and components are alligned properly, make it a youthful and student ecosystem filled using all the informations i have provided to you previously"
- **Standing note (remembered):** web-first as installable PWA (not native); every screen ships mobile-first, installable, offline-tolerant. Logged here so future builds keep it.
- **Change:**
  - PWA foundation in all 3 apps: `public/manifest.webmanifest` (name/short_name/standalone/theme), `public/icons/icon.svg` (green+gold grad cap), `public/sw.js` (app-shell cache, never caches API/R2), `layout.tsx` metadata (manifest, appleWebApp, icons) + `viewport` (themeColor, viewportFit cover) + SW register + apple-touch-icon. Student theme `#0E5A3C`, lecturer `#0A4230`, admin `#101828`.
  - Alignment fix everywhere in shells: one 1080px rail, left-aligned text, shared icon+text baseline, muted corrected `#667085` → `#344054` (7:1), base 16px/1.6 Sora/Inter, buttons 44px 12×20 + gold focus ring, inputs 44px with real `<label>`s (grades form gained Code/Units/Grade + Semester labels), tables left-aligned, sticky top nav + mobile bottom nav (PWA thumb zone) in student.
  - Youthful student hub (`web-student/app/page.tsx` rebuilt): gradient hero with daypart greeting + live counts, pill section tabs, `grid2` rail; left = Word (gold edge) → reflection → priorities (urgent + pending/total assessments + avg progress) → continue → My Courses (aligned progress bars) → lecturer updates → Q&A; right = study-pulse 2×2 (progress/CGPA/points/library) → points rules → AI teaser → library+CGPA → trust/verify. Unauthed state is a youthful PWA invite (install hint + demo logins). Zero emoji, all SVG `Icon`.
- **Files:** 3× `public/manifest.webmanifest`, 3× `public/icons/icon.svg`, 3× `public/sw.js`, 3× `app/layout.tsx`, `web-student/app/page.tsx`, `web-student/app/grades/page.tsx` (labels), `Docs/PRD.md` (this entry)
- **Verify:** `typecheck` clean (student/lecturer/admin); `web-student build` green (11 routes); PWA files local-only until PM2 restart serves `.next` + `public/`.
- **Commit:** (this push)
- **Status:** Done, local-first (no deploy per rule 023).

### 025 — Easy-to-navigate ecosystem: active nav, portal switcher, breadcrumbs, mobile bars
- **Instruction:** "make the app an easy to navigate ecosystem"
- **Change:**
  - New `packages/ui/src/Nav.tsx`: `NavLinks` (aria-current active highlight), `MobileBar` (phone thumb-zone bar), `PortalLinks` (one-tap Student/Lecturer/Admin/Portal jumper), `Crumb` (breadcrumbs). Framework-agnostic active state via location (no next/navigation dep — its types break pnpm-strict ui builds).
  - All 3 layouts rewired: active link pill, gold portal cluster in header, mobile bottom bars (student existing → active-aware; lecturer/admin gained one).
  - Breadcrumbs added: student course/material/assessment detail, lecturer manage course.
  - Fixed collateral: admin layout `??` mojibake in brand line (restored `·`).
  - Verified: 3 production builds green, PM2 restarted, 4/4 key pages 200.
- **Files:** `packages/ui/{src/Nav.tsx,src/index.ts}`, 3 `app/layout.tsx`, 4 detail pages, `Docs/PRD.md` (this entry)
- **Commit:** `92dbfac Easy navigation: active nav, portal switcher, breadcrumbs, mobile bars` (+ tsbuildinfo cleanup)
- **Status:** Done, pushed to `main`.

### 027 — 2026-10-04 — Frozen baseline: verify scripts + BASELINE.md
- **Instruction:** "Create a frozen baseline … record commit/versions/PM2/DB … run lint/typecheck/unit/build … health checks … login smoke tests … route inventory … save Docs/BASELINE.md … add missing scripts … one command verifies core health."
- **Change:**
  - Recorded: commit `7d32f78`, Node v24.19.0 / npm 11.17.0 / pnpm 9.15.9 (no yarn), PM2 5 procs (:4000/:3001/:3002/:3003/:8080), DB 6/6 migrations in sync (no secrets recorded).
  - Added `scripts/healthcheck.mjs` + `scripts/smoke.mjs` (zero-dep) and root scripts `test` (= typecheck alias — zero test files, explicit gap), `healthcheck`, `smoke`, `verify` (one command).
  - Results: lint FAIL (no eslint; recorded, untouched per no-refactor rule), typecheck 4/4 PASS, build 4/4 PASS (after safe fix: added missing `clipboard` IconName that was failing lecturer build), healthcheck 5/5, smoke 9/9, `pnpm verify` exit 0.
  - Incident: mid-task, `scripts/` + root script edits vanished (concurrent session collision suspected — other uncommitted app work present in tree). Recreated from context, re-verified `pnpm verify` exit 0, committing ONLY baseline files; other session's in-progress files left untouched.
  - Wrote `Docs/BASELINE.md` (toolchain, processes, DB, results, 23 pages + 88 endpoints inventory, explicit failures, re-verify steps).
- **Files:** `package.json`, `scripts/healthcheck.mjs`, `scripts/smoke.mjs`, `Docs/BASELINE.md`, `packages/ui/src/icons.tsx` (clipboard), `Docs/PRD.md` (this entry). NOT touched: other session's in-progress app files.
- **Commit:** `ed9b206 Frozen baseline: verify scripts, BASELINE.md, audit docs, clipboard icon fix`
- **Status:** Done, pushed to `main`.

### 028 — 2026-10-04 — Cross-application UI consistency pass (single design language)
- **Instruction:** "Perform a cross-application UI consistency pass. Use design.html and the existing shared UI package as the source of truth. Standardize: typography, spacing, card radius, borders, shadows, buttons, inputs, labels, tabs, badges, alerts, modals/drawers, tables, pagination, empty states, skeleton loaders, error states, focus states, disabled states, success states. [44px targets, real labels, keyboard, focus rings, contrast, no emoji icons, reuse shared SVG, one language, youthful student without childish lecturer/admin.] Screen-by-screen. Do not change hierarchy/business rules. Add visual QA checklist to Docs/UI_QA.md."
- **Change:**
  - New single language: `packages/ui/src/styles.ts` (`EDU_CSS` — type/spacing/radius/border/shadow/button/input/label/tab/badge/alert/modal/drawer/table/pagination/empty/skeleton/error/focus/disabled/success, 44px minimums, gold focus ring, `#344054` text, reduced-motion) + `packages/ui/src/components.tsx` (`Field`, `Alert`, `Badge`, `Tabs` with arrow-key nav, `Modal`/`Confirm` with Esc, `DataTable`, `Pagination`, `EmptyState`, `LoadingState`, `ErrorState`, `SuccessNote`); exported via `packages/ui/src/index.ts`.
  - 3 layouts collapsed onto `EDU_CSS` (deleted triple CSS copies): `tone-student` (youthful gradient header) / `tone-lecturer` (solid green) / `tone-admin` (dark slate) — same geometry, tone by color only; skip-links + `#main` added.
  - Screen-by-screen (23 pages, student 10 + lecturer 4 + admin 9): real `<label>`s via `Field`, `LoadingState`/`EmptyState`/`Alert`/`ErrorState`/`SuccessNote` replacing raw `Loading…`/`{msg}` `<p>`s, `DataTable` + `Pagination(10)` on admin queues, `Modal`+`Field` replacing `prompt()` in disputes, `Confirm` on settlement run/pay, `checkrow` checkboxes, text-arrow `→` replaced with SVG icons. Lecturer/admin kept restrained (no pink/gradient).
  - Untouched: routes, API endpoints/bodies, hierarchy, governance/financial rules (verified: no endpoint removals across 26 files; `apps/api`, `prisma`, `infra` not in scope).
- **Verify:** typecheck 3/3 PASS; builds 3/3 green; emoji scan 0 hits (apps + ui + portal + design); audit script: 0 bare labels, 0 `#667085`, 0 raw `{msg}`; PM2 resurrected, :3001/:3002/:3003/:4000/health 200.
- **Files:** `packages/ui/{src/styles.ts,src/components.tsx,src/index.ts}`, 3 `app/layout.tsx`, 23 app pages, `Docs/UI_QA.md`, `Docs/PRD.md` (this entry). Reverted: subagent scope-creep (`package.json` extra scripts, `scripts/`, log files) and CRLF-only churn in `icons.tsx`.
- **Commit:** (this push)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 029 — 2026-10-05 — Academic hierarchy fully operational (DB + API enforcement)
- **Instruction:** "Target hierarchy University → Faculty → Department → Level → Course → Lecturer → Student. Make the hierarchy fully operational and enforce relationships in DB and APIs. [FKs, no orphans, course∈department/level, lecturer↔dept, student↔full chain, verification≠enrollment, lecturer controls access.] Onboarding journeys for student/lecturer/institution-admin with pending/approved/rejected/needs-correction/suspended. Admin queues + notification events for verification changes."
- **Change (DB — migrations `20261005010000_hierarchy_constraints` + `20261005020000_verification_outcome`):**
  - Real FKs everywhere on the chain (StudentProfile→faculty/department/level, Course→level, University→…→Course all Restrict/NoAction — parent deletes blocked, no orphans). Repaired 1 live row with `""` links (ada) back to the demo chain before constraining.
  - Uniques: faculty/uni, department/faculty, level/department, course-code/department, matricNo/university, staffId/department.
  - New `CourseLecturer` (course↔lecturer assignment, last-lecturer delete blocked) and `VerificationRecord` (own `VerificationOutcome` enum: pending/approved/rejected/needsCorrection/suspended) + `University.suspended`.
  - `VerificationStatus` += needsCorrection/suspended; `EnrollmentStatus` += suspended.
- **Change (API):** `src/hierarchy-guard.ts` (chain/placement checks, assignment-based `canControlCourse` with zero-assignment bootstrap fallback, notify/audit helpers). Chain validation on signup + verification request (no placeholders, matricNo/staffId uniqueness). Course create requires level∈department; lecturer assignment requires verified + same-department (+ last-lecturer guard). Verification state machine (approve/reject/needsCorrection/suspend/reinstate + resubmit) with records+audit+notifications, queues filterable by status + per-profile history. Enrollment: verified-only request, never auto-approved, assigned-lecturer (or staff) decides incl. suspend/reinstate/remove, both sides notified. Onboarding: approve/reject (removes empty requests)/suspend/reinstate + status queues + contact notifications. Downstream gates (materials/AI/assessments/progress/library) already `approved`-only — suspended fails closed.
- **Two-tier control model:** enrollment decisions (access) = assigned lecturer; content writes = verified same-department lecturer (`ownsCourse`); staff bypass. Documented for the session-auth cutover (guards take userId+role, shape-compatible).
- **UI (journeys):** student signup + verify = full chain cascade pickers (no more `""`); status copy for all six states; admin verifications = status filter + note + all five decisions; admin onboarding = pending/suspended queues + reject/suspend/reinstate; lecturer manage = suspend/reinstate/remove buttons.
- **Verify:** 39/39 E2E (guards, 3 journeys, history, notifications, regression) green; typecheck 4/4; builds 4/4; live :4000/:3001/:3002/:3003 200.
- **Collision notes (concurrent sessions, all resolved in-tree):** (1) auth-hardening session integrated live — adopted my route logic and swapped `currentUser`→`sessionUser` (mechanical; E2E re-passed 39/39 on sessions); fixed THEIR boot-breaker (pinned `@fastify/helmet@11`/`@fastify/rate-limit@9` for fastify 4 — was crash-looping); fixed THEIR matrix-test type error + added `/verifications/me` studentProfile alias (UI uses `.student`); fixed MY OWN suspend-mapping bug (`suspend`→`suspended`, caught by E2E). (2) Their uncommitted auth work (app.ts/authz/matrix-tests/other routes/session.ts/account_status migration) is folded into this commit so `main` stays bootable — their session owns follow-ups. (3) Possible overwrite: my full-file rewrites of verification/enrollments/hierarchy may have replaced their uncommitted hardening there — re-applied via their merge; flagged for their confirmation.
- **Files (mine):** `prisma/{schema.prisma,seed.ts,migrations/20261005010000_*,migrations/20261005020000_*}` + hierarchy/API/UI blocks above, `Docs/PRD.md` (this entry). Folded-in (theirs, verified working): `src/{app,authz}.ts`, `src/authz.matrix.test.ts`, other hardened routes, `packages/ui/src/session.ts`, `account_status` migration, api `package.json`+lock pins.
- **Commit:** `52287b8 Hierarchy operational: FKs + state machines + journeys + queues (E2E 39/39) + PRD entry 029`
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 030 — 2026-10-05 — Auth hardening live: sessions, centralized guards, rate limits, 21/21 matrix
- **Instruction:** "Harden authentication and authorization without changing the locked Better Auth architecture" + full audit list (signup/login/logout/refresh/passwords/status/roles/verification/middleware/server-auth/cross-role).
- **Change:**
  - Sessions: opaque 64-hex tokens (SHA-256 stored) in Better Auth `Session` table, 30d sliding refresh, via `Authorization: Bearer` / `x-session-token` / HttpOnly cookie. Raw user ids rejected everywhere (spoofing closed; verified live 401). Suspended users fail closed; logout revokes; password change rotates all sessions; platformAdmin suspend/unsuspend with self-guard.
  - Central `authz.ts`: `requireAuth/requireRole/requireVerifiedStudent/requireVerifiedLecturer/requireCourseLecturer/ownsCourse` (CourseLecturer assignment OR same-dept verified lecturer; institution/platform bypass; deptAdmin fail-closed) + uniform 401 `auth-required` / 403 `forbidden:<reason>` + audit helper. All 17 route files + hierarchy/verification preHandlers converted; `auth-dev.ts` unreferenced.
  - Ownership: materials create/submit/archive/detail/pages, enrollments list/decide, insights, QA resolve (author-or-staff) tightened; purchase expiry now enforced (402 expired); money audit rows (purchase, pass-award).
  - Demo gated by `ALLOW_DEMO_LOGIN` (default closed; explicitly `"true"` locally with warning comment). Demo issues real revocable sessions.
  - Rate limits: global 300/min; `/auth/*` 10/min; demo 30/min; `/ai/ask` 30/min. Helmet on. Sanitized 500s (`{error:internal,id}`).
  - Tests: `apps/api/src/authz.matrix.test.ts` — 21 cases (anon, student, lecturer, staff, verification) green on `edufarm_test` via inject. Fixed 2 real findings en route (unawaited async ownsCourse; dynamic demo gate for test determinism). Root `pnpm test` now runs vitest (`turbo.json` task added); `pnpm verify` = typecheck + health + smoke + tests, exit 0.
  - Clients: 3 `lib/api.ts` send session tokens (+ auto-clear on 401, `logout()` helper); 3 logins + 2 signups persist tokens; portal uses session tokens.
- **Verify:** tsc clean; vitest 21/21; `pnpm verify` exit 0; dist rebuilt; PM2 restarted; 6/6 pages 200; session login + legacy rejection + demo issuance spot-checked live.
- **Files:** `src/{authz,app,main}.ts`, all 17 routes, `authz.matrix.test.ts`, `packages/ui/src/session.ts`, 3 lib/api + 5 auth pages, portal, `infra/ecosystem.config.js` (+ALLOW_DEMO flag), root + api `package.json`, `turbo.json`, `account_status` migration, `Docs/PRD.md` (this entry). Co-built with parallel hierarchy session (029) — converged in `52287b8`; this entry covers the auth cutover + verification.
- **Commit:** `9164ccd Auth hardening verify: dynamic demo gate, matrix determinism, turbo test task`
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 031 — 2026-10-05 — Course-space workflow complete (announcements lifecycle + Q&A consoles)
- **Instruction:** "Complete the course-space workflow" — student authorized courses/join/detail/announcements/Q&A-search/ask/replies/resolve; lecturer approvals, announcement publish/edit/archive + 6 categories, Q&A answer/search/filter + distinguished replies; enforce no-1-to-1-chat, lecturer-only publishing, membership permissions, audit trail.
- **Change (API):**
  - `Announcement.archived` + migration `20261005120000_announcement_archive` (applied to edufarm + edufarm_test).
  - `routes/announcements.ts` rewritten: lecturer-only create/edit/archive scoped by `ownsCourse` (assignment OR same-dept), fixed 6-category validation, audit on publish/edit/archive, feed hides archived (staff opt-in via `?includeArchived=true`).
  - Course detail feed excludes archived.
  - QA resolve already author-or-staff (030); unchanged.
- **Change (UI):**
  - Student course page: Q&A search box + status filter (live API query), author-only "Mark resolved" button.
  - Lecturer manage: new `AnnouncementsManager` (list incl. archived, inline edit, archive with audit note) + `QAConsole` (search/filter, per-question lecturer answer box, resolve; lecturer/student replies badged distinctly).
  - Enrollments remove/suspend/reinstate buttons already present (029); untouched.
- **Verify:** lecturer post→edit→archive with student 403 on edit ✓; student ask→lecturer answer (isLecturer=true)→author resolve ✓; search `status=resolved` hits ✓; archived hidden from student feed ✓; matrix 21/21 still green; student/lecturer builds green (fixed corrupt `.next` type cache by stopping server first — file-lock contention); dist rebuilt; PM2 restarted; course pages 200.
- **Files:** `schema.prisma` + migration, `routes/{announcements,hierarchy}.ts`, student `courses/[id]` (search/filter/resolve), lecturer `courses/[id]/qa-console.tsx` + wiring, `Docs/PRD.md` (this entry).
- **Commit:** `c69c511 Course-space complete: announcement lifecycle + Q&A consoles + search/resolve`
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 032 — 2026-10-05 — Student experience end-to-end (every card live, no dead UI)
- **Instruction:** "Complete the student experience end-to-end. Do not redesign away from the approved hierarchy. Every student-facing feature on real persisted data. Home shows: Word, priorities, continue, My Courses+progress, lecturer updates, Q&A, points, AI, Library, CGPA, trust indicators. Every card a real destination. No dead buttons/counters/demo content. Complete empty/loading/error/success states."
- **Change (API):** `/library/me` attaches material/bundle titles + terms (no more bare ids); `/points/me` history consumed (already shipped).
- **Change (Home rewrite):** multi-course aggregation (announcements + Q&A + assessments across ALL approved courses, each item deep-linked); hero badge + trust card from live `/verifications/me` (status, matricNo, real uni/faculty/department names); priorities = urgent anns (linked) + pending attempts (deep-linked `/assessments/:id`) + awaiting-approval enrollments + real avg; points card shows last-3 ledger entries + Library redemption link; continue gets an `EmptyState` when idle; date-rotated study tip (labeled tip, no fake streak); full loading + error+retry states; removed hardcoded demo emails and the "streak" claim.
- **Change (surfaces):** Library titles/expiry/error state; reader uses version `pageCount` (no hard-coded /10), honest protected-reading copy, buy success note with terms; courses list loads MY department chain + inline success/error (no `alert()`); login drops demo prefill + dead demo-login button (demo gate closed).
- **Verify:** typecheck api+student clean; builds api/student/lecturer/admin green (flaky Next trace ENOENT beaten by cache-clear + retry); card E2E 14/14 (word, chain signup, trust, urgent, QA, dwell-continue, progress, points+history, AI grounded-or-refusal, library titles, checkout terms, grades, assessments); live :4000/:3001/:3002/:3003 + signup/verify/verifications 200; student-app grep: 0 demo/alert/mock-shell/streak remnants.
- **Collision note:** concurrent session committed my uncommitted files mid-task as `c69c511` (verified all pieces intact); my remaining delta is this PRD entry + root line. Their `archived` announcement work needed only a client regen on my side.
- **Files (mine this entry):** `routes/purchases.ts`, student `page/signup/verify/library/courses/materials/[id]/login`, admin `verifications/onboarding`, lecturer manage decisions, `Docs/PRD.md` (this entry).
- **Commit:** (this push)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 033 — 2026-10-06 — Personal Academic Library as a complete entitlement system
- **Instruction:** "Make Personal Academic Library a complete entitlement system, not merely a list of purchased files. Each item knows: student/user, material, edition/version, course, access type, start, end/permanent, order ref if paid, free/paid classification, validity, revoked/suspended state. UI shows: active, expiring soon, expired, archived/replaced edition, permanent access. Exact terms before payment. Grant persisted transactionally. Never access before payment confirmation."
- **Change (DB — migration `20261006010000_library_entitlement`):** `PurchaseStatus` += revoked/suspended; `Purchase` += `versionGranted`, `accessType` (purchase|bundle|free), `courseId` FK; `Course.purchases` back-ref. (Carries pending `Material.version DEFAULT 0` schema alignment.)
- **Change (API):** shared `assertGrant()` verdict in `hierarchy-guard.ts` (only `completed` rows grant; pending/failed grant nothing; revoked/suspended→403, expired→402, none→402). Checkout now requires approved enrollment, snapshots edition+course+type, and renews (expired/revoked/suspended never block a new grant — history kept). New `GET /materials/:id/terms` (exact pre-payment terms, reader renders verbatim, no grant created). New `POST /purchases/:id/{revoke,suspend,reinstate}` (assigned lecturer/staff, audit + student notification; fixed profile→user notify resolution). Reader gate routes through `assertGrant`. `GET /library/me` returns unified `items[]` (all required fields + computed state + edition-replaced flag + summary buckets) with legacy keys kept.
- **Change (UI):** Library rewritten around states (all/active/expiring/expired/archived/permanent filters, order refs, renew actions); reader buy card shows exact terms + purchase receipt; home count uses unified items.
- **Verify:** entitlement E2E 24/24 (terms-view creates nothing, 402 pre-payment, pending grants nothing, enrollment-gated checkout, transactional grant fields, expiry→renew→2 rows, revoke/suspend→403→reinstate→200, lecturer scoping, edition bump flagged, free derivation, regression); typecheck api+student; builds api+student green; live :4000/:3001 200.
- **Collision notes:** repaired one bug I introduced (notify with profile id); fixed verdict order so revoked reports 403; fixed concurrent session's `storage.ts` import path (blocked typecheck); carried their `Material.version DEFAULT 0` alignment. P3015 phantom on concurrent `material_versions` dir (file mid-write) worked around by diffing without the empty dir.
- **Files (mine):** `prisma/{schema.prisma,migrations/20261006010000_*}`, `src/{hierarchy-guard.ts,routes/{purchases,materials}.ts}`, student `library/page/materials/[id]/page`, `Docs/PRD.md` (this entry). Folded-in (theirs, verified): `storage.ts` import fix, `material_versions` migration, session `lib/api` + login/signup session work my UI builds on.
- **Commit:** see git log (033 pushed by parallel session; hash in log)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 034 — 2026-10-06 — Material lifecycle hardened end-to-end (approval, versioning, R2-ready reader)
- **Instruction:** "Audit and harden the entire material lifecycle" — Draft→Approval→Review→Published→Updated→Archived, 6 fixed types, ownership attestation, versioned editions, free/paid + durations, trust badges, pre-payment terms, protected reader (no download/offline/export, watermark, per-access entitlement+expiry, archived blocking, signed URLs not raw keys), R2 presigned-or-equivalent, screenshot boundary documented not promised.
- **Change (API):**
  - `Material.pendingVersion` + migration `20261005130000_material_versions` (deployed edufarm + edufarm_test).
  - `routes/materials.ts` rewritten: upload → `pendingLecturer`; `approve`/`submit` require `attest:true` → `pendingReview`; `new-version` stages v+1 (live untouched); review approve flips live + reindexes AI, reject drops staged row and restores prior state; archive audited; fixed 6-type validation; duration 1–730d bounds; detail returns `trust{}` block and never leaks `fileKey`.
  - `GET /lecturer/materials` (own drafts/pending/editions for management UI).
  - New `routes/storage.ts`: HMAC page tokens (60s) + `GET /pages/:token` resolver (re-checks entitlement+expiry per access; 302 to R2 presigned when `R2_*` set, else honest 410); `@aws-sdk/client-s3` + presigner installed (dormant without keys).
- **Change (UI):** lecturer upload with attestation checkbox + 6-type list + My-materials table (approve/new-edition per state); reader trust block + pre-payment terms card + capture boundary notice + no-select/no-print/no-copy reader lock; library already state-complete (033).
- **Verify:** tsc clean; vitest 32/32 (21 matrix + 11 lifecycle incl. staged-version, reject-restore, archive-block, token tamper); live upload→pendingLecturer(v0)→approve→pendingReview→publish(v1)→new-edition→v2→archive ✓ with trust block; builds + PM2 restarted; course pages 200.
- **Files:** `schema.prisma` + migration, `routes/{materials,storage}.ts`, `app.ts`, lecturer manage UI, student reader trust/terms/lock, `authz.matrix.test.ts` (+11), `Docs/PRD.md` (this entry).
- **Commit:** `20dbf5a` (code: lifecycle, storage, UI, tests) + `b2fd98f` (this entry)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 035 — 2026-10-06 — /grades complete and hardened (private, editable, tested)
- **Instruction:** "Complete and harden /grades. Student-only private data. Lecturers must never see grades/CGPA via UI or API. Features: semesters, code, title, units, grade A–F, auto points, semester GPA, CGPA, degree class, edit/delete course, edit semester, impossible-value validation, empty state, no export. Unit tests: one semester, multiple, repeats, zero units, all A, all F, mixed, boundary classes."
- **Change (API, `routes/grades.ts` — no migration needed):** shared `degreeClass()` (bands match UI badge exactly), `parseGrade/parseUnits` validators (trim, case-fold, whole 1–12, length caps, whitespace rejected); new `PATCH /grades/semesters/:id` (rename) and `PATCH /grades/courses/:id` (code/title/units/grade with per-semester uniqueness on code change); create paths hardened the same way. Privacy unchanged and explicit: every route requires the caller's own studentProfile and scopes rows to it — zero lecturer/admin read paths exist. Repeat policy documented in code: same code across semesters allowed, every attempt counts (all-in). No export endpoint (by design).
- **Change (UI, student `/grades`):** inline semester rename, inline course edit (code/title/units/grade) with save/cancel, `Confirm` on semester delete, success+error notes on every mutation, title field on add, failed-load `ErrorState`, repeats policy + privacy copy. No export UI anywhere.
- **Tests:** `grades.unit.test.ts` — 10/10 (points map, single 4.13, multi 4.5/3.67/4.08, repeat all-in, zero-units null, all-A 5.0, all-F 0.0, mixed 1.9, exact edges up / just-below down). Matrix `grades privacy` block — 6/6 (lecturer/admin/anon 401, lecturer-write 401, cross-student 404s, impossible values 400s + normalization). Full matrix 48/48 after cooldown (earlier 4 assessment-workflow failures were rate-limit flakes from back-to-back runs, not regressions).
- **Verify:** unit 10/10; matrix 48/48; live E2E 9/9 on dev DB (denials, rename/edit, repeat CGPA 4.0 Second-Class-Upper, edit moves CGPA 4.33, cross-student 404); typecheck api+student; builds api+student green; live :4000 + :3001/grades 200.
- **Collision notes:** repaired my own `suspend`→`suspended` mapping gap (defensive throw now); fixed concurrent session's `storage.ts` import path + `assessments.ts` `??` narrowing + matrix `aid`/callback/`any` type errors (all behavior-neutral, needed for green); waited out their live `assessments.ts` refactor before final check. Left untouched for their lane: `schema.prisma`, `auth-local.ts`, `tsconfig.*`, assessment-release migration, lecturer/student non-grades pages.
- **Files (this entry):** `routes/grades.ts`, `routes/grades.unit.test.ts` (new), student `grades/page.tsx`, `authz.matrix.test.ts` (grades block + type fixes), `assessments.ts` (`??` narrowing only), `Docs/PRD.md` (this entry).
- **Commit:** (parallel session's push; hash in git log)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 036 — 2026-10-06 — Assessments as a full academic workflow (release-gated, timed, audited)
- **Instruction:** "Complete assessments as a full academic workflow" — lecturer create (test/quiz/assignment, instructions, objective+subjective, marks, timing, publish/unpublish, assign, submissions, subjective grading, auto-grade review); student (available list, start, resume-by-policy, submit, results/feedback on release); deterministic MCQ-only auto-grade with question-level marks; lecturer-controlled subjective grading with grader+time audit; prevent double-submit, client score tampering, grading races, cross-student viewing.
- **Change (DB — migration `20261005140000_assessment_release`):** `Assessment.gradesReleased` (default false), `AssessmentAttempt.feedback/gradedBy/gradedAt`.
- **Change (API, `routes/assessments.ts` rewritten):** type/instructions/time(1–600)/attempts(1–10)/due validation; draft-only question add/edit/delete (published immutable); publish/close/reopen state machine + audit; ownership via `mustOwnCourse/mustOwnAssessment` on every lecturer route (incl. attempts list + grade); start enforces due + max-attempts + resumes live in-progress with prior answers (expired in-progress auto-submits); submit is atomic (single-flip, double-submit 400, late-submit 400, scores recomputed server-side only); grade runs in-transaction with clamped marks, feedback (2k cap), grader+time recorded, audit row; release endpoint notifies attempted students; student views mask score/feedback until release (`GET attempts/me`, `GET /attempts/:id` new, course list); answer keys never leave server.
- **Change (UI):** lecturer console — full create form (type/instructions/time/attempts/due), theory+marks question builder, publish/unpublish(reopen)/release actions, submissions with student names, per-answer grading with marks inputs + feedback box; student attempt — resume notice with restored answers, release-gated result panel, feedback display; course list shows unreleased state.
- **Verify:** tsc clean; vitest 48/48 (incl. 10 new workflow cases: invalid create, lock-on-publish, student publish blocked, resume-no-fork, double-submit, masked-then-released 6/7 incl. feedback, cross-course lecturer block, cross-student 404, close/reopen visibility); live create→theory→publish→submit→grade(audited)→masked→release→4/5+feedback ✓; builds + dist + PM2 restarted; pages 200.
- **Files:** `schema.prisma` + migration, `routes/assessments.ts`, `authz.matrix.test.ts` (+10), lecturer manage console, student attempt + course list, `Docs/PRD.md` (this entry).
- **Commit:** `883fa5f Assessments full workflow: release-gated grades, timed windows, resume, audited grading, 48 tests`
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 037 — 2026-10-06 — Academic Points hardened as financial-adjacent subsystem
- **Instruction:** "Audit Academic Points as a financial-adjacent abuse-sensitive subsystem" — non-cash, no withdrawal, slow, high thresholds, capped, never for opens/purchases; inspectable rules; per-award provenance (event/user/amount/source/timestamp/rule-version/idempotency); anti-abuse (refresh/replay/Q&A/webhook/concurrency); transactional auditable redemption; constrained lecturer recognition; no invented numbers (TODO markers).
- **Change (DB — migration `20261005150000_points_ledger_hardening`):** `PointLedger.sourceRef/ruleVersion`; unique `(studentId, capKey)` (NULLs unrestricted); pre-existing dev duplicate keys disambiguated in-migration. Deployed edufarm + edufarm_test.
- **Change (policy):** new `src/points-policy.ts` — closed event set (assessment-pass, lecturer-recognition), quotas, redemption constants, invariants; every amount carries TODO(DECISION). Public `GET /points/policy`.
- **Change (awards):** central `awardPoints()` — unknown events throw (cannot mint); unique-constraint collisions return duplicate (replay/retry/webhook/concurrent safe); every award + blocked duplicate audited. Pass/recognition/redemption all route through it.
- **Change (redemption):** balance re-read inside Serializable settlement tx (`payments/orders.ts`) + in-tx grant semantics; insufficient-at-settle fails the order (no overdraft); redemption ledger rows carry source/rule; `points.redeemed` audit. Recognition: idempotency-key support (409 on replay), quotas, audit, 30/min limit.
- **Verify:** tsc clean; vitest 53/53 (5 new: unknown-event mint blocked, concurrent double-award collapses, idempotency replay 409, provenance on all rows, opens mint nothing; overdraft race covered by serializable + idempotent checkout); live policy v1/2 events + balance provenance ✓; dist rebuilt; PM2 restarted.
- **Files:** `points-policy.ts`, `schema.prisma` + migration, `routes/points.ts`, `payments/orders.ts` (settle hardening), `authz.matrix.test.ts` (+5), `Docs/PRD.md` (this entry).
- **Commit:** `def3334` (points hardening) + `ffc086a` (remove stray debug scripts)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 038 — 2026-10-06 — Production-ready payment abstraction (orders + webhooks)
- **Instruction:** "Replace the mock payment path with a production-ready payment abstraction. Do NOT couple purchase logic to Paystack/Flutterwave. [PaymentProvider, Mock/Paystack/Flutterwave providers.] 11-step sequence [terms → pending order → init → provider flow → webhook → signature → server verify → paid once → grant once → earnings once → receipt]. [Idempotent webhooks, never trust client paid=true/redirects, provider refs, raw event metadata, reconciliation, pending/failed/success, test mode, env keys, mock E2E.] Docs/PAYMENTS.md."
- **Change (no new migration — models landed earlier):** `src/payments/providers.ts` (interface + Mock/Paystack/Flutterwave; kobo vs naira conversion inside providers; HMAC-SHA512 / verif-hash / HMAC-SHA256 validation). `src/payments/orders.ts` (create idempotent on key, initialize, signed webhook pipeline with server-to-server verify + amount match, conditional paid transition, UNIQUE-guarded grant + earnings, mock completion through the SAME pipeline, lazy expiry). `routes/payments.ts` as encapsulated plugin (raw-body JSON parser scoped to webhooks only) with orders/status/reconcile/mock-pay-page/mock-complete/webhook/callback routes. Legacy `/checkout` repointed: mock test-mode runs the full pipeline server-side; real providers get 409 → order flow. Reader UI handles `authorizationUrl` + status polling. `.env.example` keys.
- **Real bug found by E2E:** re-initializing an initialized order rotated `providerRef`, orphaning open pay pages — `initializeOrder` is now idempotent (returns existing reference).
- **Verify:** payments E2E 20/20 (terms create nothing, 402 pre-payment, pending grants nothing, enrollment-gated, transactional grant, replay ×3 absorbed with 1 grant + 1 ledger, tamper 400, paid-flag ignored, unknown provider/order fenced, legacy compat, reconcile clean + staff-only); typecheck api+student; builds api+student green; live :4000/:3001 200.
- **Collision notes:** concurrent session committed my payments work-in-progress as `def3334` (+ their points hardening touching `orders.ts` settle path — verified compatible) and deleted my E2E tmp files as "stray" (`ffc086a`) — E2E rewritten from scratch; all assertions re-proven. Left untouched: their settlement/points/schema lanes.
- **Files (mine):** `payments/{providers.ts,orders.ts}`, `routes/{payments.ts,purchases.ts}`, `.env.example`, student reader, `Docs/{PAYMENTS.md (new),PRD.md}` (this entry).
- **Commit:** (parallel session's push; hash in git log)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).

### 039 — 2026-10-06 — eSpees as internal accounting ledger with settlement periods
- **Instruction:** "Complete eSpees as an internal accounting/settlement ledger, not as a second payment provider" — track gross/platform/lecturer/pending/available/settled/period/reference/status; explicit pending→available→settled; no client-side balance edits; idempotent runs; immutable audit per movement; lecturer UI (pending/available/settled/material sales/split/history/next period); splits/conversion configurable with TODOs.
- **Change (DB — migration `20261005160000_settlement_batches`):** `SettlementBatch` (period window, status open/paid, reference, gross/lecturer/platform totals, entry count, unique idempotencyKey) + `ESpeesLedger.settlementBatchId`. Deployed edufarm + edufarm_test.
- **Change (policy):** new `src/settlement-policy.ts` — hold days, 70/30 split, min payout, schedule, 1:1 conversion, all with TODO(DECISION); `nextPeriodEstimate()` drives the UI.
- **Change (API):** `routes/settlement.ts` rewritten — overview (+policy/next/batches), run closes a period batch atomically (matured only, replay-safe), pay settles exactly one batch or auto-batches available (idempotency keys, per-batch audit + lecturer notifications, min-payout gate); new `GET /batches`, `GET /lecturer/settlements`. Earnings endpoint upgraded: totals by state, material-level sales with split, batch history, next period, live policy (fixed invalid `material` include en route).
- **Change (UI):** lecturer dashboard full earnings panel (3 balances, split policy line, per-material table, history with refs, next period); admin settlements page (policy line, batches table, idempotent run/pay confirmations).
- **Verify:** tsc clean (after Prisma regen); vitest 59/59 (6 new: staff blocked, no edit surface, batch replay, batch pay idempotency, own history + next, student blocked); live overview policy + lecturer earnings + pages 200.
- **Files:** `schema.prisma` + migration, `settlement-policy.ts`, `routes/{settlement,purchases}.ts`, `authz.matrix.test.ts` (+6), lecturer dashboard, admin settlements, `Docs/PRD.md` (this entry).
- **Commit:** `2a7e916 eSpees accounting: settlement periods, idempotent pay, earnings UI, 59 tests` (push needed one retry — transient GitHub 500)
- **Status:** Done, pushed to `main`. Local-first (no deploy per rule 023).
