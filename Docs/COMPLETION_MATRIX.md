# EDUFARM — Completion Matrix (PRD §1–21 vs implementation)

**Legend:** DONE = live + verified · MOCK = walks with stubbed externals · PARTIAL = works with known holes · MISSING = absent · DOC = documentation-only.

| PRD ref | Feature | Status | Notes |
| :--- | :--- | :--- | :--- |
| §5 hierarchy | University→…→Student CRUD | DONE | No edit/delete; first-chain UI traversal bug |
| §5.1 student verification | Request/decide/audit | PARTIAL | No evidence upload; empty dept fields accepted |
| §5.1 lecturer verification | Request/decide/audit | PARTIAL | Same; institution-confirm step is manual |
| §5.1 separate environments | 3 apps + role gates | DONE | Spoofable header (auth P0) |
| §6.1 student home | 8-block home | DONE | Devotional real; AI teaser wired in course page |
| §6.2 academic profile | Enrollments/progress/library/points | DONE | Distributed across pages, no single profile page (P3) |
| §6.3 library | Purchases + free + expiry display | PARTIAL | Expiry displayed, not enforced; bundles absent |
| §7.1 lecturer dashboard | Courses/earnings/basic stats | PARTIAL | No engagement analytics (counts only) |
| §7.2 course control | Enroll/access/announce/Q&A/tests/materials | DONE | No ownership scoping; no material edit |
| §8 lifecycle | Draft→…→Published→Archived | PARTIAL | pendingLecturer/Reviewed unreachable; versions frozen |
| §8.2 free vs paid | Split + bounds enforced | DONE | Bounds hardcoded (final values open per §21) |
| §8.3 bundles | Create + list | PARTIAL | Purchase/grant missing |
| §8.5 protected access | Entitlement-gated reader | MOCK | No bytes, no R2, CSS watermark, expiry ignored |
| §9.1 announcements | 6 categories + urgent + fan-out | DONE | No edit/delete |
| §9.2 Q&A | Ask/answer/resolve/search | DONE | Resolve open to any signed-in user |
| §10 study journey | Events/progress/continue | DONE | Dwell is client-reported; totals use mock pageCount |
| §10.1 assessments | Builder/attempts/auto+manual grade | PARTIAL | No time/due enforcement; MCQ-only builder UI |
| §11 AI assistant | Grounded ask + citations + refusal | MOCK | Extractive FTS, no LLM; no per-material UI scope |
| §11.3 lecturer insights | Stats/unanswered/weak/suggestions | DONE | Heuristic (no LLM clustering) |
| §12 points | Award/caps/balance/redemption | DONE | Redemption success untested <5000 (by design); tiers static |
| §13 payments/eSpees | Mock checkout + settlement | MOCK | No Paystack; manual payout refs |
| §14 devotional | Daily + archive + reflection | DONE | Placeholder text (license pending) |
| §15 reviews/trust | Eligibility-gated + replies + badges | PARTIAL | No appeal; badges are static labels |
| §16 governance | Roles + disputes + audit | PARTIAL | No appeal UI; audit missing on money moves |
| §17 notifications/email | In-app fan-out + outbox log | MOCK | No read-state, prefs, or real sender |
| §18 guardrails | Rules table | DOC | Enforced in code where marked above |
| §19 success measures | Events emitted | PARTIAL | Events logged (study_events, ledgers); no dashboards |
| §20 phasing | P0–P4 + portal alignment | DONE | All phases have live slices |
| §21 open decisions | 8 deferred items | DOC | Untouched — still open |
| Amend. A1 CGPA | Calculator + docs | DONE | Verified math; private; no planner |
| Auth hardening | Better Auth sessions + 2FA | MISSING | Step 2 planned; tables exist, unmounted |
| Tests/CI | Automated suite | MISSING | Zero tests; no CI workflow |
| Ops | Backups/PM2 boot/Caddy/TLS | PARTIAL | PM2 save done; startup/backups/Caddy pending |

**Count:** DONE 14 · PARTIAL 10 · MOCK 5 · MISSING 2 · DOC 3.
