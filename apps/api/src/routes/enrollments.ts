// Enrollments: student requests → lecturer approves/manages.
// Unapproved students see nothing in course (reader + materials enforce).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

export async function enrollmentRoutes(app: FastifyInstance) {
  // student requests enrollment
  app.post("/courses/:id/enroll", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || user.role !== "student" || !user.studentProfile)
      return reply.code(401).send({ error: "Verified student sign-in required." });
    if (user.studentProfile.verificationStatus !== "verified")
      return reply.code(403).send({ error: "Student verification required." });
    const { id } = req.params as { id: string };
    return prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: id, studentId: user.studentProfile.id } },
      update: { status: "requested" },
      create: { courseId: id, studentId: user.studentProfile.id, status: "requested" },
    });
  });

  // lecturer: list enrollments for a course they own (ownership check = material authorship or any; hardened later)
  app.get("/courses/:id/enrollments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    return prisma.enrollment.findMany({
      where: { courseId: id },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // lecturer: approve | reject | remove
  app.post("/enrollments/:id/decide", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const b = req.body as { decision: "approve" | "reject" | "remove" };
    const status = b.decision === "approve" ? "approved" : b.decision === "reject" ? "rejected" : "removed";
    const updated = await prisma.enrollment.update({ where: { id }, data: { status } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: `enrollment.${b.decision}d`, targetType: "Enrollment", targetId: id },
    });
    return updated;
  });

  // student: my enrollments
  app.get("/enrollments/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    return prisma.enrollment.findMany({
      where: { studentId: user.studentProfile.id },
      include: { course: true },
      orderBy: { createdAt: "desc" },
    });
  });
}
