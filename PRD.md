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
- **Phase 1 (done, live locally):** verification, course spaces, announcements/Q&A, material lifecycle + protected
  reader shell, mock Naira checkout, library, study progress.
- **Phase 2 (in progress):** assessments, points engine, eSpees settlement, reviews/disputes, email.
- **Phase 3:** course-grounded AI + lecturer insights. **Phase 4:** daily Word experience + multi-institution scale.

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
