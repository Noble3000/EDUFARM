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
