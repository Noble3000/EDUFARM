// Assessments as a full academic workflow (§10.1).
// Lecturer: create (test|quiz|assignment + instructions + marks + timing) →
//   add/edit/remove questions (draft only — published items are immutable) →
//   publish / close / reopen → submissions with student names → grade theory
//   with feedback → release grades (scores/feedback hidden until released).
// Student: see published → start (due + max-attempt windows enforced) →
//   resume in-progress where policy allows → submit once (atomic) → see
//   results + feedback only after release.
// Auto-grade: deterministic, server-side, MCQ-only, question-level marks.
// Anti-cheat: no answer keys leave the server; scores recomputed, never trusted
// from clients; concurrent submits/grades serialize in transactions.

import type { FastifyInstance, FastifyReply } from "fastify";
import { prisma } from "../db.js";
import { audit, ownsCourse, sessionUser as currentUser } from "../authz.js";
import { awardPassPoints } from "./points.js";

const ASSESSMENT_TYPES = ["quiz", "test", "assignment"] as const;

function stripKeys(a: Record<string, unknown>) {
  const { questions, ...rest } = a as { questions: { correctIndex?: number }[] };
  return {
    ...rest,
    questions: (questions ?? []).map((q) => {
      const { correctIndex: _drop, ...safe } = q;
      return safe;
    }),
  };
}

// Scores/feedback leave the server only after release.
function maskUngraded<T extends { score: number | null; feedback?: string | null }>(attempt: T, released: boolean): T {
  if (released) return attempt;
  return { ...attempt, score: null, feedback: null };
}

async function enrolledApproved(courseId: string, studentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  return e?.status === "approved";
}

async function mustOwnCourse(courseId: string, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, reply: FastifyReply) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    reply.code(404).send({ error: "not-found:course" });
    return null;
  }
  if (!(await ownsCourse(user, course))) {
    reply.code(403).send({ error: "forbidden:course-ownership" });
    return null;
  }
  return course;
}

async function mustOwnAssessment(assessmentId: string, user: NonNullable<Awaited<ReturnType<typeof currentUser>>>, reply: FastifyReply) {
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId }, include: { course: true },
  });
  if (!a) {
    reply.code(404).send({ error: "not-found:assessment" });
    return null;
  }
  if (!(await ownsCourse(user, a.course))) {
    reply.code(403).send({ error: "forbidden:course-ownership" });
    return null;
  }
  return a;
}

export async function assessmentRoutes(app: FastifyInstance) {
  // lecturer creates assessment (draft, in own course)
  app.post("/courses/:id/assessments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const course = await mustOwnCourse(id, user, reply);
    if (!course) return;
    const b = req.body as {
      title: string; type?: string; instructions?: string; timeLimitMin?: number; maxAttempts?: number; dueAt?: string;
    };
    if (!b.title) return reply.code(400).send({ error: "auth-invalid: title required." });
    if (b.type && !ASSESSMENT_TYPES.includes(b.type as never))
      return reply.code(400).send({ error: `auth-invalid: type must be ${ASSESSMENT_TYPES.join("|")}.` });
    if (b.timeLimitMin != null && (!Number.isInteger(b.timeLimitMin) || b.timeLimitMin < 1 || b.timeLimitMin > 600))
      return reply.code(400).send({ error: "auth-invalid: timeLimitMin must be 1–600." });
    if (b.maxAttempts != null && (!Number.isInteger(b.maxAttempts) || b.maxAttempts < 1 || b.maxAttempts > 10))
      return reply.code(400).send({ error: "auth-invalid: maxAttempts must be 1–10." });
    let dueAt: Date | null = null;
    if (b.dueAt) {
      dueAt = new Date(b.dueAt);
      if (Number.isNaN(dueAt.getTime())) return reply.code(400).send({ error: "auth-invalid: bad dueAt." });
    }
    const created = await prisma.assessment.create({
      data: {
        courseId: id, title: b.title, type: b.type ?? "quiz", instructions: b.instructions,
        timeLimitMin: b.timeLimitMin ?? null, maxAttempts: b.maxAttempts ?? 1,
        dueAt, status: "draft",
      },
    });
    await audit(user.id, "assessment.created", "Assessment", created.id, `${id} [${created.type}]`);
    return created;
  });

  // lecturer adds question (draft only — published items are immutable)
  app.post("/assessments/:id/questions", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const assessment = await mustOwnAssessment(id, user, reply);
    if (!assessment) return;
    if (assessment.status !== "draft")
      return reply.code(400).send({ error: "auth-invalid: questions lock on publish — unpublish to draft first." });
    const b = req.body as {
      text: string; kind?: string; options?: string[]; correctIndex?: number; marks?: number;
    };
    if (!b.text) return reply.code(400).send({ error: "auth-invalid: text required." });
    const kind = b.kind ?? "mcq";
    if (!["mcq", "theory"].includes(kind)) return reply.code(400).send({ error: "auth-invalid: kind must be mcq|theory." });
    if (kind === "mcq" && (!b.options?.length || b.correctIndex == null || b.correctIndex < 0 || b.correctIndex >= b.options.length))
      return reply.code(400).send({ error: "auth-invalid: mcq needs options + valid correctIndex." });
    if (b.marks != null && (!Number.isInteger(b.marks) || b.marks < 1 || b.marks > 100))
      return reply.code(400).send({ error: "auth-invalid: marks must be 1–100." });
    const count = await prisma.assessmentQuestion.count({ where: { assessmentId: id } });
    const q = await prisma.assessmentQuestion.create({
      data: {
        assessmentId: id, text: b.text, kind, options: kind === "mcq" ? b.options! : [],
        correctIndex: kind === "mcq" ? b.correctIndex : null, marks: b.marks ?? 1, order: count,
      },
    });
    await audit(user.id, "assessment.question.added", "Assessment", id, `${kind} ${q.marks}mk`);
    return q;
  });

  // lecturer edits a draft question
  app.patch("/assessments/:aid/questions/:qid", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { aid, qid } = req.params as { aid: string; qid: string };
    const assessment = await mustOwnAssessment(aid, user, reply);
    if (!assessment) return;
    if (assessment.status !== "draft")
      return reply.code(400).send({ error: "auth-invalid: published questions are immutable." });
    const b = req.body as { text?: string; marks?: number };
    const data: Record<string, unknown> = {};
    if (b.text !== undefined) {
      if (!b.text) return reply.code(400).send({ error: "auth-invalid: text cannot be empty." });
      data.text = b.text;
    }
    if (b.marks !== undefined) {
      if (!Number.isInteger(b.marks) || b.marks < 1 || b.marks > 100)
        return reply.code(400).send({ error: "auth-invalid: marks must be 1–100." });
      data.marks = b.marks;
    }
    const updated = await prisma.assessmentQuestion.updateMany({ where: { id: qid, assessmentId: aid }, data });
    if (!updated.count) return reply.code(404).send({ error: "not-found:question" });
    await audit(user.id, "assessment.question.edited", "Assessment", aid, qid);
    return prisma.assessmentQuestion.findUnique({ where: { id: qid } });
  });

  // lecturer deletes a draft question
  app.delete("/assessments/:aid/questions/:qid", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { aid, qid } = req.params as { aid: string; qid: string };
    const assessment = await mustOwnAssessment(aid, user, reply);
    if (!assessment) return;
    if (assessment.status !== "draft")
      return reply.code(400).send({ error: "auth-invalid: published questions are immutable." });
    await prisma.assessmentQuestion.deleteMany({ where: { id: qid, assessmentId: aid } });
    await audit(user.id, "assessment.question.deleted", "Assessment", aid, qid);
    return { ok: true };
  });

  // lecturer publishes / closes / reopens (audited, students notified on publish)
  for (const [action, to] of [["publish", "published"], ["close", "closed"], ["reopen", "published"]] as const) {
    app.post(`/assessments/:id/${action}`, async (req, reply) => {
      const user = await currentUser(req);
      if (!user) return reply.code(401).send({ error: "auth-required" });
      const { id } = req.params as { id: string };
      const assessment = await mustOwnAssessment(id, user, reply);
      if (!assessment) return;
      if (action === "publish" && assessment.status !== "draft")
        return reply.code(400).send({ error: `auth-invalid: publish from draft only (now ${assessment.status}).` });
      if (action === "close" && assessment.status !== "published")
        return reply.code(400).send({ error: "auth-invalid: only published assessments close." });
      if (action === "reopen" && assessment.status !== "closed")
        return reply.code(400).send({ error: "auth-invalid: only closed assessments reopen." });
      const updated = await prisma.assessment.update({ where: { id }, data: { status: to } });
      await audit(user.id, `assessment.${action}d`, "Assessment", id);
      if (action === "publish") {
        const enrollments = await prisma.enrollment.findMany({
          where: { courseId: updated.courseId, status: "approved" },
          select: { student: { select: { userId: true } } },
        });
        if (enrollments.length) {
          await prisma.notification.createMany({
            data: enrollments.map((e) => ({
              userId: e.student.userId, type: "assessment",
              title: `New assessment: ${updated.title}`, body: updated.dueAt ? `Due ${updated.dueAt.toISOString()}` : "No due date",
            })),
          });
        }
      }
      return updated;
    });
  }

  // lecturer: list ALL assessments for a course (drafts included, keys visible)
  app.get("/courses/:id/assessments/lecturer", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const course = await mustOwnCourse(id, user, reply);
    if (!course) return;
    return prisma.assessment.findMany({
      where: { courseId: id },
      include: { questions: { orderBy: { order: "asc" } }, _count: { select: { attempts: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // student: list published assessments for a course (keys stripped, scores masked until release)
  app.get("/courses/:id/assessments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    if (!(await enrolledApproved(id, user.studentProfile.id)))
      return reply.code(403).send({ error: "forbidden:course-access" });
    const list = await prisma.assessment.findMany({
      where: { courseId: id, status: "published" },
      include: { questions: { orderBy: { order: "asc" } }, attempts: { where: { studentId: user.studentProfile.id } } },
      orderBy: { createdAt: "desc" },
    });
    return list.map((a) => {
      const stripped = stripKeys(a as unknown as Record<string, unknown>) as typeof a;
      return { ...stripped, attempts: a.attempts.map((t) => maskUngraded(t, a.gradesReleased)) };
    });
  });

  // student: start attempt (due + max-attempt windows enforced; resumes valid in-progress)
  app.post("/assessments/:id/start", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const a = await prisma.assessment.findUnique({ where: { id } });
    if (!a || a.status !== "published") return reply.code(404).send({ error: "not-found:assessment" });
    if (!(await enrolledApproved(a.courseId, user.studentProfile.id)))
      return reply.code(403).send({ error: "forbidden:course-access" });
    if (a.dueAt && a.dueAt.getTime() < Date.now())
      return reply.code(400).send({ error: "auth-invalid: past due — new attempts closed." });
    // resume policy: a live in-progress attempt (inside time limit) resumes instead of forking
    const live = await prisma.assessmentAttempt.findFirst({
      where: { assessmentId: id, studentId: user.studentProfile.id, status: "in-progress" },
      orderBy: { startedAt: "desc" },
    });
    if (live) {
      if (a.timeLimitMin && live.startedAt.getTime() + a.timeLimitMin * 60000 < Date.now()) {
        await prisma.assessmentAttempt.update({ where: { id: live.id }, data: { status: "submitted", submittedAt: new Date() } });
      } else {
        const full = await prisma.assessment.findUnique({
          where: { id }, include: { questions: { orderBy: { order: "asc" } } },
        });
        const existing = await prisma.assessmentAnswer.findMany({ where: { attemptId: live.id } });
        return { attempt: live, resumed: true, answers: existing, assessment: stripKeys(full as unknown as Record<string, unknown>) };
      }
    }
    const used = await prisma.assessmentAttempt.count({ where: { assessmentId: id, studentId: user.studentProfile.id } });
    if (used >= a.maxAttempts) return reply.code(400).send({ error: `auth-invalid: max attempts (${a.maxAttempts}) reached.` });
    const attempt = await prisma.assessmentAttempt.create({
      data: { assessmentId: id, studentId: user.studentProfile.id, attemptNo: used + 1, status: "in-progress" },
    });
    const full = await prisma.assessment.findUnique({
      where: { id }, include: { questions: { orderBy: { order: "asc" } } },
    });
    return { attempt, resumed: false, answers: [], assessment: stripKeys(full as unknown as Record<string, unknown>) };
  });

  // student: submit answers — atomic single-flip; MCQ auto-graded server-side
  app.post("/attempts/:id/submit", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const b = req.body as { answers: { questionId: string; selectedIndex?: number; body?: string }[] };
    type GradedAttempt = {
      id: string; status: string; score: number | null; maxScore: number | null;
      assessmentId: string; feedback: string | null;
    };
    type SubmitOutcome =
      | { err: 404; msg?: string }
      | { err: 400; msg: string }
      | { updated: GradedAttempt; score: number; maxScore: number };
    const result: SubmitOutcome = await prisma.$transaction(async (tx) => {
      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id }, include: { assessment: { include: { questions: true } } },
      });
      if (!attempt || attempt.studentId !== user.studentProfile!.id) return { err: 404 as const };
      if (attempt.status !== "in-progress") return { err: 400 as const, msg: `Already ${attempt.status} — double submit rejected.` };
      if (attempt.assessment.timeLimitMin &&
        attempt.startedAt.getTime() + attempt.assessment.timeLimitMin * 60000 < Date.now()) {
        await tx.assessmentAttempt.update({ where: { id }, data: { status: "submitted", submittedAt: new Date() } });
        return { err: 400 as const, msg: "Time expired — attempt auto-submitted ungraded." };
      }
      let score = 0;
      let maxScore = 0;
      let hasTheory = false;
      for (const q of attempt.assessment.questions) {
        maxScore += q.marks;
        const given = b.answers?.find((x) => x.questionId === q.id);
        if (q.kind === "mcq") {
          const correct = given?.selectedIndex === q.correctIndex;
          if (correct) score += q.marks;
          await tx.assessmentAnswer.upsert({
            where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
            update: { selectedIndex: given?.selectedIndex, isCorrect: correct, marksAwarded: correct ? q.marks : 0 },
            create: {
              attemptId: id, questionId: q.id, selectedIndex: given?.selectedIndex,
              isCorrect: correct, marksAwarded: correct ? q.marks : 0,
            },
          });
        } else {
          hasTheory = true;
          await tx.assessmentAnswer.upsert({
            where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
            update: { body: given?.body },
            create: { attemptId: id, questionId: q.id, body: given?.body },
          });
        }
      }
      const updated = await tx.assessmentAttempt.update({
        where: { id },
        data: hasTheory
          ? { status: "submitted", maxScore, submittedAt: new Date() }
          : { status: "graded", score, maxScore, submittedAt: new Date(), gradedAt: new Date(), gradedBy: "auto-grade" },
        include: { answers: { include: { question: true } } },
      });
      await tx.studyEvent.create({
        data: {
          studentId: user.studentProfile!.id, courseId: attempt.assessment.courseId,
          type: "assessment-submitted", durationSec: 0,
        },
      });
      return { updated, score, maxScore };
    });
    if ("err" in result) return reply.code(result.err ?? 500).send({ error: result.msg ?? "not-found:attempt" });
    if (result.updated!.status === "graded" && result.maxScore! > 0 && result.score! / result.maxScore! >= 0.5) {
      await awardPassPoints(user.studentProfile.id, result.updated!.assessmentId);
    }
    const masked = maskUngraded(
      result.updated!,
      (await prisma.assessment.findUnique({ where: { id: result.updated!.assessmentId } }))?.gradesReleased ?? false,
    );
    return masked;
  });

  // student: one attempt detail (own only; score/feedback gated by release)
  app.get("/attempts/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id },
      include: {
        answers: { include: { question: true } },
        assessment: { select: { id: true, title: true, gradesReleased: true } },
      },
    });
    if (!attempt || attempt.studentId !== user.studentProfile.id)
      return reply.code(404).send({ error: "not-found:attempt" });
    const stripped = {
      ...attempt,
      answers: attempt.answers.map((a) => ({
        ...a,
        question: { ...a.question, correctIndex: undefined },
      })),
    };
    return maskUngraded(stripped, attempt.assessment.gradesReleased);
  });

  // student: my attempts for an assessment (scores masked until release)
  app.get("/assessments/:id/attempts/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const a = await prisma.assessment.findUnique({ where: { id }, select: { gradesReleased: true } });
    const attempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: id, studentId: user.studentProfile.id },
      include: { answers: { include: { question: true } } },
      orderBy: { attemptNo: "desc" },
    });
    return attempts.map((t) => maskUngraded(t, a?.gradesReleased ?? false));
  });

  // lecturer: submissions with student names (own course only)
  app.get("/assessments/:id/attempts", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const assessment = await mustOwnAssessment(id, user, reply);
    if (!assessment) return;
    return prisma.assessmentAttempt.findMany({
      where: { assessmentId: id },
      include: {
        answers: { include: { question: true } },
        student: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });
  });

  // lecturer: grade theory (+ adjust), feedback, audited with grader + time
  app.post("/attempts/:id/grade", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const seed = await prisma.assessmentAttempt.findUnique({
      where: { id }, include: { assessment: { include: { course: true } } },
    });
    if (!seed) return reply.code(404).send({ error: "not-found:attempt" });
    if (!(await ownsCourse(user, seed.assessment.course)))
      return reply.code(403).send({ error: "forbidden:course-ownership" });
    const b = req.body as { marks: { questionId: string; marksAwarded: number }[]; feedback?: string };
    const graded = await prisma.$transaction(async (tx) => {
      for (const m of b.marks ?? []) {
        const q = await tx.assessmentQuestion.findUnique({ where: { id: m.questionId } });
        if (!q || q.assessmentId !== seed.assessmentId) continue;
        const clamped = Math.max(0, Math.min(q.marks, Math.floor(Number(m.marksAwarded) || 0)));
        await tx.assessmentAnswer.updateMany({
          where: { attemptId: id, questionId: m.questionId },
          data: { marksAwarded: clamped, isCorrect: q.kind === "mcq" ? clamped === q.marks : clamped > 0 },
        });
      }
      const attempt = await tx.assessmentAttempt.findUnique({
        where: { id }, include: { answers: true, assessment: { include: { questions: true } } },
      });
      if (!attempt) throw new Error("gone");
      // Recompute from stored answers only — never trust client totals.
      const score = attempt.answers.reduce((s, a) => s + a.marksAwarded, 0);
      const maxScore = attempt.assessment.questions.reduce((s, q) => s + q.marks, 0);
      return tx.assessmentAttempt.update({
        where: { id },
        data: {
          status: "graded", score, maxScore,
          feedback: typeof b.feedback === "string" ? b.feedback.slice(0, 2000) : undefined,
          gradedBy: user.id, gradedAt: new Date(),
        },
      });
    });
    const attemptWithStudent = await prisma.assessmentAttempt.findUnique({
      where: { id }, include: { student: true, assessment: true },
    });
    await audit(user.id, "assessment.graded", "AssessmentAttempt", id, `score=${graded.score}/${graded.maxScore}`);
    await prisma.notification.create({
      data: {
        userId: attemptWithStudent!.student.userId, type: "grade",
        title: `Graded: ${attemptWithStudent!.assessment.title}`,
        body: attemptWithStudent!.assessment.gradesReleased
          ? `Score ${graded.score}/${graded.maxScore}`
          : "Your work has been graded — results appear when your lecturer releases them.",
      },
    });
    if (graded.maxScore! > 0 && graded.score! / graded.maxScore! >= 0.5) {
      await awardPassPoints(attemptWithStudent!.studentId, attemptWithStudent!.assessmentId);
    }
    const { logEmail } = await import("./email.js");
    await logEmail(attemptWithStudent!.student.userId, `Graded: ${attemptWithStudent!.assessment.title}`, "See your results in the app once released.");
    return graded;
  });

  // lecturer: release grades to students (audited, notifies attempted students)
  app.post("/assessments/:id/release", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const assessment = await mustOwnAssessment(id, user, reply);
    if (!assessment) return;
    const updated = await prisma.assessment.update({ where: { id }, data: { gradesReleased: true } });
    await audit(user.id, "assessment.grades.released", "Assessment", id);
    const attempted = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: id }, select: { student: { select: { userId: true } } }, distinct: ["studentId"],
    });
    if (attempted.length) {
      await prisma.notification.createMany({
        data: attempted.map((t) => ({
          userId: t.student.userId, type: "grade",
          title: `Results released: ${updated.title}`, body: "Open your attempt to see your score and feedback.",
        })),
      });
    }
    return updated;
  });
}
