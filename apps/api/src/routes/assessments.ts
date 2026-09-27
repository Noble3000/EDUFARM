// Assessments Phase 2a (§10.1): lecturer builds, students attempt, MCQ auto-graded.
// Lecturer: POST /courses/:id/assessments, POST /assessments/:id/questions,
//   POST /assessments/:id/publish|close, GET /assessments/:id/attempts, POST /attempts/:id/grade.
// Student (enrolled + approved): GET /courses/:id/assessments (published, no answer keys),
//   POST /assessments/:id/start, POST /attempts/:id/submit {answers:[{questionId, selectedIndex?, body?}]}.
// Submit auto-grades mcq; theory awaits lecturer grading → status graded.
// StudyEvent(type=assessment-submitted) + notification fan-out on publish/grade.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

const LECTURER_ROLES = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"];

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

async function enrolledApproved(courseId: string, studentId: string) {
  const e = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  return e?.status === "approved";
}

export async function assessmentRoutes(app: FastifyInstance) {
  // lecturer creates assessment (draft)
  app.post("/courses/:id/assessments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const b = req.body as {
      title: string; type?: string; instructions?: string; timeLimitMin?: number; maxAttempts?: number; dueAt?: string;
    };
    if (!b.title) return reply.code(400).send({ error: "title required." });
    return prisma.assessment.create({
      data: {
        courseId: id, title: b.title, type: b.type ?? "quiz", instructions: b.instructions,
        timeLimitMin: b.timeLimitMin, maxAttempts: b.maxAttempts ?? 1,
        dueAt: b.dueAt ? new Date(b.dueAt) : null, status: "draft",
      },
    });
  });

  // lecturer adds question
  app.post("/assessments/:id/questions", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const b = req.body as {
      text: string; kind?: string; options?: string[]; correctIndex?: number; marks?: number;
    };
    if (!b.text) return reply.code(400).send({ error: "text required." });
    if ((b.kind ?? "mcq") === "mcq" && (!b.options?.length || b.correctIndex == null))
      return reply.code(400).send({ error: "mcq needs options + correctIndex." });
    const count = await prisma.assessmentQuestion.count({ where: { assessmentId: id } });
    return prisma.assessmentQuestion.create({
      data: {
        assessmentId: id, text: b.text, kind: b.kind ?? "mcq", options: b.options ?? [],
        correctIndex: b.correctIndex, marks: b.marks ?? 1, order: count,
      },
    });
  });

  // lecturer publishes / closes
  app.post("/assessments/:id/publish", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const updated = await prisma.assessment.update({ where: { id }, data: { status: "published" } });
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
    return updated;
  });

  app.post("/assessments/:id/close", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    return prisma.assessment.update({ where: { id }, data: { status: "closed" } });
  });

  // lecturer: list ALL assessments for a course (drafts included, keys visible)
  app.get("/courses/:id/assessments/lecturer", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    return prisma.assessment.findMany({
      where: { courseId: id },
      include: { questions: { orderBy: { order: "asc" } }, _count: { select: { attempts: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // student: list published assessments for a course (keys stripped)
  app.get("/courses/:id/assessments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    if (!(await enrolledApproved(id, user.studentProfile.id)))
      return reply.code(403).send({ error: "Course access required." });
    const list = await prisma.assessment.findMany({
      where: { courseId: id, status: "published" },
      include: { questions: { orderBy: { order: "asc" } }, attempts: { where: { studentId: user.studentProfile.id } } },
      orderBy: { createdAt: "desc" },
    });
    return list.map(stripKeys);
  });

  // student: start attempt
  app.post("/assessments/:id/start", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const a = await prisma.assessment.findUnique({ where: { id } });
    if (!a || a.status !== "published") return reply.code(404).send({ error: "Assessment unavailable." });
    if (!(await enrolledApproved(a.courseId, user.studentProfile.id)))
      return reply.code(403).send({ error: "Course access required." });
    const used = await prisma.assessmentAttempt.count({ where: { assessmentId: id, studentId: user.studentProfile.id } });
    if (used >= a.maxAttempts) return reply.code(400).send({ error: `Max attempts (${a.maxAttempts}) reached.` });
    const attempt = await prisma.assessmentAttempt.create({
      data: { assessmentId: id, studentId: user.studentProfile.id, attemptNo: used + 1, status: "in-progress" },
    });
    const full = await prisma.assessment.findUnique({
      where: { id }, include: { questions: { orderBy: { order: "asc" } } },
    });
    return { attempt, assessment: stripKeys(full as unknown as Record<string, unknown>) };
  });

  // student: submit answers (auto-grades mcq)
  app.post("/attempts/:id/submit", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id }, include: { assessment: { include: { questions: true } } },
    });
    if (!attempt || attempt.studentId !== user.studentProfile.id)
      return reply.code(404).send({ error: "Attempt not found." });
    if (attempt.status !== "in-progress") return reply.code(400).send({ error: `Already ${attempt.status}.` });
    const b = req.body as { answers: { questionId: string; selectedIndex?: number; body?: string }[] };
    let score = 0;
    let maxScore = 0;
    let hasTheory = false;
    for (const q of attempt.assessment.questions) {
      maxScore += q.marks;
      const given = b.answers?.find((x) => x.questionId === q.id);
      if (q.kind === "mcq") {
        const correct = given?.selectedIndex === q.correctIndex;
        if (correct) score += q.marks;
        await prisma.assessmentAnswer.upsert({
          where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
          update: { selectedIndex: given?.selectedIndex, isCorrect: correct, marksAwarded: correct ? q.marks : 0 },
          create: {
            attemptId: id, questionId: q.id, selectedIndex: given?.selectedIndex,
            isCorrect: correct, marksAwarded: correct ? q.marks : 0,
          },
        });
      } else {
        hasTheory = true;
        await prisma.assessmentAnswer.upsert({
          where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
          update: { body: given?.body },
          create: { attemptId: id, questionId: q.id, body: given?.body },
        });
      }
    }
    const updated = await prisma.assessmentAttempt.update({
      where: { id },
      data: hasTheory
        ? { status: "submitted", maxScore, submittedAt: new Date() }
        : { status: "graded", score, maxScore, submittedAt: new Date() },
      include: { answers: { include: { question: true } } },
    });
    await prisma.studyEvent.create({
      data: {
        studentId: user.studentProfile.id, courseId: attempt.assessment.courseId,
        type: "assessment-submitted", durationSec: 0,
      },
    });
    return updated;
  });

  // student: my attempts for an assessment
  app.get("/assessments/:id/attempts/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    return prisma.assessmentAttempt.findMany({
      where: { assessmentId: id, studentId: user.studentProfile.id },
      include: { answers: { include: { question: true } } },
      orderBy: { attemptNo: "desc" },
    });
  });

  // lecturer: all attempts + grade theory
  app.get("/assessments/:id/attempts", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    return prisma.assessmentAttempt.findMany({
      where: { assessmentId: id },
      include: { answers: { include: { question: true } } },
      orderBy: { submittedAt: "desc" },
    });
  });

  app.post("/attempts/:id/grade", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const b = req.body as { marks: { questionId: string; marksAwarded: number }[] };
    for (const m of b.marks ?? []) {
      await prisma.assessmentAnswer.updateMany({
        where: { attemptId: id, questionId: m.questionId },
        data: { marksAwarded: m.marksAwarded, isCorrect: m.marksAwarded > 0 },
      });
    }
    const attempt = await prisma.assessmentAttempt.findUnique({
      where: { id }, include: { answers: true, assessment: { include: { questions: true } } },
    });
    if (!attempt) return reply.code(404).send({ error: "Not found." });
    const score = attempt.answers.reduce((s, a) => s + a.marksAwarded, 0);
    const maxScore = attempt.assessment.questions.reduce((s, q) => s + q.marks, 0);
    const graded = await prisma.assessmentAttempt.update({
      where: { id }, data: { status: "graded", score, maxScore },
    });
    const attemptWithStudent = await prisma.assessmentAttempt.findUnique({
      where: { id }, include: { student: true },
    });
    await prisma.notification.create({
      data: {
        userId: attemptWithStudent!.student.userId, type: "grade",
        title: `Graded: ${attempt.assessment.title}`, body: `Score ${score}/${maxScore}`,
      },
    });
    return graded;
  });
}
