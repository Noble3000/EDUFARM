// Course Q&A (§9.2): students ask, lecturers answer for whole class.
// No 1-to-1 chat. States: unanswered → answered → resolved.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

export async function qaRoutes(app: FastifyInstance) {
  app.post("/courses/:id/questions", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { title: string; body: string };
    if (!b.title) return reply.code(400).send({ error: "title required." });
    return prisma.question.create({
      data: { courseId: id, authorId: user.id, title: b.title, body: b.body ?? "", status: "unanswered" },
    });
  });

  app.get("/courses/:id/questions", async (req) => {
    const { id } = req.params as { id: string };
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
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { body: string };
    if (!b.body) return reply.code(400).send({ error: "body required." });
    const isLecturer = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role);
    const answer = await prisma.answer.create({
      data: { questionId: id, authorId: user.id, isLecturer, body: b.body },
    });
    if (isLecturer) await prisma.question.update({ where: { id }, data: { status: "answered" } });
    return answer;
  });

  app.post("/questions/:id/resolve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    return prisma.question.update({ where: { id }, data: { status: "resolved" } });
  });
}
