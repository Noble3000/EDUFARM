// Enrollments: verification ≠ enrollment. A verified student sees NOTHING until a
// lecturer approves them per course. Only lecturers assigned to the course
// (CourseLecturer) — or staff — may approve/reject/remove/suspend.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { audit, canControlCourse, notifyUser } from "../hierarchy-guard.js";

export async function enrollmentRoutes(app: FastifyInstance) {
  // student requests enrollment (verified + active only; never auto-approved)
  app.post("/courses/:id/enroll", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || user.role !== "student" || !user.studentProfile)
      return reply.code(401).send({ error: "Student sign-in required." });
    const st = user.studentProfile;
    if (st.verificationStatus !== "verified")
      return reply.code(403).send({ error: `Student verification required (you are ${st.verificationStatus}).` });
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({ where: { id }, include: { department: true } });
    if (!course) return reply.code(404).send({ error: "Course not found." });
    const existing = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: id, studentId: st.id } },
    });
    if (existing?.status === "approved")
      return reply.code(400).send({ error: "Already enrolled in this course." });
    if (existing?.status === "suspended")
      return reply.code(400).send({ error: "Enrollment suspended. Contact the course lecturer." });
    const enr = await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: id, studentId: st.id } },
      update: { status: "requested" },
      create: { courseId: id, studentId: st.id, status: "requested" },
    });
    await audit(user.id, "enrollment.requested", "Enrollment", enr.id, `${course.code}`);
    // notify every lecturer assigned to this course
    const owners = await prisma.courseLecturer.findMany({
      where: { courseId: id }, include: { lecturer: true },
    });
    for (const o of owners) {
      await notifyUser(
        o.lecturer.userId, "enrollment.requested",
        `New enrollment request — ${course.code}`,
        `${user.name ?? "A student"} (${st.matricNo}) requested access to ${course.code} — ${course.title}.`
      );
    }
    return enr;
  });

  // list enrollments for a course (assigned lecturer or staff)
  app.get("/courses/:id/enrollments", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    if (!(await canControlCourse(user.id, user.role, id)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may view enrollments." });
    const q = req.query as { status?: string };
    return prisma.enrollment.findMany({
      where: q.status ? { courseId: id, status: q.status as never } : { courseId: id },
      include: { student: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // decide: approve | reject | remove | suspend | reinstate (lecturer-controlled)
  app.post("/enrollments/:id/decide", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = req.body as { decision: "approve" | "reject" | "remove" | "suspend" | "reinstate" };
    if (!["approve", "reject", "remove", "suspend", "reinstate"].includes(b.decision))
      return reply.code(400).send({ error: "decision must be approve|reject|remove|suspend|reinstate." });
    const enr = await prisma.enrollment.findUnique({
      where: { id }, include: { course: true, student: true },
    });
    if (!enr) return reply.code(404).send({ error: "Enrollment not found." });
    if (!(await canControlCourse(user.id, user.role, enr.courseId)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may decide enrollments." });
    const allowed: Record<string, string[]> = {
      requested: ["approve", "reject"],
      rejected: ["approve"],
      approved: ["remove", "suspend"],
      removed: ["approve"],
      suspended: ["reinstate"],
    };
    if (!(allowed[enr.status] ?? []).includes(b.decision))
      return reply.code(400).send({ error: `Cannot ${b.decision} a ${enr.status} enrollment.` });
    const status = b.decision === "approve" || b.decision === "reinstate"
      ? "approved"
      : b.decision === "reject" ? "rejected" : b.decision === "remove" ? "removed" : "suspended";
    const updated = await prisma.enrollment.update({ where: { id }, data: { status } });
    await audit(user.id, `enrollment.${b.decision}d`, "Enrollment", id, `${enr.course.code}`);
    const copy: Record<string, string> = {
      approve: `You are now enrolled in ${enr.course.code} — ${enr.course.title}.`,
      reinstate: `Your access to ${enr.course.code} — ${enr.course.title} is restored.`,
      reject: `Your request for ${enr.course.code} was not approved. Contact the course lecturer.`,
      remove: `Your access to ${enr.course.code} was removed by the course lecturer.`,
      suspend: `Your access to ${enr.course.code} is suspended. Contact the course lecturer.`,
    };
    await notifyUser(enr.student.userId, `enrollment.${b.decision}`, `Enrollment ${b.decision}d — ${enr.course.code}`, copy[b.decision]);
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
