# EDUFARM — Detailed Implementation Plan

**Source of truth:** `Docs/PRD EDUFARM.md`
**Overview:** `README.md`
**Status:** Concept / PRD-approved, no code yet
**Goal of this doc:** Actionable, phased build plan from design system → architecture → features → AI → launch, mapped 1:1 to PRD §20 phasing.

> Build order: **Design System → Architecture → Phase 1 (Trust Foundation) → Phase 2 (Engagement & Economy) → Phase 3 (AI & Insights) → Phase 4 (Word & Expansion).** No phase starts without exit criteria of the previous.

---

## Table of Contents

1. [Guiding Constraints from PRD](#1-guiding-constraints-from-prd)
2. [Phase 0 — Product & Technical Foundation](#2-phase-0--product--technical-foundation)
   - [0.1 Repo & Ways of Working](#01-repo--ways-of-working)
   - [0.2 Design System](#02-design-system)
   - [0.3 Architectural Decisions (ADRs)](#03-architectural-decisions-adrs)
   - [0.4 Data Model v1](#04-data-model-v1)
   - [0.5 API & Auth Conventions](#05-api--auth-conventions)
   - [0.6 Environments & DevOps Baseline](#06-environments--devops-baseline)
3. [Phase 1 — Trusted Academic Foundation (MVP)](#3-phase-1--trusted-academic-foundation-mvp)
4. [Phase 2 — Engagement & Academic Economy](#4-phase-2--engagement--academic-economy)
5. [Phase 3 — AI & Advanced Insights](#5-phase-3--ai--advanced-insights)
6. [Phase 4 — Shared Word Experience & Expansion](#6-phase-4--shared-word-experience--expansion)
7. [Cross-Cutting Requirements](#7-cross-cutting-requirements)
8. [Testing Strategy](#8-testing-strategy)
9. [Analytics & Success Measures](#9-analytics--success-measures)
10. [Team, Timeline & Milestones](#10-team-timeline--milestones)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Definition of Done & Exit Criteria](#12-definition-of-done--exit-criteria)
13. [Immediate Next Actions (2-week starter)](#13-immediate-next-actions-2-week-starter)

---

## 1. Guiding Constraints from PRD

These are non-negotiable and shape every technical choice:

1. **Hierarchy is fixed:** `University → Faculty → Department → Level → Course → Lecturer → Student` (§5).
2. **Verification first:** students = institution verification + lecturer course-access control; lecturers = institution/department + platform verification (§5.1).
3. **Separate environments:** lecturer app ≠ student app account (§5.1). No shared session/role-switching hack.
4. **Protected ecosystem:** in-app viewing only. No download, offline, export, screenshot/capture tools for protected materials. Restrict in-app copy where applicable. Watermark + ownership indicators. External-device capture cannot be guaranteed — state this in UI/legal, don't over-promise (§8.5, §18).
5. **Material lifecycle enforced in code:** `Draft → Lecturer approval → Platform review → Published → Reviewed/Updated → Archived`, with versioning, never silent replacement (§8.4).
6. **Free vs paid split enforced:** outlines/announcements/assignment instructions/exam info = free; detailed notes/revision packs/practice/advanced guides = paid within platform bounds + bundles (§8.2–8.3).
7. **Communication = announcements + Q&A only.** No 1-to-1 chat (§9).
8. **Three-value money model:** Naira (payments) + eSpees (internal lecturer settlement) + Academic Points (non-cash, slow, capped, no withdrawal) (§12–13).
9. **AI grounding hierarchy:** authorized lecturer materials first, general knowledge second and labeled, never present general as lecturer position (§11).
10. **Same daily Word for all students** via authorized arrangement + separate academic reflection (§14).

---

## 2. Phase 0 — Product & Technical Foundation

**Duration:** 3–4 weeks. **Exit:** design tokens + component library v0 + ADRs signed + staging env live + data model migrated.

### 0.1 Repo & Ways of Working

- **Monorepo layout (proposed):**
  ```text
  EDUFARM/
  ├── apps/
  │   ├── web-student/       # Next.js student PWA
  │   ├── web-lecturer/      # Next.js lecturer console
  │   ├── web-admin/         # Platform + institution admin
  │   └── api/               # NestJS API
  ├── packages/
  │   ├── ui/                # Design system components
  │   ├── tokens/            # Style tokens (JSON → CSS/Tailwind)
  │   ├── types/             # Shared TS types + Zod schemas
  │   ├── reader/            # Protected material viewer
  │   └── config/            # ESLint, TS, Tailwind presets
  ├── services/
  │   ├── ai-worker/         # Ingestion + RAG + insights jobs
  │   └── notifications/     # Email + push templates/queue
  ├── Docs/
  │   ├── PRD EDUFARM.md
  │   ├── IMPLEMENTATION_PLAN.md (this file)
  │   └── ADRs/              # 001-stack.md, 002-auth.md, etc.
  └── infra/                 # Caddyfile, pm2 ecosystem, backup scripts, tunnel config (no Terraform/Vercel)
  ```
- **Branching:** `main` protected, `develop` integration, `feat/*`, `fix/*`. PRs require 1 review + CI green. Conventional commits (`feat:`, `fix:`, `docs:`).
- **Tooling:** pnpm workspaces + Turborepo, TypeScript strict, ESLint + Prettier, Husky pre-commit, Changesets for versioning.
- **Docs:** ADRs for every major decision. OpenAPI as source of truth for API. Storybook as source of truth for UI.

### 0.2 Design System

**Objective:** Trusted-by-design look: official/verified states must be instantly scannable by students with low-end devices and variable literacy.

**0.2.1 UX principles**
- Mobile-first (70%+ students on Android, small screens, expensive data). Every screen usable at 360px wide, 3G.
- Academic priority hierarchy on home matches PRD §6.1 order: Word → priorities → continue → courses → updates → Q&A → points → AI.
- Trust-first: verified badges, official vs informational color system, price + access duration always adjacent to CTA.
- Low-data: skeletons, progressive images, paginated lists, no auto-play, PDF page streaming not full download.

**0.2.2 Tokens (create `packages/tokens/tokens.json`)**
- **Colors:**
  - `brand.primary` (deep academic green #0E5A3C — trust/growth), `brand.accent` (gold #C9A227 — achievement/Word), `ink` (neutral text scale), `paper` (backgrounds).
  - Semantic: `official` (green solid), `informational` (neutral outline), `urgent` (red), `warning` (amber), `success`, `danger`.
  - All text AA contrast ≥4.5:1. Provide light + dark variants from day 1 for reader night-study.
- **Typography:** 1 display (e.g., Fraunces or Sora for headings/Word) + 1 text (Inter for UI). Scale: 12/14/16/20/24/32/40. Line-height 1.5 for reader. Support English first; font stack must handle diacritics for Nigerian names.
- **Spacing/radius/shadows:** 4pt grid, radius sm=6 md=12 lg=20 (cards), reader max-width 72ch.
- **Motion:** 150–250ms ease, respects `prefers-reduced-motion`.

**0.2.3 Components (build in `packages/ui` + Storybook, in this order)**
1. Primitives: Button, Input, Textarea, Select, Checkbox/Radio, Badge, Avatar, Tabs, Dialog, Toast, Tooltip, EmptyState, Skeleton.
2. Trust: `VerifiedBadge` (Institution/Lecturer), `OfficialMaterialTag`, `EditionTag (v2.1)`, `AccessTermsLine` (price + duration), `PriceBlock`.
3. Academic: `CourseCard` (progress bar), `MaterialCard` (cover, type icon, official tag, price), `AnnouncementCard` (category + urgency), `QuestionThread` (unanswered/answered/resolved states, lecturer reply highlight), `ProgressBar`, `StreakChip`, `PointsBalance`, `ReaderToolbar`.
4. Layout: `StudentHomeShell`, `LecturerConsoleShell`, `AdminShell`, `BottomNav` (mobile), `SideNav` (desktop).
5. Reader: `ProtectedViewer` (paginated canvas, no right-click/save, watermark overlay with user ID + timestamp, page-tracking events).

**0.2.4 Figma structure**
- Pages: `01-Tokens`, `02-Components`, `03-Student flows`, `04-Lecturer flows`, `05-Admin flows`, `06-Reader`, `07-Email`.
- Must design: student home, course detail, material detail + purchase sheet, reader, library, Q&A thread, lecturer dashboard, upload wizard, announcement composer, verification queues.
- Accessibility checklist per screen: focus order, labels, 44px touch targets, error states.

**0.2.5 Deliverable:** Storybook deployed, Figma linked in README, a11y audit pass, Lighthouse mobile ≥85 on shell.

### 0.3 Architectural Decisions (ADRs)

> **Owner steering 2026-09-27 (locked):** Local Postgres on owner device (Supabase has subscription cost — do NOT use Supabase). Better Auth for auth. Cloudflare R2 for storage. No Vercel. Host on local device. These override any earlier suggestions below.

**Locked stack (justify in ADRs):**

| Concern | Decision | Why / How on local device | Rejected |
| :--- | :--- | :--- | :--- |
| Web apps | Next.js 14 (App Router) + Tailwind, self-hosted with `next start` on local device | One TS codebase, PWA for students, no Vercel needed; run `web-student :3001`, `web-lecturer :3002`, `web-admin :3003` via PM2 | Vercel — rejected per owner |
| Mobile | PWA first, test on phone via LAN/Tailscale or Cloudflare Tunnel URL | No install friction, works on low-end Android | React Native / Flutter — defer |
| API | NestJS + TypeScript + Prisma ORM, self-hosted on local device (`:4000`) | Structured modules for verification/materials/payments, RBAC, audit | Supabase/Firebase — rejected per owner |
| DB | **PostgreSQL 16 on local device** + Prisma Migrate + `pgvector` extension (for Phase 3) | No subscription, full ACID for money + hierarchy. Install options (pick one): **A) Native EDB installer** (lightest on 8GB RAM) + pgAdmin 4 + `CREATE EXTENSION vector`; **B) Docker Desktop + Compose** (Postgres + Redis + Mailhog in one file, needs WSL2 + ~2GB RAM). Connection: `postgresql://edufarm:***@localhost:5432/edufarm`. Backups: nightly `pg_dump` → Cloudflare R2 `backups/` bucket. GUI: pgAdmin 4 or DBeaver. | Supabase Postgres / Neon / RDS — rejected per owner (subscription). Mongo — rejected (money needs joins) |
| Queue/cache | Redis optional; start with Postgres-based queue (`pg-boss`) to avoid extra service on 8GB machine, add Redis (Memurai/WSL) only when notifications/AI jobs need it | Fewer moving parts locally | Managed Redis — rejected |
| File storage | **Cloudflare R2 (S3-compatible) private buckets only** — `edufarm-materials` (originals, no public access), `edufarm-pages` (rendered page images/WebP), `edufarm-backups`, `edufarm-uploads-tmp` | S3 API with R2 access keys, presigned URLs (60s) for page streaming, lifecycle rules to purge tmp/, versioning on materials bucket. R2 is remote (not local) but is the only cloud exception per owner | Supabase Storage — rejected per owner; public buckets — rejected |
| Protected viewing | PDF → page images (server render) + canvas viewer, per-page R2 presigned URLs, watermark (user ID + time), event logging | Enforces no-download, enables progress tracking | Direct PDF URL — rejected |
| Search | Postgres full-text first, Meilisearch self-hosted binary later when Q&A scales | Zero extra infra for MVP | Algolia/Elastic — overkill early |
| Payments (Naira) | Paystack (primary) + Flutterwave (fallback), webhooks + idempotency keys | Nigerian coverage, bank transfer/USSD/cards | Stripe — poor Naira coverage |
| Email | Resend or Postmark + queued templates (or local Mailhog for dev, SMTP for prod) | Transactional reliability, audit trail | Raw SMTP only — rejected for prod |
| Push/in-app | Web Push + in-app `Notification` inbox table | Primary surface is in-app per PRD §17 | FCM native — defer |
| AI | Python FastAPI worker (local `:8001`) + pgvector (same local Postgres) + LLM API with strict RAG | Isolation of heavy ingestion, entitlement-scoped vectors | In-process Node embeddings — rejected |
| Analytics | PostHog self-hosted (Docker) or local event tables + Metabase; no GA dependency | Event-level funnels for study journey | GA-only — insufficient |
| Auth | **Better Auth + Postgres adapter (Prisma/Drizzle)** — email+password + phone optional, session cookies, 2FA/TOTP plugin for staff, organization plugin for institution scoping | Single auth library across student/lecturer/admin portals with `role` + `verificationStatus` claims in session; distinct login routes (`/student/login`, `/lecturer/login`, `/admin/login`) share Better Auth backend but enforce role at middleware; audit every verification transition | Auth.js/Clerk/custom JWT/Firebase/Supabase Auth — rejected per owner (use Better Auth) |
| Hosting | **Local device (Windows 11): Node 20 LTS + pnpm + PM2 + Caddy reverse proxy** (`edufarm.test` → localhost ports), public demo via **Cloudflare Tunnel** (`trycloudflare` URL, no port-forward), phone testing via LAN IP or Tailscale | No Vercel/Render/Fly. CI still on GitHub Actions (lint/test/build); CD = `git pull` on this machine + `prisma migrate deploy` + `pm2 restart`. Uptime target is best-effort (device must stay on + Postgres service auto-start) | Vercel / Render / Fly / Supabase — rejected per owner |

**Key ADRs to write in Phase 0:** `001-local-stack` (Next self-host + local Postgres + R2 + Better Auth), `002-better-auth-RBAC`, `003-protected-reader-R2`, `004-payments-settlement`, `005-AI-RAG-pgvector-local`, `006-notifications-local`, `007-institution-scoping`.

- **Multi-tenancy:** single DB, `institutionId` scoping on every query (row-level security via middleware, not Postgres RLS initially for simplicity, add RLS in Phase 2). Every table with academic scope carries `institutionId`.
- **RBAC matrix:** `student | lecturer | deptAdmin | institutionAdmin | platformAdmin`. Lecturer ≠ student: separate user pools with `lecturerProfiles` and `studentProfiles` linked to `users`; prevent role-switching via distinct login routes + middleware.
- **Audit:** append-only `auditLogs` for verification decisions, material state transitions, price changes, settlements, disputes.

### 0.4 Data Model v1

Core tables (Prisma-style, simplified):

```prisma
University { id, name, slug, verified, logoUrl }
Faculty { id, universityId, name }
Department { id, facultyId, name }
Level { id, departmentId, name } // e.g., 100, 200
Course { id, departmentId, levelId, code, title, isOfficial, lecturerId }
User { id, email, phone, passwordHash, role, status }
StudentProfile { id, userId, universityId, facultyId, departmentId, levelId, matricNo, verificationStatus, verifiedAt }
LecturerProfile { id, userId, departmentId, staffId, verificationStatus, bio }
Enrollment { id, courseId, studentId, status } // requested | approved | rejected | removed
Material { id, courseId, lecturerId, title, type, description, priceKobo, isFree, accessDurationDays, version, status } // draft|pendingLecturer|pendingReview|published|archived
MaterialVersion { id, materialId, version, fileKey, checksum, createdAt }
MaterialFile { id, materialVersionId, pageCount, pageImageKeys[] }
Bundle { id, lecturerId, title, priceKobo } + BundleItem { bundleId, materialId }
Purchase { id, studentId, materialId?, bundleId?, amountKobo, pointsUsed, status, accessExpiresAt }
Announcement { id, courseId, lecturerId, category, title, body, isUrgent }
Question { id, courseId, authorId, title, body, status } // unanswered|answered|resolved
Answer { id, questionId, authorId, isLecturer, body }
StudyEvent { id, studentId, courseId, materialId?, type, page, durationSec } // for progress + streaks
Assessment { id, courseId, title, type, dueAt } // Phase 2 but table now
PointLedger { id, studentId, amount, reason, capKey } // Phase 2 but table now
ESpeesLedger { id, lecturerId, purchaseId, grossKobo, lecturerShareKobo, platformShareKobo, status } // pending|available|settled
Review { id, materialId, studentId, rating, body, status } // Phase 2
Dispute { id, reporterId, targetType, targetId, reason, status, resolution } // Phase 2
Notification { id, userId, type, title, body, readAt }
Devotional { id, date, title, verse, body, sourceRef } // Phase 4 but table now
```

- **Constraints:** price bounds table `pricingRules { minKobo, maxKobo, bundleMaxKobo }`; access durations enum; unique `(courseId, code)`; checksum prevents duplicate uploads.
- **Migrations:** seeded demo university/faculty/department for staging.

### 0.5 API & Auth Conventions

- REST `/api/v1/...` with OpenAPI; idempotency header `Idempotency-Key` on purchases/webhooks.
- Auth: **Better Auth (Postgres adapter)** — session cookies (HttpOnly, `__Secure-` in prod via Tunnel HTTPS), TOTP 2FA plugin for dept/institution/platform admins, rate-limit auth + AI routes. Session carries `role` + `verificationStatus`; middleware enforces `verified` + `enrolled` before material APIs.
- Better Auth tables (via adapter): `user`, `session`, `account`, `verification` + app tables `StudentProfile`/`LecturerProfile` linked by `userId`. Never use Supabase Auth.
- Verification endpoints: `POST /verifications/student/request`, `POST /verifications/lecturer/request`, admin approve/reject with reason + audit.
- Material upload: `POST /materials (draft)` → presigned PUT to R2 `uploads-tmp/` → server validates + copies to `materials/` → `POST /materials/:id/submit` → platform queue → `approve/reject` → `publish` (renders pages to `pages/`). All transitions validated by state machine (Zod + server guard).
- Purchases: create pending → verify Paystack webhook → grant entitlement + ledger entries atomically (DB transaction).
- Reader: `GET /materials/:id/pages/:n/url` returns 60s R2 presigned URL + logs `StudyEvent`. Watermark user ID server-side.

### 0.6 Environments & DevOps Baseline (local-first, no Vercel/Supabase)

- `local` = this Windows 11 device: native **Postgres 16 service (auto-start)** + Node 20 + pnpm + PM2 (api, web-student, web-lecturer, web-admin, ai-worker) + Caddy (`:80/:443` → localhost ports). Dev mail via Mailhog (`:8025`); prod mail via Resend/Postmark SMTP. R2 is the only cloud service (buckets + presigned URLs).
- What to install (in order): 1) Node 20 LTS + pnpm, 2) PostgreSQL 16 EDB installer + pgAdmin 4, 3) `CREATE DATABASE edufarm; CREATE EXTENSION vector;`, 4) Cloudflare R2 account + API tokens + 4 buckets, 5) Caddy + Cloudflare Tunnel (`cloudflared`) for public demo URLs, 6) PM2 (`npm i -g pm2`, `pm2 startup`).
- Backups: nightly `pg_dump edufarm` → R2 `backups/` (7-day retention) + weekly full; test restore monthly. Postgres data dir on C: (140GB free confirmed 2026-09-27).
- CI (GitHub Actions): lint + typecheck + unit + e2e (Playwright smoke against local Postgres service container) + Storybook build. No Vercel previews — PR previews run as extra local PM2 ports or ephemeral Tunnel URLs.
- CD (local): `git pull origin main` on this device → `pnpm i` → `prisma migrate deploy` → `pnpm build` → `pm2 restart all`. Tag releases in git; keep `.env` only on device + backup USB (never in repo).
- Secrets: local `.env` files + Windows Credential Manager for R2/Paystack keys; no secrets in repo. R2 keys rotatable from Cloudflare dashboard.

---

## 3. Phase 1 — Trusted Academic Foundation (MVP)

**Maps to PRD §20 Phase 1. Duration:** 8–12 weeks after Phase 0. **Goal:** one pilot department can verify users, run courses, publish protected materials, sell bundles, and study with basic progress.

### 1.1 Institution / Identity / Verification

- [ ] CRUD universities/faculties/departments/levels/courses (platform + institution admin UI).
- [ ] Student verification flow: signup → select institution/faculty/department/level → upload matric evidence → `pending` → dept/institution admin approve → `verified`. Show `Verified Institution` badge.
- [ ] Lecturer verification: signup (lecturer portal) → department + staff ID + evidence → platform verification queue → `verified`. Show `Verified Lecturer` badge. Enforce separate login domain/routes.
- [ ] Course assignment: link lecturer(s) to courses, mark `Official Course`.
- [ ] Enrollment: student requests → lecturer approves/manages (approve/reject/remove). Unapproved sees nothing in course.
- **Acceptance:** E2E verified student + verified lecturer in same course; unverified cannot access materials API (403).

### 1.2 Course Spaces, Announcements, Q&A

- [ ] Course detail (student): materials tab, announcements feed, Q&A tab, access status.
- [ ] Lecturer console: enrollment list, announcement composer (6 categories per §9.1 + urgent flag), Q&A moderation (mark answered/resolved, lecturer highlight).
- [ ] Q&A search (Postgres FTS), pagination, anti-spam rate limits.
- [ ] Notifications: in-app for new announcement, new material, access approval/change (email deferred to Phase 2 except critical).
- **Acceptance:** lecturer posts urgent announcement → enrolled students see in priorities + inbox within 60s.

### 1.3 Material Pipeline + Protected Reader + Library

- [ ] Lecturer upload wizard: metadata (type, free/paid, price within bounds, access duration) → file upload (PDF only MVP) → checksum + virus scan (ClamAV) → preview render → lecturer approval checkbox (ownership attestation) → submit.
- [ ] Platform review queue: approve/reject with reason, version history, audit log. Rejection returns to draft with comments.
- [ ] Publishing: version freeze, `Officially Published` tag, edition display.
- [ ] Reader: paginated canvas, zoom, night mode, no download/print/right-click, watermark (name + ID + time), per-page entitlement check, resume position, completion % (last page + dwell time, not just open).
- [ ] Library: purchased + free + bundles + expiry countdown + access terms line. Archived editions remain per policy.
- [ ] Bundles: lecturer creates, prices within bounds, publishes; purchase grants all items.
- **Acceptance:** student cannot fetch file bytes directly (signed page URLs only, 403 on raw bucket); progress persists across devices.

### 1.4 Purchases (Naira) — Phase 1 subset

- [ ] Material/bundle detail: price + access duration + edition + lecturer + trust badges adjacent to pay CTA (transparent pricing rule).
- [ ] Paystack checkout (card/bank/USSD), webhook verification, idempotent purchase, receipt page + library grant.
- [ ] Pending → lecturer share calculation (configurable split, default e.g., 70/30 pending final decision) recorded in `ESpeesLedger` as `pending` (settlement UI in Phase 2).
- [ ] Purchase history + receipts (email receipt basic).
- **Acceptance:** test purchase ₦500 → library access granted, ledger entries balanced, duplicate webhook does not double-grant.

### 1.5 Basic Study Progress

- [ ] `StudyEvent` ingestion (page view + dwell), course progress %, continue-studying resolver.
- [ ] Student profile: courses, progress, library, purchase status.
- [ ] Lecturer dashboard v0: enrollment count, material views/completions, announcement/Q&A counts.
- **Acceptance:** progress bar moves only on meaningful reading (≥X sec/page), not on open.

**Phase 1 exit:** pilot department live with 3+ lecturers, 50+ students, 10+ official materials, ≥1 paid bundle purchased, reader abuse test passed, weekly retention tracked.

---

## 4. Phase 2 — Engagement & Academic Economy

**Maps to PRD §20 Phase 2. Duration:** 6–8 weeks. **Goal:** assessments + points + earnings transparency + trust loops.

### 2.1 Tests, Quizzes, Assignments

- Lecturer builder: objective (MCQ, true/false, short auto-graded) + subjective (file/text, manual grading). Due dates, attempts, time limits.
- Student: attempt UI, autosave, submission receipt, grades + lecturer feedback.
- Auto-grade engine + manual grading queue. Completion emits `StudyEvent` + feeds points eligibility (not automatic points).
- Policies doc: late submission, retakes per course type (resolve open decision §21).

### 2.2 Academic Points (slow economy)

- Rules engine: `pointsRules { event, points, dailyCap, weeklyCap, termCap }`. Examples: assessment pass (10), Q&A accepted answer (5, lecturer-capped 20/week), study streak 7d (15), material completion (8). **Never** for open/purchase.
- Lecturer recognition: limited quota per week, reason required, audit-logged, anti-collusion (same student cap).
- Ledger + balance + 4-tier milestone display (early/intermediate/advanced/long-term). Redemption: points offset eligible purchases at high ratio (e.g., 1000 pts = ₦100, min 5000 pts to redeem — finalize after modelling).
- Abuse guards: device fingerprint, velocity checks, manual review flag.

### 2.3 Earnings & Settlement (eSpees)

- Dashboard: material-level sales, lecturer vs platform split, pending/available/settled, next settlement date, CSV export.
- Settlement job: `pending` → `available` after holding period (e.g., 7 days + refund window) → `settled` via bank transfer (Paystack Transfers), with ledger + audit + email.
- Config: `settlementRules { holdDays, minPayoutKobo, schedule }`. eSpees displayed as internal unit, convertible per governing policy (open decision).

### 2.4 Reviews, Reporting, Disputes

- Reviews: eligible only after meaningful completion; rating + text; lecturer reply; helpful votes; report button.
- Reporting: material problem / violation categories; triage queue; no auto-takedown; SLA timers.
- Dispute flow (§16.1): report → notify → review → resolution → appeal. Admin UI with timeline + audit.

### 2.5 Notifications + Email expansion

- In-app inbox + preferences (urgent always on). Email templates: announcement, new material, payment/receipt, test/exam update, deadline reminder (24h + 1h), access change, revision notice, account notice. Queue with retry + unsubscribe for non-critical.

### 2.6 CGPA Calculator (Amendment A1, 2026-09-29)

- Student-private grade records (`GradeSemester` + `GradeCourse`): semesters with courses (code, 1–12 units, grade A–F); server-computed GPA/CGPA on the 5-point scale with degree-class bands; feeds Study Journey; never exposed to lecturers (enforced by student-scoped queries).

**Phase 2 exit:** assessments live, points issuance with caps enforced, first settlement run completed, review→dispute loop tested, email delivery ≥98%.

---

## 5. Phase 3 — AI & Advanced Insights

**Maps to PRD §20 Phase 3. Duration:** 6–10 weeks. **Goal:** course-grounded assistant that never impersonates lecturer + lecturer insights.

### 3.1 Ingestion & Retrieval (RAG)

- Pipeline (ai-worker): on `Material.published` → extract text (PyMuPDF) → clean → chunk (800 tokens, 120 overlap) → embed → pgvector with metadata `{materialId, version, courseId, institutionId, accessDuration}`. Re-index on new version (old version retained for entitled users).
- Entitlement filter: retrieval scoped to `purchases + free grants + enrollment` at query time. No leakage across courses. Unentitled chunks never returned.
- Evaluation set: 100 Q/A pairs from pilot materials; faithfulness + citation precision tracked.

### 3.2 Student Assistant

- UI: course-scoped chat + `Ask This Material` button in reader (selected text as context).
- Modes: Explain, Summarize, Compare (across authorized resources), Practice questions, Quiz/revision session, Exam prep plan.
- Response contract: `answer + citations [Material vX, pY] + source-separator`. General knowledge section labeled `Additional context (not lecturer material)`. Refuse when no authorized source + suggest asking lecturer (creates Q&A draft).
- Guardrails: system prompt with hierarchy, max tokens, toxicity filter, no disallowed content, logging of grounded vs general ratio.

### 3.3 Lecturer Insights

- Nightly jobs: engagement deltas, unresolved topic clustering (embeddings + LLM summary), weak/strong completion flags, difficulty hotspots, suggested clarification actions.
- Dashboard cards: `At-risk topics`, `Top questions`, `Material health`, `Suggested next material`. One-click `Create announcement` from insight.
- Privacy: aggregated only, no individual student surveillance; opt-out for students on detailed tracking (show aggregate).

### 3.4 Study Journey Analytics

- Timeline: courses, completions, assessments, streaks, recognitions, points over time. Exportable transcript-style PDF (non-material data only).
- Lecturer view: class-level funnels, never individual PII beyond enrollment needs.

**Phase 3 exit:** grounded answer rate ≥85% on eval, citation precision ≥90%, lecturer insights used weekly by pilot lecturers, AI cost per student tracked.

---

## 6. Phase 4 — Shared Word Experience & Expansion

**Maps to PRD §20 Phase 4. Duration:** 4–6 weeks + ongoing. **Goal:** same daily Word for all + cross-institution scale.

### 4.1 Devotional

- Content pipeline: authorized source ingestion via licensed feed/API (resolve rights per §21) → `Devotionals {date, title, verse, body, audioUrl?}` → single active per day (UTC+1 Lagos day boundary) → archive browsable.
- Home integration: Word hero at top, but urgent academics (test today, deadline) pinned above via `priorities` slot — Word never displaced, per §14.
- Separate `Academic reflection` card (discipline/excellence/integrity/consistency) labeled distinct from devotional.
- Offline cache for today's Word only (exception to no-offline rule, since non-protected).

### 4.2 Expansion hardening

- Institution onboarding wizard (self-serve request → platform approval → seed faculties/departments).
- Bulk import (CSV) for students/courses, verification SLAs dashboard.
- Performance: local Postgres tuning + R2/CDN page cache, search scaling (self-hosted Meilisearch binary), rate-limit tuning. No read replicas (single local DB; add standby only if device upgraded).
- Localization prep (English → future French/Arabic for northern institutions), accessibility audit, data-retention policies.

**Phase 4 exit:** Word live with license proof, multi-institution pilot (≥3 universities), p95 reader page load <1.5s on 3G, uptime 99.5%.

---

## 7. Cross-Cutting Requirements

- **Security:** OWASP ASVS L2, encrypted at rest (KMS), TLS 1.2+, PII minimization, matric/staff ID redaction in logs, annual pentest, bug-report channel. No secrets in client. Signed URLs short-lived. CSRF + CSP strict (reader blocks iframes).
- **Privacy & legal (Nigeria):** NDPR compliance, consent logs, data-processing agreement with institutions, takedown + appeal SLAs, terms stating external capture not preventable.
- **Accessibility:** WCAG 2.2 AA, keyboard-navigable reader, screen-reader labels for badges, captions for any video (future).
- **Data & costs:** data-saver mode (low-res pages default), page-image compression (WebP, 1200px), AI token budgets per student/day.
- **Content moderation:** profanity + plagiarism scan on upload (basic similarity hash), manual review queue prioritized by paid content.
- **Brand:** EDUFARM wordmark + trust badge set; watermark must not obscure content (8% opacity footer).

---

## 8. Testing Strategy

| Level | What | Tools | Gate |
| :--- | :--- | :--- | :--- |
| Unit | pricing, points caps, settlement math, state machines | Vitest/Jest | ≥80% on money/points modules |
| Integration | verification flow, purchase webhook idempotency, entitlement filter | Supertest + local Postgres test DB (`edufarm_test`) | CI required |
| E2E | student signup→verify→enroll→buy→read→progress; lecturer upload→review→publish; dispute loop | Playwright | Smoke on every PR, full nightly |
| Security | authz matrix (unverified/unenrolled cannot read), signed-URL expiry, no raw bucket access | Custom scripts + OWASP ZAP | Pre-release |
| AI eval | faithfulness, citation precision, refusal correctness | RAG eval harness | ≥thresholds to ship |
| Performance | reader p95, concurrent purchases, ingestion throughput | k6 | Phase exit criteria |
| UAT | pilot lecturers/students scripted tasks + SUS survey | Manual | ≥75 SUS to exit Phase 1 |

---

## 9. Analytics & Success Measures

Map PRD §19 to events:

- Adoption: `user.verified`, `course.enrolled`, `WAU`.
- Engagement: `material.completed`, `assessment.submitted`, `question.asked/answered`, `streak.day`.
- Lecturer: `material.published`, `announcement.posted`, `answer.posted`.
- Trust: `% official materials`, `review.avg`, `dispute.resolved SLA`.
- Affordability: `purchase.rate`, `avgPrice`, `bundle.attach`, `points.redeemed`.
- AI: `ai.session`, `ai.groundedRatio`, `practice.completed`.
- Health: retention D7/D30, abuse rate, settlement on-time %.
- Dashboards: self-hosted PostHog or local event tables + Metabase for institution reports (no cloud analytics dependency).

---

## 10. Team, Timeline & Milestones

**Lean team (6–8):** 1 Product/PM (you) + 1 Designer (design system + flows) + 2 Frontend + 2 Backend + 1 AI/Data (part-time until Phase 3) + 1 QA/Ops (part-time). Institution liaison for pilot.

| Phase | Duration | Milestone demo |
| :--- | :--- | :--- |
| Phase 0 | 3–4 wks | Storybook + staging + ADRs + seeded DB |
| Phase 1 | 8–12 wks | Pilot dept live, paid bundle bought, reader protected |
| Phase 2 | 6–8 wks | Assessments + points + first payout |
| Phase 3 | 6–10 wks | Grounded AI + insights weekly use |
| Phase 4 | 4–6 wks | Daily Word + 3 institutions |

Total to full vision: **~7–10 months** with lean team. MVP (Phase 1) alone: **~3–4 months**.

---

## 11. Risks & Mitigations

- **Content leakage (screenshots):** mitigate with watermark + education + legal; never promise prevention. Track abuse rate.
- **Lecturer adoption:** co-design upload wizard with 2–3 lecturers; concierge ingestion for pilot (convert their PDFs).
- **Payment failures (bank/USSD):** Paystack + fallback, clear pending states, auto-reconcile job.
- **AI hallucination as lecturer view:** strict citation UI + refusal + eval gates; lecturer can flag AI answer → Q&A.
- **Verification bottleneck:** SLA dashboard + bulk approve + institution admin training.
- **Cost blowout (AI/storage):** per-student budgets, page-image lifecycle, eval before scaling.
- **Devotional licensing:** start with placeholder reflection + legal track in parallel; no launch without authorization proof.

---

## 12. Definition of Done & Exit Criteria

Every feature must meet: typed + linted + tested + documented (Storybook/OpenAPI) + analytics event + audit log (if money/verification/content state) + accessibility check + mobile 360px check + PR review. Phase exits require pilot metrics in §3–6.

---

## 13. Immediate Next Actions (2-week starter)

1. [ ] Approve locked stack (local Postgres + Better Auth + R2, no Supabase/Vercel) + monorepo layout. Create `apps/`, `packages/`, `infra/` scaffolds.
2. [ ] Install on this device: Node 20 + pnpm, Postgres 16 + pgAdmin, R2 buckets/keys, Caddy + Tunnel, PM2.
3. [ ] Designer: tokens + 10 primitives + `VerifiedBadge` + `MaterialCard` in Storybook.
4. [ ] Backend: Better Auth + Postgres adapter + RBAC + University→Course CRUD + seed script.
4. [ ] Backend: verification request/approve endpoints + admin queue UI skeleton.
5. [ ] Spike: PDF → page images → signed URL viewer with watermark (prove protected model).
6. [ ] Spike: Paystack test checkout → webhook → idempotent grant.
7. [ ] Legal: devotional source outreach + NDPR checklist + terms draft.
8. [ ] Pilot: sign 1 department, list 3 lecturers + 50 students for UAT.

---

**Next doc to create:** `Docs/ADRs/001-local-stack.md` (local Postgres + Better Auth + R2 + self-host) → then Figma links + `packages/tokens/tokens.json`.
