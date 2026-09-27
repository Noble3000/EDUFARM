// Hierarchy CRUD: universities → faculties → departments → levels → courses.
// Read: any signed-in user. Write: deptAdmin+ (scoped check TODO Phase 1 hardening;
// platformAdmin bypasses). Seeded demo chain exists from Phase 0 seed.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireRole } from "../auth-dev.js";

const STAFF = ["deptAdmin", "institutionAdmin", "platformAdmin"];

export async function hierarchyRoutes(app: FastifyInstance) {
  app.get("/universities", async () => prisma.university.findMany({ orderBy: { name: "asc" } }));

  app.post("/universities", { preHandler: requireRole(...STAFF) }, async (req) => {
    const b = req.body as { name: string; slug: string };
    return prisma.university.create({ data: { name: b.name, slug: b.slug } });
  });

  app.get("/universities/:id/faculties", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.faculty.findMany({ where: { universityId: id } });
  });

  app.post("/faculties", { preHandler: requireRole(...STAFF) }, async (req) => {
    const b = req.body as { universityId: string; name: string };
    return prisma.faculty.create({ data: b });
  });

  app.get("/faculties/:id/departments", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.department.findMany({ where: { facultyId: id } });
  });

  app.post("/departments", { preHandler: requireRole(...STAFF) }, async (req) => {
    const b = req.body as { facultyId: string; name: string };
    return prisma.department.create({ data: b });
  });

  app.get("/departments/:id/levels", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.level.findMany({ where: { departmentId: id } });
  });

  app.post("/levels", { preHandler: requireRole(...STAFF) }, async (req) => {
    const b = req.body as { departmentId: string; name: string };
    return prisma.level.create({ data: b });
  });

  app.get("/departments/:id/courses", async (req) => {
    const { id } = req.params as { id: string };
    return prisma.course.findMany({ where: { departmentId: id }, orderBy: { code: "asc" } });
  });

  app.post("/courses", { preHandler: requireRole(...STAFF) }, async (req) => {
    const b = req.body as {
      departmentId: string; levelId: string; code: string; title: string; isOfficial?: boolean;
    };
    return prisma.course.create({ data: { ...b, isOfficial: b.isOfficial ?? false } });
  });

  app.get("/courses/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        materials: { where: { status: "published" }, orderBy: { createdAt: "desc" } },
        announcements: { orderBy: { createdAt: "desc" }, take: 20 },
        questions: { orderBy: { createdAt: "desc" }, take: 20, include: { answers: true } },
      },
    });
    if (!course) return reply.code(404).send({ error: "Course not found." });
    return course;
  });
}
