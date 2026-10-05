// Announcements (§9.1): lecturer posts, enrolled students read.
// Categories: new-material | assignment | test | course-notice | general | urgent-update.
// Urgent surfaces in student priorities.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";

const STAFF_LECTURER = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"];

export async function announcementRoutes(app: FastifyInstance) {
  app.post("/courses/:id/announcements", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !STAFF_LECTURER.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const b = req.body as { category: string; title: string; body: string; isUrgent?: boolean };
    if (!b.title || !b.body) return reply.code(400).send({ error: "title + body required." });
    const lecturerId = user.lecturerProfile?.id ?? user.id;
    const created = await prisma.announcement.create({
      data: { courseId: id, lecturerId, category: b.category ?? "general", title: b.title, body: b.body, isUrgent: !!b.isUrgent },
    });
    // fan-out in-app notifications to approved enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: id, status: "approved" }, select: { student: { select: { userId: true } } },
    });
    if (enrollments.length) {
      await prisma.notification.createMany({
        data: enrollments.map((e) => ({
          userId: e.student.userId, type: "announcement",
          title: b.isUrgent ? `URGENT: ${b.title}` : b.title,
          body: `New announcement in ${id}`,
        })),
      });
    }
    return created;
  });

  app.get("/courses/:id/announcements", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.announcement.findMany({ where: { courseId: id }, orderBy: { createdAt: "desc" }, take: 50 });
  });
}
