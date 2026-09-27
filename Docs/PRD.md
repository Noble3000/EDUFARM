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
- **Commit:** (to be filled on push)
- **Status:** In progress.
