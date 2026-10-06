# Product Requirements Document: EDUFARM

**Product Name:** EDUFARM — Verified Lecturer–Student Learning Ecosystem
**Version:** 1.0 (PRD-approved concept) · **Platform:** Web (PWA-first, self-hosted on local device;-phones via LAN/Tunnel)
**Full spec:** `Docs/PRD EDUFARM.md` · **Build plan:** `Docs/IMPLEMENTATION_PLAN.md` · **Design preview:** `design.html`
**Core Requirement:** A trusted academic ecosystem — not a PDF marketplace. The Word is at the center of the student
experience; verified universities, departments, lecturers, students, trusted materials, communication, study progress,
AI learning support, rewards, and transparent lecturer earnings connect around it.

## 1. Overview

### 1.1 Purpose
Replace fragmented material distribution (class reps, informal groups, unverified PDFs, overpriced tutorial packs) with
an organized, lecturer-owned academic experience where every material, course, and user is verifiable.

### 1.2 Academic hierarchy (fixed)
`University → Faculty → Department → Level → Course → Lecturer → Student`

### 1.3 Target users and roles
| Role | Needs |
| :--- | :--- |
| Student | Join verified institution, access approved courses, study materials, take tests/assignments, ask questions, earn points, use AI, track progress |
| Lecturer | Manage courses, upload/approve resources, publish announcements, answer Q&A, create assessments, review engagement, earn transparently |
| Dept/Institution admin | Verify lecturers and students, manage structures, institutional oversight |
| Platform admin | Content review, disputes, financial/reward policy, user governance |

## 2. Functional Requirements

### 2.1 Verification & access
- Students: institution verification + lecturer-controlled course access (verified ≠ auto-enrolled).
- Lecturers: institution/department confirmation + platform verification. Separate lecturer environment (no shared student account).

### 2.2 Student experience (home order)
Today's Word → academic priorities → continue studying → My Courses (progress) → lecturer updates → Course Q&A →
academic points → AI Study Assistant. Personal Academic Library (in-ecosystem access only, clear access-duration info).

### 2.3 Lecturer experience
Dashboard (courses, materials, engagement, announcements/Q&A, tests, earnings pending/available/settled, AI insights);
course control (enrollment approve/remove, announcements, Q&A, assessments, priced uploads, access durations, feedback).

### 2.4 Content lifecycle
`Draft → Lecturer approval → Platform review → Published → Reviewed/Updated → Archived` (versioned, never silent).
Free (outlines, announcements, instructions) vs paid (detailed notes, revision packs, practice sets) within
platform-approved bounds + lecturer bundles. In-ecosystem viewing only: no download/offline/export/capture tools;
watermark + ownership indicators; access terms visible before payment.

### 2.5 Communication
Official announcements (6 categories + urgent) retained per course; course Q&A (unanswered → answered → resolved,
lecturer replies distinguished, searchable). No 1-to-1 chat.

### 2.6 Study journey & assessments
Long-term record: courses, meaningful completion (dwell-based, not opens), assessments, streaks, Q&A participation,
recognitions, points. Objective auto-grading + lecturer-reviewed subjective work.

### 2.7 AI learning experience
Source hierarchy: (1) authorized lecturer materials first, (2) general knowledge clearly labeled, (3) never present
general output as lecturer position. Modes: explain, summarize, compare, Ask This Material, practice/quiz/revision,
exam prep. Lecturer insights: engagement deltas, unresolved topics, material health.

### 2.8 Economy (three values)
Naira (payments) + eSpees (internal lecturer settlement, pending → available → settled) + Academic Points (non-cash,
slow, capped, no withdrawal; high redemption thresholds). Purchase flow: view terms → pay → library grant →
pending earnings → transparent split.

### 2.6b CGPA Calculator (Amendment A1, 2026-09-29)
Students record semesters (courses with code, credit units, grade A–F) and get per-semester GPA plus cumulative CGPA
on the Nigerian 5-point scale (A=5 … F=0; GPA = Σ(point × units) ÷ Σunits) with degree-class indication
(First ≥4.5, 2:1 ≥3.5, 2:2 ≥2.4, Third ≥1.5). Private to the student; part of the Study Journey; never visible
to lecturers. Live at student app `/grades`.

### 2.9 Devotional, trust, governance, notifications
Same daily Word for every student (authorized source) + separate academic reflection; reviews (eligible after
meaningful access) + reporting without auto-takedown; trust badges (Verified Institution/Lecturer, Official
Course/Material, edition, terms); dispute flow (report → notify → review → resolve → appeal); in-app notifications
primary, email for meaningful events.

## 3. Product Rules / Guardrails
Protected ecosystem · no unrestricted distribution · verified identity · lecturer course authority & ownership ·
platform review · transparent pricing · no cash-out points · slow points economy · no private chat · AI source clarity ·
fair disputes.

## 4. Release Phasing
- **Phase 0 (done):** monorepo, design tokens, local Postgres + Better Auth + R2 decisions, data model, seed.
- **Phase 1 (done, live):** verification, course spaces, announcements/Q&A, material lifecycle + protected
  reader shell, mock Naira checkout, library, study progress.
- **Phase 2 (done, live):** assessments (builder/attempts/auto-grade/manual grade), points engine + redemption,
  eSpees settlement run/pay, reviews + replies, disputes, email outbox.
- **Phase 3 (done, live):** entitlement-scoped AI ask with citations + refusal policy, lecturer insights.
- **Phase 4 (done, live):** daily Word (Lagos boundary) + archive + reflection card, institution onboarding.
- **Running:** PM2 production on local device — student :3001, lecturer :3002, admin :3003, api :4000.

## 5. Locked Technical Decisions
Local PostgreSQL (no Supabase) · Better Auth (Postgres adapter) · Cloudflare R2 private buckets (presigned page URLs) ·
Next.js PWA + Fastify API self-hosted on local device (no Vercel) · Paystack/Flutterwave for Naira · pgvector later.

---

## 6. AI Builder Steering & Refinement Notes (for grader — compare against `design.html`)

### Refinement Note — 2026-09-28 — Clearer font, stronger contrast, accessible buttons/inputs
- **What I told the agent to change (verbatim steering):** "Align buildup to the example form (root PRD.md +
  design.html + index.html). Create design.html preview showing colors, typography, styled button, and sample input.
  Apply one specific refinement — clearer font, stronger contrast, better button/input styling — and verify the
  preview reflects it. Write this refinement as a note inside PRD.md."
- **Changes the agent made in `design.html`:**
  1. Base font 16px with line-height 1.6 (was 14–16px / 1.5) for clearer reading.
  2. Muted text darkened from #667085 to #344054 (≈7:1 on white) for stronger contrast.
  3. Buttons enlarged to 12px × 20px padding, weight 700, 44px min-height, with 3px gold (`#C9A227`) focus-visible ring.
  4. Inputs: real `<label>` elements, 44px min-height, 2px brand focus border + gold ring (keyboard navigable).
- **How to verify:** open `design.html`, read the v2 banner, press Tab through buttons/inputs to see focus rings,
  compare muted-text and button sizes against `Docs/DESIGN_SYSTEM_PREVIEW.html` (v1).
- **Files:** `design.html` (new) · `PRD.md` (this note) · `index.html` (new landing).

### Build log (summary — full changelog in `Docs/PRD.md`)
- 001 (09-20): Reviewed folder/PRD, summarized context.
- 002 (09-20): Installed git, linked repo, pushed PRD to `Noble3000/EDUFARM` (identity Noble Onwuka).
- 003: Rewrote README (1 → 377 lines) from PRD.
- 004: Created phased `Docs/IMPLEMENTATION_PLAN.md` (design system → architecture → launch).
- 005 (09-27): Opened implementation plan. 006: Created `Docs/PRD.md` living changelog (rule: every change logged).
- 007: Locked stack — local Postgres + Better Auth + R2; no Supabase/Vercel; self-host.
- 008: Built `Docs/DESIGN_SYSTEM_PREVIEW.html` (v1 tokens preview).
- 009: Executed Phase 0 — monorepo, tokens, Prisma model, Better Auth config, local Postgres live + seed.
- 010: Executed Phase 1 — API (8 route modules) + 3 Next.js apps + seed demo users; verified live + E2E purchase;
  fixed nested import paths; 11/11 pages HTTP 200.
- 011 (2026-09-28): Aligned repo to example form — root `PRD.md` (this file), `design.html` (v2 refined preview),
  `index.html` (landing); refinement note written here; then continued buildup (Phase 2a assessments).
- 012: Fixed dynamic `[id]` page import crash (`../../../lib/api`).
- 013: Finished Phase 2a — assessment builder, attempts, auto-grade + lecturer grading, live.
- 014: Phase 2b economy — points (pass/recognition/caps/redemption), eSpees settlement run/pay, reviews + replies,
  disputes, email outbox; all verified live.
- 015: Phase 3 AI — entitlement-scoped ask with citations + refusal policy, auto-index on publish, lecturer insights.
- 016: Phase 4 Word (daily Lagos-boundary devotional + archive + reflection card) + institution onboarding;
  production stability — PM2 (all services ~60MB), `@/lib/api` alias, all builds green, 17/17 pages HTTP 200.
- 017: Localhost outage — Windows OOM-killed services at 96% RAM; resurrected via PM2; prevention noted.
- 018: Unified EduPortal-style `index.html` — sidebar + topbar + role-switcher (student/lecturer/admin),
  live API panels, deep links to all apps; search-admin fix included.
- 019: Phone access — Cloudflare tunnels + `infra/static-server.js` + configurable API URL (`?api=`, ⚙️, login field).
- 020: Step 1 hardening — marketing home, role-aware email/password signup/login (scrypt), verification queues.
- 021: CGPA Calculator (Amendment A1) — semesters/courses, 5-point GPA + CGPA + degree class, private, live at `/grades`.
- 022: Real SVG icons everywhere, zero emoji — shared `packages/ui` set wired into apps + portal + design docs.
- 023: STANDING RULE local-first — build/test locally (PM2 + local Postgres); deploy only on explicit instruction.
- 024 (2026-10-01): PWA-first standing note + aligned youthful student hub — manifests/icons/SW + metadata in all 3 apps, one 1080px rail, muted #344054, 44px targets + labels, rebuilt student home (Word → priorities → continue → courses → updates → Q&A → points → AI + pulse/library/CGPA/trust).
- 025: Easy navigation — active nav (`aria-current`), portal switcher, breadcrumbs, mobile bars.
- 026: Lead-engineer baseline audit (read-only) — `FINAL_AUDIT` + `COMPLETION_MATRIX` + `API_GAPS` + `EXTERNAL_SERVICES`.
- 027: Frozen baseline — verify scripts + `BASELINE.md` (toolchain/processes/DB/results, 23 pages + 88 endpoints).
- 028 (2026-10-04): Cross-app UI consistency — single `EDU_CSS` + shared components in `@edufarm/ui`, 3 layouts collapsed (tone by color), 23 screens standardized (labels/states/tables/pagination/modals), QA checklist in `Docs/UI_QA.md`. No hierarchy/business-rule changes.
- 029 (2026-10-05): Hierarchy operational — FKs + uniques + `CourseLecturer` + `VerificationRecord` (2 migrations); chain validation on signup/request/course-create/assignment; verification state machine (5 transitions + resubmit) with records/audit/notifications; enrollment = verified-only request + assigned-lecturer decides (never auto-approved); onboarding approve/reject/suspend/reinstate; chain-cascade UI in signup/verify + queue filters + lecturer suspend/remove. 39/39 E2E. (Folds in concurrent auth-hardening work so `main` stays bootable — see `Docs/PRD.md`.)
- 030 (2026-10-05): Course-space complete — announcement lifecycle (edit/archive) + Q&A consoles + search/resolve (concurrent session).
- 032 (2026-10-05): Student experience end-to-end — Home rewritten on live data (multi-course updates/Q&A/assessments, real trust indicators, points history, dwell-continue, error+retry); library titles/terms; reader real pageCount + buy receipt; own-chain courses list; demo content and dead buttons removed. Card E2E 14/14.
- 033 (2026-10-06): Library as entitlement system — grant states (revoked/suspended), edition snapshots, course links, exact pre-payment terms, transactional grants, unified validity states (active/expiring/expired/archived/permanent). Entitlement E2E 24/24.
- 034 (2026-10-06): Material lifecycle hardened end-to-end (concurrent session).
- 035 (2026-10-06): /grades complete and hardened — student-only privacy (no lecturer/admin path), semester rename + course edit, strict validation, repeat all-in policy, degree-class server source of truth, no export. Tests: unit 10/10 + matrix privacy 6/6 (full 48/48) + live E2E 9/9.
- 036 (2026-10-06): Assessments full workflow + 037 Points hardened (concurrent sessions).
- 038 (2026-10-06): Payment abstraction — provider interface (mock/Paystack/Flutterwave), order state machine, idempotent signed webhooks, server-to-server verify, exactly-once grant + earnings, reconciliation, test mode, `Docs/PAYMENTS.md`. E2E 20/20 (incl. real rotation bug caught).
- 039 (2026-10-06): eSpees accounting ledger (concurrent session).
- 040 (2026-10-06): Trust + disputes complete — eligible reviews with edit/delete, lecturer replies, moderation without takedowns; report→notify→assign→review→resolve/dismiss→appeal→close with SLA, timeline, and reporter privacy. E2E 28/28.
- 041 (2026-10-06): AI as production-grade assistant (concurrent session).
- 042 (2026-10-06): Lecturer insights from aggregates — engagement change, completion trends, topic clusters, unresolved ages, difficulty rates, metric-linked suggestions; ownership-gated, cohort-gated, zero PII/CGPA. E2E 16/17.
- 043 (2026-10-06): Daily Word production-ready (concurrent session).
- 044 (2026-10-06): Notification infrastructure — in-app center (prefs, read/unread, dedup, deep links) + email adapter (mock/resend/sendgrid/smtp) with outbox, retry, failed states; all 10 events wired. E2E 19/19, zero duplicate emails.