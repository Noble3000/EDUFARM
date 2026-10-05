// CGPA Calculator (§10 study journey): Nigerian 5-point scale.
// GPA = Σ(point × units) / Σunits per semester; CGPA across all semesters.
// A=5 B=4 C=3 D=2 E=1 F=0. Records are the student's own; lecturers never see them.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";

export const GRADE_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

export function gpaOf(courses: { units: number; grade: string }[]): { gpa: number | null; units: number } {
  const units = courses.reduce((s, c) => s + c.units, 0);
  if (!units) return { gpa: null, units: 0 };
  const points = courses.reduce((s, c) => s + (GRADE_POINTS[c.grade] ?? 0) * c.units, 0);
  return { gpa: Math.round((points / units) * 100) / 100, units };
}

export async function gradesRoutes(app: FastifyInstance) {
  // full record + computed GPA/CGPA
  app.get("/grades/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const semesters = await prisma.gradeSemester.findMany({
      where: { studentId: user.studentProfile.id },
      include: { courses: { orderBy: { code: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    const withGpa = semesters.map((s) => ({ ...s, ...gpaOf(s.courses) }));
    const all = semesters.flatMap((s) => s.courses);
    return { semesters: withGpa, cgpa: gpaOf(all), scale: "5-point (A=5 … F=0)" };
  });

  app.post("/grades/semesters", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const b = req.body as { name: string };
    if (!b.name) return reply.code(400).send({ error: "name required (e.g. Year 2 Semester 1)." });
    return prisma.gradeSemester.create({ data: { studentId: user.studentProfile.id, name: b.name } });
  });

  app.delete("/grades/semesters/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const sem = await prisma.gradeSemester.findFirst({ where: { id, studentId: user.studentProfile.id } });
    if (!sem) return reply.code(404).send({ error: "Not found." });
    await prisma.gradeCourse.deleteMany({ where: { semesterId: id } });
    await prisma.gradeSemester.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/grades/semesters/:id/courses", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const sem = await prisma.gradeSemester.findFirst({ where: { id, studentId: user.studentProfile.id } });
    if (!sem) return reply.code(404).send({ error: "Semester not found." });
    const b = req.body as { code: string; title?: string; units: number; grade: string };
    const grade = (b.grade ?? "").toUpperCase();
    if (!b.code || GRADE_POINTS[grade] === undefined) return reply.code(400).send({ error: "code + grade (A–F) required." });
    const units = Number(b.units);
    if (!Number.isInteger(units) || units < 1 || units > 12)
      return reply.code(400).send({ error: "units must be 1–12." });
    try {
      return await prisma.gradeCourse.create({
        data: { semesterId: id, code: b.code.toUpperCase(), title: b.title, units, grade },
      });
    } catch {
      return reply.code(400).send({ error: "Course code already exists in this semester." });
    }
  });

  app.delete("/grades/courses/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const course = await prisma.gradeCourse.findUnique({ where: { id }, include: { semester: true } });
    if (!course || course.semester.studentId !== user.studentProfile.id)
      return reply.code(404).send({ error: "Not found." });
    await prisma.gradeCourse.delete({ where: { id } });
    return { ok: true };
  });
}
