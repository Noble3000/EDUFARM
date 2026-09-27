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
- **Commit:** (to be filled on push)
- **Status:** In progress.
