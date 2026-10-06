// Course Q&A (§9.2): students ask, lecturers answer for whole class.
// No 1-to-1 chat. States: unanswered → answered → resolved.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { ownsCourse, sessionUser as currentUser } from "../authz.js";

const STAFFISH = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"];

// Course membership gate: approved students see/ask/search; lecturers see
// their own courses; staff see all. Strangers (incl. anonymous) see nothing.
async function canSeeCourse(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>,
  courseId: string,
): Promise<boolean> {
  if (STAFFISH.includes(user.role) && user.role !== "lecturer") return true;
  if (user.role === "student" && user.studentProfile) {
    const e = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: user.studentProfile.id } },
    });
    if (e?.status === "approved") return true;
  }
  if (user.role === "lecturer") {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (course && (await ownsCourse(user, course))) return true;
  }
  return false;
}

export async function qaRoutes(app: FastifyInstance) {
  app.post("/courses/:id/questions", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    if (!(await canSeeCourse(user, id))) return reply.code(403).send({ error: "forbidden:course-access" });
    const b = req.body as { title: string; body: string };
    if (!b.title) return reply.code(400).send({ error: "auth-invalid: title required." });
    return prisma.question.create({
      data: { courseId: id, authorId: user.id, title: b.title, body: b.body ?? "", status: "unanswered" },
    });
  });

  app.get("/courses/:id/questions", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    if (!(await canSeeCourse(user, id))) return reply.code(403).send({ error: "forbidden:course-access" });
    const q = req.query as { q?: string; status?: string };
    return prisma.question.findMany({
      where: {
        courseId: id,
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
      },
      include: { answers: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.post("/questions/:id/answers", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const target = await prisma.question.findUnique({ where: { id }, select: { courseId: true } });
    if (!target) return reply.code(404).send({ error: "not-found:question" });
    if (!(await canSeeCourse(user, target.courseId)))
      return reply.code(403).send({ error: "forbidden:course-access" });
    const b = req.body as { body: string };
    if (!b.body) return reply.code(400).send({ error: "auth-invalid: body required." });
    const isLecturer = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role);
    const answer = await prisma.answer.create({
      data: { questionId: id, authorId: user.id, isLecturer, body: b.body },
    });
    if (isLecturer) await prisma.question.update({ where: { id }, data: { status: "answered" } });
    return answer;
  });

  app.post("/questions/:id/resolve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const q = await prisma.question.findUnique({ where: { id } });
    if (!q) return reply.code(404).send({ error: "not-found:question" });
    const staffish = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role);
    if (q.authorId !== user.id && !staffish)
      return reply.code(403).send({ error: "forbidden:not-author" });
    return prisma.question.update({ where: { id }, data: { status: "resolved" } });
  });
}
