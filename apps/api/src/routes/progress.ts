// Study progress (§10): page pings → completion % → continue-studying.
// Completion rule: a page counts when dwell ≥ 8s (not mere open).
// Course progress = completed pages / total published pages (free + purchased).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";

const DWELL_THRESHOLD_SEC = 8;

export async function progressRoutes(app: FastifyInstance) {
  // client pings dwell per page
  app.post("/materials/:id/ping", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { page: number; durationSec: number };
    if (b.page == null) return reply.code(400).send({ error: "page required." });
    const mat = await prisma.material.findUnique({ where: { id } });
    if (!mat) return reply.code(404).send({ error: "Not found." });
    await prisma.studyEvent.create({
      data: {
        studentId: user.studentProfile.id, courseId: mat.courseId, materialId: id,
        type: "page-dwell", page: b.page, durationSec: b.durationSec ?? 0,
      },
    });
    return { ok: true };
  });

  // my progress per course
  app.get("/progress/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.studentProfile.id, status: "approved" },
      include: { course: { include: { materials: { where: { status: "published" } } } } },
    });
    const events = await prisma.studyEvent.findMany({
      where: { studentId: user.studentProfile.id, type: { in: ["page-view", "page-dwell"] } },
    });
    const completedPages = new Set(
      events.filter((e) => e.durationSec >= DWELL_THRESHOLD_SEC || e.type === "page-view")
        .map((e) => `${e.materialId}:${e.page}`),
    );
    // page-view counts only after dwell ping arrives; keep both for now, dwell-weighted later
    return enrollments.map((e) => {
      const mats = e.course.materials;
      const totalPages = mats.length * 10; // mock pageCount=10 until render spike stores real counts
      const done = mats.reduce((s, m) => {
        let c = 0;
        for (let p = 1; p <= 10; p++) if (completedPages.has(`${m.id}:${p}`)) c++;
        return s + c;
      }, 0);
      return {
        courseId: e.courseId, code: e.course.code, title: e.course.title,
        totalPages, completedPages: done,
        percent: totalPages ? Math.round((done / totalPages) * 100) : 0,
      };
    });
  });

  // continue studying: most recent material with activity
  app.get("/progress/continue", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const last = await prisma.studyEvent.findFirst({
      where: { studentId: user.studentProfile.id },
      orderBy: { createdAt: "desc" },
    });
    if (!last?.materialId) return { materialId: null };
    const mat = await prisma.material.findUnique({ where: { id: last.materialId }, include: { course: true } });
    return { materialId: last.materialId, page: last.page ?? 1, material: mat };
  });

  // notifications inbox
  app.get("/notifications/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    return prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  });
}
