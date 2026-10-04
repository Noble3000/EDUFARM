# EDUFARM — Final Baseline Audit

**Date:** 2026-10-04 · **Auditor:** lead finishing engineer (baseline pass, no broad code changes)
**Scope:** all 3 Next.js apps (23 pages), API (19 route modules), Postgres schema (6 migrations), portal previews.
**Services during audit:** API :4000 ✓, student :3001 ✓, lecturer :3002 ✓, admin :3003 ✓, portal static :8080 ✓ (PM2 production).

Severity: **P0** = blocks any shared-network use · **P1** = breaks PRD promises or leaks · **P2** = incomplete feature · **P3** = polish.

---

## A. Screen-by-screen audit

Format: Route | Role | Data/API | Loading/Empty/Error/Success | Mobile/Desktop/a11y | Problems → severity

### Student (`:3001`)

| Route | Role | Data | States | Issues |
| :--- | :--- | :--- | :--- | :--- |
| `/` home | public→personalized | notifications, progress/continue, enrollments, points, devotional | loading → welcome vs dashboard; empty states present | Devotional fetch runs pre-login (harmless, public endpoint). **P3**: unverified users see full dashboard shell with empty cards instead of a verification nudge |
| `/signup` | public | universities, `POST /auth/signup` | validation errors shown; success auto-logs-in | **P2**: faculty/department/level sent as `""` — profile row incomplete until verify page; no evidence upload (PRD wants matric evidence). No rate limit on signup (spam profiles → **P1** abuse vector) |
| `/login` | public | `POST /auth/login` (+ demo shortcut) | error msg shown | **P0**: demo-login button needs only an email — full account takeover for anyone with network access. **P1**: no lockout/rate-limit on password login (brute force) |
| `/verify` | student | universities, verification/me | status display; request flow works | Sends empty faculty/dept/level strings; stores `""` not null. **P2**: no evidence upload; **P3**: after approval no notification shown (inbox has it, page doesn't refresh state) |
| `/courses` | student | hierarchy chain `unis[0]/facs[0]/deps[0]` | loading text; enroll request alerts | **P1**: hardcoded first-chain traversal — shows wrong department's courses once a 2nd university exists. No search/sort |
| `/courses/[id]` | enrolled ideally | course detail + assessments + Q&A + AskAI | loading; ask-question refreshes | **P2**: no enrollment gate on the page itself (API enforces; page shows content shells + errors). AskAI + assessments lack loading spinners |
| `/materials/[id]` reader | entitled | page-url, ping, checkout, reviews | 402 → buy box; watermark; dwell ping @9s | **P1**: expiry (`accessExpiresAt`) never checked — expired purchases keep reading. Dwell ping fires once per page-load, not per actual dwell. No zoom/text-size controls (**P2** a11y) |
| `/library` | student | library/me | empty states present | Shows raw materialIds for purchases (no titles — resolves via extra fetch; **P2**) |
| `/assessments/[id]` | enrolled | start/submit/attempts | result panel; max-attempts error surfaced | **P2**: `timeLimitMin`/`dueAt` displayed nowhere and unenforced; no beforeunload guard on in-progress attempt |
| `/grades` (CGPA) | student | grades/me | empty → "Loading… (log in first)"; add/delete flows | Verified math ✓. **P3**: no edit-course, no what-if/target mode; delete has no confirm |
| Portal sections (AskAI box, progress, points, notifications) | student | ai/ask, progress, points, inbox | grounded/refusal contract renders | **P2**: no per-material scope selector in AskAI box (API supports `materialId`, UI doesn't expose Ask-This-Material) |

### Lecturer (`:3002`)

| Route | Role | Data | States | Issues |
| :--- | :--- | :--- | :--- | :--- |
| `/` dashboard | lecturer | hierarchy chain, earnings/me | earnings pending shown | **P1**: same first-chain traversal bug as student courses. No engagement stats (dashboard v0 only) |
| `/courses/[id]` manage | lecturer | enrollments, announcements, materials, assessments, insights | working composers | **P1**: no ownership check — any verified lecturer manages any course's enrollments/materials/assessments. Assessment QuestionForm is MCQ-only (no theory builder — yet theory exists in data model, **P2** inconsistency). Attempts viewer shows ids only, no per-student names/scores table (**P2**). No material edit/version upload (**P1** lifecycle gap) |
| `/login`, `/signup` | public/lecturer | auth endpoints, hierarchy selects | working | Lecturer signup has no evidence upload (**P2** vs PRD) |

### Admin (`:3003`)

| Route | Role | Data | States | Issues |
| :--- | :--- | :--- | :--- | :--- |
| `/` home | staff | links | static | Fine. No KPI numbers (pending counts) — **P3** (portal shows them, admin home doesn't) |
| `/verifications` | staff | pending queues + decide | works | Lecturer decide restricted to platform/institution admin ✓. No evidence to inspect (nothing uploaded) — queue approves blind (**P2** process gap) |
| `/reviews` | reviewer | review queue | works | **P1**: cannot preview material content before publishing (no file bytes exist at all) |
| `/settlements` | platformAdmin | overview/run/pay | works, verified end-to-end | HOLD_DAYS read at module load (restart picks up env change — fine). No per-lecturer filter in UI (**P3**; API supports `lecturerId`) |
| `/disputes` | staff | disputes + resolve via prompt() | works | `prompt()` is crude but functional (**P3**). No appeal path UI (**P2** vs §16.1) |
| `/email` | platformAdmin | outbox viewer | works | Read-only log; no resend/retry (**P3** — needs real sender first) |
| `/onboarding` | platformAdmin | pending universities + approve | works | **P2**: approval creates bare university (no faculties/departments/levels seeding, no linked admin user) — new institution is an empty shell |
| `/login`, `/signup` | public | auth/access-requests | works | Access requests land in disputes queue as AccessRequest — discoverable only via Disputes page (**P3** labeling) |

### Portal (`index.html`, `:8080`)

| Area | Issues |
| :--- | :--- |
| Marketing hero + role cards | Working. Role-card links hardcode `localhost:300x` — dead on phones (portal's own quick actions use same hardcodes). **P1**: deep links must be relative/host-aware for tunnel use |
| Role switcher dashboard | Working per role with live data. **P2**: uses passwordless demo/login (inherits P0). Search box only filters student/lecturer course tables |
| design.html / preview doc | Clean, zero emoji. Static — no live binding (by design) |

### Cross-cutting UX

- **Mobile**: bottom bars present in all apps; 44px targets; viewport-fit cover. **P2**: reader has no zoom/reflow; tables (classes, grades) overflow-scroll without sticky headers.
- **Accessibility**: aria-current nav, breadcrumbs, labeled CGPA inputs, focus rings. **P2**: most auth/verify/upload inputs are placeholder-only (no `<label>`); lecturer QuestionForm number input unlabeled; color-only status cues in places.
- **Loading/error**: per-component try/catch with message text — consistent but primitive (no retry, no skeletons). **P3**.
- **Deep links**: course/material/assessment ids are cuid — shareable; no auth-gated redirect (logged-out users see error text, not a login redirect — **P3**).

---

## B. Backend audit

| Area | Verdict |
| :--- | :--- |
| Authentication | **P0**: `x-user-id` header = self-asserted identity; user ids enumerable via open `GET /demo/users`; passwordless demo login = instant impersonation. scrypt hashing + timing-safe compare are sound. Better Auth tables exist but `auth.ts` is never mounted (dead code). |
| Sessions | None (stateless header). No expiry, rotation, or revocation. |
| Role isolation | Route-level checks consistently return 403 for wrong roles (verified by probe). **P1** missing: object-level ownership (lecturer↔course, student↔own-records mostly OK except Q&A resolve open to any signed-in user). |
| Verification | Request/decide/audit flows work. **P2**: no evidence artifacts; blind approvals; student profile accepts empty faculty/dept/level. |
| Hierarchy | CRUD works; unique constraints enforced. **P2**: no edit/delete endpoints; department delete cascades untested. |
| Enrollment | Request/approve/reject/remove + audit ✓. **P2**: no department-match check; lecturers approve cross-department. |
| Material lifecycle | draft→pendingReview→published/archived enforced with audit + price bounds ✓. **P1**: `pendingLecturer` state and Updated/Reviewed transitions unreachable; no metadata edit; no version bump path; `MaterialVersion.pageCount` always mock 10. **P0 vs PRD**: no file bytes anywhere (all `fileKey: dev/mock.pdf` or seed). |
| Protected reader | Entitlement (enrollment + purchase) enforced ✓; per-page study events ✓. **P1**: expiry ignored; no R2 presigned URLs; watermark is CSS overlay text (trivially bypassed — acceptable only as deterrent, documented). |
| Library/entitlements | Purchases + free materials resolve ✓. **P1**: bundle purchase endpoint missing (comment promises it); bundle items grant nothing. |
| Assessments/grading | Start/attempt-cap/submit/auto-grade/manual-grade/notifications/points-hook all verified ✓. **P2**: time limits, due dates unenforced; no question edit/delete; attempt detail lacks student names in lecturer view. |
| Points | Award/caps/balance/redemption guards verified ✓. **P3**: tiers are static labels; no admin policy UI (values hardcoded). Redemption success path untestable below 5000 pts (by design). |
| eSpees/settlement | pending→available→settled verified with holds, audit, notifications ✓. **P2**: no bank-transfer integration (manual `dev-cash` refs); no per-lecturer payout history view for lecturers beyond entries list. |
| Payments | **Mock only** (no Paystack keys, no webhooks). Idempotency via existing-purchase check (not idempotency keys); TOCTOU double-purchase race possible (**P2**, low exploitability locally). No refunds path. |
| Reviews/disputes | Eligibility-gated reviews, replies, reports→disputes→resolve+audit ✓. **P2**: no appeal flow; lecturer cannot feature/flag reviews. |
| AI | Entitlement-scoped FTS + citations + refusal verified; auto-index on publish ✓. **P2**: extractive only (no LLM); chunks built from metadata (no PDF text); empty-gibberish queries return 200 with refusal (correct). No per-student token budget. |
| Devotional | Lagos-day boundary, archive, admin upsert ✓. Content is placeholder (license pending — product/legal, not code). |
| Notifications/email | In-app fan-out works; outbox log works. **P2**: no read-state endpoint; no preferences; no real sender. |
| CGPA | Math verified (4.13=33/8); validation + ownership ✓. Private to student ✓. **P3**: no edit, no target planner. |
| Audit logging | Present on verification/enrollment/material/review/dispute/settlement/signup/onboarding. **P1**: missing on money movement (purchase created, points redemption, pass awards). |
| Health/errors/rate-limits | `/health` OK. **P1**: 500s leak Prisma internals to clients; zero rate limiting (login/signup/AI especially); no helmet/security headers; CORS allowlist excludes tunnels/:8080/file origins (portal over tunnel may fail API calls without ?api override — mitigated, not fixed). |
| DB constraints | Unique keys, FKs, enums solid. **P2**: `Notification.userId`, `EmailLog.toUserId`, `AuditLog.actorId` are bare strings (orphan rows possible); `MaterialFile` model absent (pages are mock); no partial indexes for hot queries (study events, chunks FTS unindexed beyond default). |
| Webhooks | None exist (nothing to be idempotent yet) — required with Paystack. |

---

## C. Risk register (security-first)

1. **P0 — Authentication is spoofable.** `x-user-id` + enumerable ids + passwordless demo login. Anyone on the LAN/tunnel can become anyone. Gate demo routes behind `DEV=true` or remove before any shared use.
2. **P0 — No file pipeline.** Materials have no bytes; "protected ecosystem" is currently policy text + CSS. R2 upload/render/presigned flow is the single biggest build item left.
3. **P1 — Secret in repo.** Production DB password lives in `infra/ecosystem.config.js` (committed). Move to machine env / PM2 env file excluded from git.
4. **P1 — Money without audit.** Purchases, redemptions, pass-awards write ledgers but no `AuditLog` rows. Reconciliation depends on admin memory.
5. **P1 — Entitlement holes.** Expired purchases still read; bundles can't be bought; any lecturer touches any course.
6. **P1 — Shared-network exposure.** No rate limits, verbose errors, narrow CORS, demo login — the tunnel links already handed out amplify all of the above.
7. **P2 — Data integrity.** Blind verification approvals (no evidence), unenforced assessment windows, client-reported dwell, string FKs.

## D. Verdict

**Not production-ready — do not deploy.** Correct posture is exactly the standing rule 023: local-first demo/MVP with all PRD chapters functionally walking, every trust boundary that involves real money, real files, or real strangers still mocked or open. The 10 highest-priority actions and file pointers are in `Docs/API_GAPS.md` §G.
