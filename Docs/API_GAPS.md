# EDUFARM — API Gaps (endpoint-level)

Conventions observed: REST `/api/v1`, `x-user-id` dev auth, JSON errors `{error}`, no versioning beyond v1, no pagination cursors (take-limits), no idempotency keys.

## A. Missing endpoints (PRD-promised, absent)

| Need | Proposed route | Priority |
| :--- | :--- | :--- |
| Bundle purchase + grant all items | `POST /bundles/:id/checkout` | P1 |
| Material metadata edit + new version upload | `PATCH /materials/:id`, `POST /materials/:id/versions` | P1 |
| Real file upload (presigned) + page render callback | `POST /materials/:id/upload-url`, `POST /materials/:id/pages` (internal) | P0 |
| Mark notification read | `PATCH /notifications/:id/read`, `POST /notifications/read-all` | P3 |
| Notification preferences | `GET/PUT /notifications/preferences` | P3 |
| Appeal a dispute resolution | `POST /disputes/:id/appeal` | P2 |
| Lecturer-scoped course list (no first-chain hack) | `GET /lecturer/courses` (from LecturerProfile.department) | P1 |
| Student-scoped course list | `GET /student/courses` (from enrollments) | P1 |
| Per-lecturer settlement history (own) | exists via `/earnings/me` ✓ (add payout refs) | P3 |
| Points policy admin (thresholds/ratios) | `GET/PUT /admin/points-policy` (+ DB table) | P3 |
| Hierarchy edit/delete | `PATCH/DELETE /universities|faculties|departments|levels|courses/:id` | P2 |
| Announcement edit/delete | `PATCH/DELETE /announcements/:id` | P3 |
| Q&A edit/delete + lecturer-only resolve | tighten `POST /questions/:id/resolve` | P2 |
| Assessment question edit/delete, close/reopen | `PATCH/DELETE /assessments/:id/questions/:qid`, `POST /assessments/:id/reopen` | P2 |
| Theory question builder support (API exists, UI missing) | UI only | P2 |
| CGPA course edit + target planner | `PATCH /grades/courses/:id`, planner endpoint | P3 |
| Better Auth mount + session/me + 2FA verify | `ALL /api/auth/*` via `auth.handler`, `GET /auth/session` | P0 |
| Health detail (db latency, disk) | extend `GET /health` | P3 |

## B. Present-but-wrong endpoints (behavior fixes, no new routes)

| Route | Problem | Fix | Priority |
| :--- | :--- | :--- | :--- |
| `GET /demo/users`, `POST /demo/login` | Open user enumeration + passwordless impersonation | Gate behind `DEV_ALLOW_DEMO` env (default off); or delete | P0 |
| `GET /materials/:id/pages/:n/url` | Ignores `accessExpiresAt`; serves mock URL | Enforce expiry → 402; return R2 presigned URL | P1 |
| `POST /materials/:id/checkout` | No audit row; TOCTOU double-create race | Add AuditLog; unique partial index `(studentId, materialId) WHERE status='completed'` | P1 |
| `POST /materials/:id/submit|archive`, `POST /enrollments/:id/decide`, `GET /courses/:id/insights`, `GET /courses/:id/enrollments` | Any lecturer acts on any course | Check `LecturerProfile` ↔ course department (or course-lecturer link table) | P1 |
| `POST /questions/:id/resolve` | Any signed-in user resolves | Restrict to author + course lecturer | P2 |
| `POST /assessments/:id/start` | Ignores `dueAt`, `timeLimitMin` | Enforce windows; store `expiresAt` on attempt | P2 |
| `POST /attempts/:id/submit` | Accepts late/over-limit submissions | Check attempt window server-side | P2 |
| `POST /auth/signup` | Accepts `""` faculty/department/level; no evidence | Require real ids; add evidence-key field (R2) | P2 |
| `POST /verifications/*` | Approves blind (no evidence to inspect) | Attach evidence from signup; show in queue | P2 |
| `POST /ai/ask` | No rate limit, no token budget | Per-student daily cap + audit | P2 |
| `POST /auth/login`, `/auth/signup` | No rate limit | Add `@fastify/rate-limit` (strict on auth) | P1 |
| All 500 paths | Prisma internals leak to clients | Central error handler → generic 500 + error id | P1 |
| `GET /courses/:id` | Fine (published-only materials) | None — confirmed correct | — |
| `GET /courses/:id/assessments` | Keys correctly stripped | None — confirmed correct | — |

## C. Cross-cutting middleware to add (`apps/api/src/`)

1. `auth-required` (Better Auth session → `req.authUser`), replacing `auth-dev.ts` per-route lookups.
2. `requireRole(...)` + `requireCourseAccess(courseId, {lecturerOwns})` (ownership via department match).
3. Central error handler (sanitized 500s with ids).
4. `@fastify/rate-limit` (global lenient + strict `/auth/*`, `/ai/*`).
5. `@fastify/helmet` (security headers; frame-ancestors for reader anti-embed).
6. Request-id + audit helper (`audit(actor, action, target, meta)` used by money routes).
7. Pagination helper (cursor on study_events, notifications, outbox).
8. `GET /health` detail: db ping ms, uptime, version/commit hash.

## D. Database follow-ups (no data loss; additive migrations)

- Add `passwordHash` — done (`password-hash` migration).
- `AuditLog` rows for purchase/redemption/pass-award/settlement-pay.
- Partial unique index on completed purchases (race-proof idempotency).
- FKs for `Notification.userId`, `EmailLog.toUserId`, `AuditLog.actorId` (or document why strings).
- `MaterialFile` real model (page objects) when R2 lands; drop mock `pageCount: 10` math.
- Indexes: `StudyEvent(studentId, createdAt)`, `MaterialChunk` GIN tsvector (or pgvector later), `PointLedger(studentId)`, `ESpeesLedger(status, createdAt)`.
- `PointsPolicy` + `PricingRules` tables instead of hardcoded constants.

## E. Test plan (zero tests today — highest leverage first)

1. Auth: spoofed header rejected; demo gated; login lockout; role matrix (student×lecturer×admin × 10 sensitive routes).
2. Money: double-purchase race; redemption caps; expiry enforcement; settlement state machine invalid transitions.
3. Lifecycle: illegal transitions (publish→draft skip), version immutability after purchase.
4. Entitlements: unenrolled/expired/unpurchased → 402/403 on every page index; answer-key absence in all student payloads.
5. Assessments: max-attempts, late submit, regrade idempotency, pass-point once-only.
6. AI: unentitled course → 403; gibberish → refusal contract; lecturer-only insights.
7. E2E (Playwright): signup→approve→enroll→buy→read→quiz→points→review→dispute→settle.

## F. First files to change (in order)

1. `apps/api/src/main.ts` — mount Better Auth handler, helmet, rate-limit, error handler, request-id.
2. `apps/api/src/auth-dev.ts` → replace with session middleware (`apps/api/src/authz.ts`: session + role + ownership helpers).
3. `apps/api/src/routes/purchases.ts` — expiry + audit + idempotency guard (+ bundle checkout).
4. `apps/api/src/routes/materials.ts` — ownership + R2 upload-url + versioning + expiry check.
5. `infra/ecosystem.config.js` — move `DATABASE_URL` to untracked env file.
6. `apps/web-student/app/courses/page.tsx`, `apps/web-lecturer/app/page.tsx` — profile/department-scoped lists.
7. `apps/api/src/routes/assessments.ts` — window enforcement + lecturer attempt names.
8. New: `apps/api/src/routes/uploads.ts`, `prisma` policy tables, `web/tests/` + CI workflow.
