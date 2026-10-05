// Hierarchy CRUD: University → Faculty → Department → Level → Course.
// Reads: any signed-in user. Writes: deptAdmin+ (platformAdmin bypasses).
// Every write validates the chain: parents must exist, names unique per parent,
// and a course must sit under a level of its own department (no orphans).
// Course access is lecturer-controlled via CourseLecturer assignments.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser, requireRole } from "../authz.js";
import { assertCoursePlacement, audit, notifyUser } from "../hierarchy-guard.js";

const STAFF = ["deptAdmin", "institutionAdmin", "platformAdmin"];

export async function hierarchyRoutes(app: FastifyInstance) {
  app.get("/universities", async () => prisma.university.findMany({ orderBy: { name: "asc" } }));

  app.post("/universities", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const b = req.body as { name: string; slug: string };
    if (!b.name || !b.slug) return reply.code(400).send({ error: "name + slug required." });
    try {
      return await prisma.university.create({ data: { name: b.name, slug: b.slug } });
    } catch {
      return reply.code(400).send({ error: "University slug already exists." });
    }
  });

  app.get("/universities/:id/faculties", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.faculty.findMany({ where: { universityId: id }, orderBy: { name: "asc" } });
  });

  app.post("/faculties", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const b = req.body as { universityId: string; name: string };
    if (!b.universityId || !b.name) return reply.code(400).send({ error: "universityId + name required." });
    const uni = await prisma.university.findUnique({ where: { id: b.universityId } });
    if (!uni) return reply.code(404).send({ error: "University not found." });
    try {
      return await prisma.faculty.create({ data: b });
    } catch {
      return reply.code(400).send({ error: "Faculty name already exists in this university." });
    }
  });

  app.get("/faculties/:id/departments", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.department.findMany({ where: { facultyId: id }, orderBy: { name: "asc" } });
  });

  app.post("/departments", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const b = req.body as { facultyId: string; name: string };
    if (!b.facultyId || !b.name) return reply.code(400).send({ error: "facultyId + name required." });
    const fac = await prisma.faculty.findUnique({ where: { id: b.facultyId } });
    if (!fac) return reply.code(404).send({ error: "Faculty not found." });
    try {
      return await prisma.department.create({ data: b });
    } catch {
      return reply.code(400).send({ error: "Department name already exists in this faculty." });
    }
  });

  app.get("/departments/:id/levels", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.level.findMany({ where: { departmentId: id }, orderBy: { name: "asc" } });
  });

  app.post("/levels", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const b = req.body as { departmentId: string; name: string };
    if (!b.departmentId || !b.name) return reply.code(400).send({ error: "departmentId + name required." });
    const dept = await prisma.department.findUnique({ where: { id: b.departmentId } });
    if (!dept) return reply.code(404).send({ error: "Department not found." });
    try {
      return await prisma.level.create({ data: b });
    } catch {
      return reply.code(400).send({ error: "Level name already exists in this department." });
    }
  });

  app.get("/departments/:id/courses", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.course.findMany({
      where: { departmentId: id }, orderBy: { code: "asc" },
      include: { level: true, lecturers: { include: { lecturer: { include: { user: true } } } } },
    });
  });

  app.post("/courses", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const b = req.body as {
      departmentId: string; levelId: string; code: string; title: string; isOfficial?: boolean;
    };
    if (!b.departmentId || !b.levelId || !b.code || !b.title)
      return reply.code(400).send({ error: "departmentId + levelId + code + title required." });
    const placement = await assertCoursePlacement(b.departmentId, b.levelId);
    if (!placement.ok) return reply.code(400).send({ error: placement.error });
    try {
      return await prisma.course.create({ data: { ...b, isOfficial: b.isOfficial ?? false } });
    } catch {
      return reply.code(400).send({ error: "Course code already exists in this department." });
    }
  });

  app.get("/courses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        department: { include: { faculty: { include: { university: true } } } },
        level: true,
        lecturers: { include: { lecturer: { include: { user: true } } } },
        materials: { where: { status: "published" }, orderBy: { createdAt: "desc" } },
        announcements: { orderBy: { createdAt: "desc" }, take: 20 },
        questions: { orderBy: { createdAt: "desc" }, take: 20, include: { answers: true } },
      },
    });
    if (!course) return reply.code(404).send({ error: "Course not found." });
    return course;
  });

  // --- lecturer assignment: who controls this course (staff only) ---
  app.get("/courses/:id/lecturers", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    return prisma.courseLecturer.findMany({
      where: { courseId: id }, include: { lecturer: { include: { user: true, department: true } } },
    });
  });

  app.post("/courses/:id/lecturers", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const user = await currentUser(req);
    const { id } = req.params as { id: string };
    const b = req.body as { lecturerProfileId: string; role?: string };
    if (!b.lecturerProfileId) return reply.code(400).send({ error: "lecturerProfileId required." });
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return reply.code(404).send({ error: "Course not found." });
    const lect = await prisma.lecturerProfile.findUnique({
      where: { id: b.lecturerProfileId }, include: { user: true },
    });
    if (!lect) return reply.code(404).send({ error: "Lecturer profile not found." });
    if (lect.verificationStatus !== "verified")
      return reply.code(400).send({ error: `Lecturer is ${lect.verificationStatus} — verify first.` });
    if (lect.departmentId !== course.departmentId)
      return reply.code(400).send({ error: "Lecturer belongs to a different department than this course." });
    const link = await prisma.courseLecturer.upsert({
      where: { courseId_lecturerId: { courseId: id, lecturerId: lect.id } },
      update: { role: b.role ?? "owner" },
      create: { courseId: id, lecturerId: lect.id, role: b.role ?? "owner" },
    });
    await audit(user!.id, "course.lecturer.assigned", "Course", id, `${lect.user.name} (${b.role ?? "owner"})`);
    await notifyUser(
      lect.userId, "course.assigned", `Assigned to ${course.code}`,
      `You now control access to ${course.code} — ${course.title}. Enrollment requests will come to you.`
    );
    return link;
  });

  app.delete("/courses/:id/lecturers/:lecturerId", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const user = await currentUser(req);
    const { id, lecturerId } = req.params as { id: string; lecturerId: string };
    const remaining = await prisma.courseLecturer.findMany({ where: { courseId: id } });
    if (remaining.length <= 1 && remaining.some((r) => r.lecturerId === lecturerId))
      return reply.code(400).send({ error: "A course must keep at least one lecturer — assign a replacement first." });
    await prisma.courseLecturer.deleteMany({ where: { courseId: id, lecturerId } });
    await audit(user!.id, "course.lecturer.unassigned", "Course", id, lecturerId);
    return { removed: true };
  });
}
