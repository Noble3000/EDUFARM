// Announcements (§9.1): lecturer-only publishing inside own course.
// Categories (fixed set): new-material | assignment | test | course-notice |
// general | urgent-update. Edits/archives are audited; archived items leave
// the student feed but stay in DB. No 1-to-1 chat exists anywhere in the API.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { audit, ownsCourse, sessionUser as currentUser } from "../authz.js";

export const ANNOUNCEMENT_CATEGORIES = [
  "new-material",
  "assignment",
  "test",
  "course-notice",
  "general",
  "urgent-update",
] as const;

export async function announcementRoutes(app: FastifyInstance) {
  // lecturer publishes (own course only)
  app.post("/courses/:id/announcements", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return reply.code(404).send({ error: "not-found:course" });
    if (!(await ownsCourse(user, course)))
      return reply.code(403).send({ error: "forbidden:announce (lecturer-only, own course)" });
    const b = req.body as { category: string; title: string; body: string; isUrgent?: boolean };
    if (!b.title || !b.body) return reply.code(400).send({ error: "auth-invalid: title + body required." });
    const category = ANNOUNCEMENT_CATEGORIES.includes(b.category as never) ? b.category : "general";
    const lecturerId = user.lecturerProfile?.id ?? user.id;
    const created = await prisma.announcement.create({
      data: { courseId: id, lecturerId, category, title: b.title, body: b.body, isUrgent: !!b.isUrgent },
    });
    await audit(user.id, "announcement.published", "Announcement", created.id, `${id} [${category}]${b.isUrgent ? " urgent" : ""}`);
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: id, status: "approved" }, select: { student: { select: { userId: true } } },
    });
    const { notify } = await import("../notify/center.js");
    for (const e of enrollments) {
      await notify({
        userId: e.student.userId, type: "announcement",
        title: b.isUrgent ? `URGENT: ${b.title}` : b.title,
        body: `${course.code} — ${b.title}`,
        link: `/courses/${id}`,
        dedupKey: `announcement:${created.id}`,
        email: { kind: "announcement" },
      });
    }
    return created;
  });

  // lecturer edits (own course only, audited)
  app.patch("/announcements/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const ann = await prisma.announcement.findUnique({ where: { id }, include: { course: true } });
    if (!ann) return reply.code(404).send({ error: "not-found:announcement" });
    if (!(await ownsCourse(user, ann.course)))
      return reply.code(403).send({ error: "forbidden:announce (lecturer-only, own course)" });
    const b = req.body as { category?: string; title?: string; body?: string; isUrgent?: boolean };
    const data: Record<string, unknown> = {};
    if (b.title !== undefined) {
      if (!b.title) return reply.code(400).send({ error: "auth-invalid: title cannot be empty." });
      data.title = b.title;
    }
    if (b.body !== undefined) {
      if (!b.body) return reply.code(400).send({ error: "auth-invalid: body cannot be empty." });
      data.body = b.body;
    }
    if (b.category !== undefined) {
      if (!ANNOUNCEMENT_CATEGORIES.includes(b.category as never))
        return reply.code(400).send({ error: `auth-invalid: category must be one of ${ANNOUNCEMENT_CATEGORIES.join(", ")}` });
      data.category = b.category;
    }
    if (b.isUrgent !== undefined) data.isUrgent = !!b.isUrgent;
    const updated = await prisma.announcement.update({ where: { id }, data });
    await audit(user.id, "announcement.edited", "Announcement", id, Object.keys(data).join(","));
    return updated;
  });

  // lecturer archives (own course only, audited; retained in DB per §9.1)
  app.post("/announcements/:id/archive", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const ann = await prisma.announcement.findUnique({ where: { id }, include: { course: true } });
    if (!ann) return reply.code(404).send({ error: "not-found:announcement" });
    if (!(await ownsCourse(user, ann.course)))
      return reply.code(403).send({ error: "forbidden:announce (lecturer-only, own course)" });
    await audit(user.id, "announcement.archived", "Announcement", id);
    return prisma.announcement.update({ where: { id }, data: { archived: true } });
  });

  // course feed (archived hidden unless staff asks explicitly)
  app.get("/courses/:id/announcements", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = req.query as { includeArchived?: string };
    const user = await currentUser(req);
    const includeArchived =
      q.includeArchived === "true" &&
      !!user &&
      (user.role === "lecturer" || user.role === "deptAdmin" || user.role === "institutionAdmin" || user.role === "platformAdmin");
    return prisma.announcement.findMany({
      where: { courseId: id, ...(includeArchived ? {} : { archived: false }) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });
}
