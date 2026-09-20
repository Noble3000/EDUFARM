# EDUFARM — Verified Lecturer–Student Learning Ecosystem

> **A trusted academic ecosystem — not a PDF marketplace.**
>
> **Core principle:** *The Word is at the center of the student experience. The academic ecosystem around it connects verified universities, departments, lecturers, students, trusted materials, communication, study progress, AI learning support, rewards, and transparent lecturer earnings.*

EDUFARM connects **universities → faculties → departments → levels → courses → lecturers → students** around legitimate, lecturer-owned academic content and meaningful learning activity. It replaces fragmented material distribution (class reps, informal groups, unverified PDFs, overpriced tutorial packs) with an organized, verified, affordable ecosystem.

**Product status:** Concept / Product definition approved for PRD. See [`Docs/PRD EDUFARM.md`](Docs/PRD%20EDUFARM.md) for the full specification.

---

## Table of Contents

- [Why EDUFARM? Problem Statement](#why-edufarm-problem-statement)
- [Vision and Principles](#vision-and-principles)
- [Who It's For](#who-its-for)
- [How It Works](#how-it-works)
- [Features](#features)
  - [Student Experience](#student-experience)
  - [Lecturer Experience](#lecturer-experience)
  - [Academic Content Lifecycle](#academic-content-lifecycle)
  - [Communication and Engagement](#communication-and-engagement)
  - [Study Journey and Assessments](#study-journey-and-assessments)
  - [AI Learning Experience](#ai-learning-experience)
  - [Points, Payments and Earnings](#points-payments-and-earnings)
  - [Devotional Experience](#devotional-experience)
  - [Trust, Reviews and Integrity](#trust-reviews-and-integrity)
  - [Governance and Notifications](#governance-and-notifications)
- [Product Rules and Guardrails](#product-rules-and-guardrails)
- [Roadmap / MVP Phasing](#roadmap--mvp-phasing)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Open Decisions](#open-decisions)

---

## Why EDUFARM? Problem Statement

1. Students depend on class reps, informal groups, and unverified sources for notes and updates.
2. Unofficial or altered PDFs circulate with no way to verify genuineness or currency.
3. Students overpay for notes, tutorials, and study packs that can't be validated.
4. Lecturers have no visibility into material usage, student perception, or struggle areas.
5. Students lack a unified record of study activity, purchases, interactions, and milestones.
6. Generic AI tools don't distinguish lecturer-approved material from general information.
7. Announcements, tests, assignments, materials, and Q&A are scattered across channels.
8. No controlled system exists to reward sustained study behaviour.

EDUFARM solves this with verified identity, official materials, structured communication, study tracking, course-grounded AI, and a fair reward economy.

---

## Vision and Principles

**Vision:** Create a trusted ecosystem where students study from legitimate lecturer resources, stay connected to courses, track their journey, and get learning support — while lecturers get a structured environment to teach, engage, measure impact, and earn transparently.

**Principles:**

- **Academic authority first:** lecturer owns course content; institution establishes affiliation.
- **Trusted by design:** verified lecturers, official courses, and official materials are clearly visible.
- **Academic value over document volume:** success = useful learning activity, not PDF sales.
- **Affordable access:** paid resources stay within platform-approved, student-friendly boundaries.
- **The Word at the center:** same authorized daily devotional for every student.
- **AI as assistant, not lecturer:** AI supports learning; lecturer remains the authority.
- **Long-term continuity:** legitimate access and study history support future reference where allowed.
- **No uncontrolled private classroom:** communication via official announcements + course Q&A only.

---

## Who It's For

| Role | Responsibilities / Needs |
| :--- | :--- |
| **Student** | Join verified institution, access approved courses, study materials, take tests/assignments, ask questions, earn points, use AI, track progress. |
| **Lecturer** | Manage courses, upload/approve resources, publish announcements, answer Q&A, create assessments, review engagement, receive feedback, earn from eligible materials. |
| **Department / Institution admin** | Verify lecturers and students, manage academic structures, exercise institutional oversight. |
| **Platform admin** | Protect ecosystem integrity, review content, manage disputes, oversee financial/reward rules, enforce policies. |

---

## How It Works

**Academic hierarchy (consistent everywhere):**

```text
University → Faculty → Department → Level → Course → Lecturer → Student
```

**Access model:**

- Students are verified as institution members before broader access.
- Verification ≠ automatic course access — lecturers control access to their own courses.
- Lecturers are verified via institutional/departmental confirmation + platform verification.
- Lecturers use a dedicated lecturer environment (not a student account).
- Students only see courses, resources, announcements, and Q&A authorized for them.

---

## Features

### Student Experience

**Home screen (academic activity first, Word at center):**

1. Today's Word / devotional — same official content for every student.
2. Academic priorities — tests, assignments, deadlines, urgent announcements, new materials.
3. Continue studying — resume current material/activity.
4. My Courses — current courses with study progress.
5. Lecturer updates — recent official announcements.
6. Course Q&A — unanswered questions + recent lecturer responses.
7. Academic points — balance + long-term reward progress.
8. AI Study Assistant — course-grounded help.

**Academic profile:** verified institution/faculty/department/level, current + completed courses, study progress, purchased materials + access status, points + reward level, lecturer recognitions, historical journey across levels.

**Personal Academic Library (not a file store — in-ecosystem access only):**

- Purchased materials, free official materials, lecturer-created bundles.
- Previously authorized editions where access policy permits.
- Clear access status + duration before and after purchase.

### Lecturer Experience

**Dashboard:**

- Courses + enrolled students.
- Published / draft / reviewed materials.
- Material access, completion, and review signals.
- Announcements + Q&A management.
- Test / assignment activity.
- Student engagement and participation.
- Activity / contribution indicators.
- Earnings: pending balance, available balance, settlement history, next settlement period.
- AI-generated insights: trends + areas needing attention.

**Course control:**

- Approve/manage student access.
- Publish official announcements.
- Create/manage Q&A.
- Create tests, quizzes, assignments.
- Upload, price, classify eligible resources.
- Set access duration within platform rules.
- Review student feedback.

### Academic Content Lifecycle

**Supported types:** lecture notes and course packs, revision guides, practice question collections, exam prep, lecturer-created guides/summaries, other institutionally appropriate resources.

**Free vs paid:**

| Free / essential | Paid / optional value-added |
| :--- | :--- |
| Course outline | Detailed lecture notes |
| Announcements | Comprehensive revision packs |
| Assignment instructions | Practice question collections |
| Examination info | Advanced study guides |
| Essential guidance | Additional lecturer-created resources |

**Pricing:** Lecturers price eligible paid materials within platform-approved boundaries. Lecturer-created bundles supported. Essential info stays free.

**Lifecycle:**

```text
Draft → Lecturer approval → Platform review → Published → Reviewed / Updated → Archived
```

- Lecturer confirms ownership/authorization before submission.
- Platform reviews against publishing rules before it becomes official.
- Official vs informational content is clearly distinguished.
- Materials are versioned, never silently replaced.
- Price + access terms visible before payment; purchase never changes arrangement unexpectedly.

**Access rules:**

- All materials accessible only inside the ecosystem.
- No unrestricted download, offline, screenshot/capture tools, or export for protected materials. In-app copy/capture restricted where applicable (external-device capture cannot be guaranteed).
- Access duration is lecturer-defined within platform rules, shown before purchase.
- Permanent/long-term access may be offered for future reference.
- Protected resources carry ownership / official-content indicators.

### Communication and Engagement

**Official announcements** (retained in course, categorized): new material, assignment, test/examination, course notice, general academic update, urgent update.

**Course Q&A:**

- Students ask in course space; lecturers answer for whole class benefit.
- Lecturer responses clearly distinguished.
- Unanswered → answered/resolved workflow.
- Searchable historical Q&A as knowledge base.
- No unrestricted 1-to-1 student/lecturer chat in scope.

### Study Journey and Assessments

Long-term academic record showing progression, not just document opens:

- Courses taken/completed, meaningful material progress/completion.
- Tests/quizzes/assignments completed.
- Milestones, study streaks, Q&A participation, lecturer recognitions.
- Points earned over time, library retained per access terms.

**Assessments:** Lecturers create tests/quizzes/assignments. Objective parts auto-graded; subjective parts lecturer-reviewed. Completion feeds study journey + points.

### AI Learning Experience

Grounded first in the student's authorized environment.

**Source hierarchy:**

1. Primary: authorized lecturer/course materials the student can access.
2. Secondary: broader academic knowledge, clearly labeled as additional context.
3. AI must never present general output as lecturer's official position.

**Student capabilities:** explain concepts simply, summarize authorized materials, compare concepts across resources, Ask This Material, generate study questions/practice, quiz/revision sessions, exam prep + study planning.

**Lecturer insights:** engagement changes, frequently asked/unresolved topics, strong/weak completion signals, activity summaries, difficulty hotspots, suggestions to publish clarifications.

### Points, Payments and Earnings

**Three-value model:**

| Type | Purpose | Cash-out |
| :--- | :--- | :--- |
| **Naira** | Student payments for eligible purchases | Actual payment value |
| **eSpees** | Internal settlement/accounting for lecturer earnings | Lecturer settlement per platform rules/periods |
| **Academic Points** | Non-cash reward for meaningful study | No withdrawal; cannot become earnings/eSpees |

**Purchase flow:**

1. Student views material, price, access terms.
2. Completes approved payment flow.
3. Purchase recorded in academic library.
4. Lecturer earnings enter pending state.
5. Lecturer share vs platform allocation recorded transparently.

**Lecturer earnings dashboard:** material-level sales, lecturer vs platform split, pending/available/settlement history, next settlement period.

**Academic Points:**

- Awarded for defined, measurable milestones + limited lecturer recognition (genuine participation, strong answers, improvement). Not for merely opening or buying.
- Caps + anti-abuse rules. Slow to accumulate by design.
- Gradable thresholds: early → intermediate → advanced → long-term milestones. Small amounts accumulate slowly; meaningful benefits require sustained activity.
- Redeemable for eligible purchases only. Never cash, never lecturer earnings.

### Devotional Experience

- Same daily Word for every student, on home screen without displacing urgent academics.
- Official source used only via authorized arrangement.
- Separate, clearly labeled academic reflection (discipline, excellence, integrity, consistency).
- Archive of previous devotionals subject to content rights.

### Trust, Reviews and Integrity

**Material reviews:** students with meaningful access can rate + write feedback; lecturers can respond; students can report problems/violations. Reports enter defined review, not auto-removal.

**Trust indicators:** Verified Institution, Verified Lecturer, Official Course, Officially Published Material, edition/version info, clear purchase terms.

**Integrity:** prohibits redistribution, impersonation, fraudulent identity, reward abuse, misuse of lecturer resources. Understandable reporting/escalation process.

### Governance and Notifications

**Authority levels:**

| Level | Authority |
| :--- | :--- |
| Platform admin | Integrity, content review, disputes, financial/reward policy |
| Institution/department | Affiliation, verification, structure, oversight |
| Lecturer | Course ownership, access, content, announcements, Q&A, assessments, recognition |
| Student | Study, participate, purchase, ask, review, follow policies |

**Disputes:** report → notify responsible party → review at appropriate level → recorded resolution → appeal path where appropriate.

**Notifications (in-app primary, email for meaningful events):** new announcement, new/purchased material, payment confirmation/receipt, test/exam update, deadline reminder, access approval/change, material revision, important account notice.

---

## Product Rules and Guardrails

| Rule | Expectation |
| :--- | :--- |
| Protected ecosystem | Materials stay inside ecosystem |
| No unrestricted distribution | No normal download/offline/screenshot/export for protected materials |
| Verified identity | Students + lecturers meet verification rules |
| Lecturer course authority | Lecturers control individual course access |
| Lecturer ownership | Explicit authorization for uploads |
| Platform review | Review before publishing |
| Transparent pricing | Price + terms before purchase |
| No cash-out points | Points ≠ money |
| Slow points economy | Sustained activity + caps required |
| No private chat | Announcements + Q&A only |
| AI source clarity | Grounded vs general clearly separated |
| Fair disputes | Defined review, not arbitrary removal |

---

## Roadmap / MVP Phasing

Manageable stages, protecting core value — not launching everything at once.

**Phase 1 — Trusted academic foundation**

- Institution/department/course/lecturer/student structure + verification.
- Lecturer course spaces + student access control.
- Announcements + Q&A.
- Upload → approval → review → protected in-ecosystem access.
- Individual + bundle purchases.
- Basic library + study progress.

**Phase 2 — Engagement and academic economy**

- Tests, quizzes, assignments.
- Academic Points + controlled lecturer recognition.
- Earnings dashboard + scheduled settlement.
- Reviews + structured reporting.
- Expanded notifications + email.

**Phase 3 — AI and advanced insights**

- Course-grounded assistant, Ask This Material.
- Study/quiz/revision/research modes.
- Lecturer AI insights + engagement summaries.
- Deeper Study Journey analytics.

**Phase 4 — Shared Word experience + expansion**

- Authorized daily devotional, Word-centered home.
- Separated academic reflection layer.
- Cross-institution expansion.

---

## Repository Structure

```text
EDUFARM/
├── README.md              # This file — product overview
└── Docs/
    └── PRD EDUFARM.md     # Full Product Requirements Document (source of truth)
```

No application code yet — repo is currently PRD + documentation stage.

---

## Getting Started

This is a product-definition stage repo. To work with it:

1. Clone:
   ```bash
   git clone https://github.com/Noble3000/EDUFARM.git
   cd EDUFARM
   ```
2. Read the PRD: `Docs/PRD EDUFARM.md`
3. Propose changes via issues / pull requests (lecturer-led, verified-trust principles apply to contributions too).

Future code (app, API, AI services) will be added under Phase 1 scoping.

---

## Open Decisions

Deferred to avoid blocking PRD (to finalize later):

- Exact price ranges + platform revenue allocation.
- eSpees conversion + settlement rules.
- Points thresholds + redemption ratios (after economic modelling).
- Access-duration categories.
- Institution onboarding/approval workflow details.
- Devotional integration + content rights.
- Assessment/grading policies per course type.
- Dispute/appeal SLAs.

---

**Summary:** EDUFARM is a verified, lecturer-led ecosystem organized around departments and courses. Students get a shared daily Word + personalized academic journey. Lecturers get controlled publishing, engagement, analytics, and transparent earnings. Protected in-platform access, affordable resources, controlled points, eSpees settlement, course-grounded AI, and structured Q&A create coherence from learning to long-term reference.
