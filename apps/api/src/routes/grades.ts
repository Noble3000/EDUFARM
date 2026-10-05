// CGPA Calculator (§10 study journey): Nigerian 5-point scale.
// GPA = Σ(point × units) / Σunits per semester; CGPA across all semesters.
// A=5 B=4 C=3 D=2 E=1 F=0. Records are the student's own; lecturers never see them.
// Privacy model: every endpoint requires the caller's OWN studentProfile and
// scopes every row to it. There is deliberately NO lecturer/admin read path —
// no role, not even platformAdmin, can list or view another student's grades.
// Repeated-course policy: the same code may repeat ACROSS semesters (retake);
// every recorded attempt counts toward CGPA (all-in). Within one semester the
// code is unique. No export endpoint exists by design (see PRD).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";

export const GRADE_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
export const MIN_UNITS = 1;
export const MAX_UNITS = 12;

export function gpaOf(courses: { units: number; grade: string }[]): { gpa: number | null; units: number } {
  const units = courses.reduce((s, c) => s + c.units, 0);
  if (!units) return { gpa: null, units: 0 };
  const points = courses.reduce((s, c) => s + (GRADE_POINTS[c.grade] ?? 0) * c.units, 0);
  return { gpa: Math.round((points / units) * 100) / 100, units };
}

// Degree class bands (must match the student UI Class badge exactly).
export function degreeClass(gpa: number | null): string {
  if (gpa == null) return "—";
  if (gpa >= 4.5) return "First Class";
  if (gpa >= 3.5) return "Second Class Upper";
  if (gpa >= 2.4) return "Second Class Lower";
  if (gpa >= 1.5) return "Third Class";
  return "Pass/Fail zone";
}

function parseGrade(raw: unknown): string | null {
  const grade = String(raw ?? "").trim().toUpperCase();
  return GRADE_POINTS[grade] === undefined ? null : grade;
}

function parseUnits(raw: unknown): number | null {
  const units = Number(raw);
  if (!Number.isInteger(units) || units < MIN_UNITS || units > MAX_UNITS) return null;
  return units;
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
    const cgpa = gpaOf(all);
    return { semesters: withGpa, cgpa: { ...cgpa, class: degreeClass(cgpa.gpa) }, scale: "5-point (A=5 … F=0)" };
  });

  app.post("/grades/semesters", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const b = req.body as { name: string };
    const name = String(b.name ?? "").trim();
    if (!name) return reply.code(400).send({ error: "name required (e.g. Year 2 Semester 1)." });
    if (name.length > 80) return reply.code(400).send({ error: "name too long (max 80)." });
    return prisma.gradeSemester.create({ data: { studentId: user.studentProfile.id, name } });
  });

  app.patch("/grades/semesters/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const sem = await prisma.gradeSemester.findFirst({ where: { id, studentId: user.studentProfile.id } });
    if (!sem) return reply.code(404).send({ error: "Not found." });
    const b = req.body as { name: string };
    const name = String(b.name ?? "").trim();
    if (!name) return reply.code(400).send({ error: "name required (e.g. Year 2 Semester 1)." });
    if (name.length > 80) return reply.code(400).send({ error: "name too long (max 80)." });
    return prisma.gradeSemester.update({ where: { id }, data: { name } });
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
    const code = String(b.code ?? "").trim().toUpperCase();
    const grade = parseGrade(b.grade);
    const units = parseUnits(b.units);
    if (!code) return reply.code(400).send({ error: "code required (e.g. BIO 201)." });
    if (code.length > 20) return reply.code(400).send({ error: "code too long (max 20)." });
    if (grade === null) return reply.code(400).send({ error: "grade must be A, B, C, D, E or F." });
    if (units === null) return reply.code(400).send({ error: `units must be a whole number ${MIN_UNITS}–${MAX_UNITS}.` });
    const title = String(b.title ?? "").trim().slice(0, 120) || null;
    try {
      return await prisma.gradeCourse.create({
        data: { semesterId: id, code, title, units, grade },
      });
    } catch {
      return reply.code(400).send({ error: "Course code already exists in this semester (repeats go in a new semester)." });
    }
  });

  app.patch("/grades/courses/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const course = await prisma.gradeCourse.findUnique({ where: { id }, include: { semester: true } });
    if (!course || course.semester.studentId !== user.studentProfile.id)
      return reply.code(404).send({ error: "Not found." });
    const b = req.body as { code?: string; title?: string | null; units?: number; grade?: string };
    const data: { code?: string; title?: string | null; units?: number; grade?: string } = {};
    if (b.code !== undefined) {
      const code = String(b.code).trim().toUpperCase();
      if (!code) return reply.code(400).send({ error: "code required (e.g. BIO 201)." });
      if (code.length > 20) return reply.code(400).send({ error: "code too long (max 20)." });
      const clash = await prisma.gradeCourse.findFirst({
        where: { semesterId: course.semesterId, code, NOT: { id } },
      });
      if (clash) return reply.code(400).send({ error: "Course code already exists in this semester." });
      data.code = code;
    }
    if (b.title !== undefined) data.title = String(b.title ?? "").trim().slice(0, 120) || null;
    if (b.units !== undefined) {
      const units = parseUnits(b.units);
      if (units === null) return reply.code(400).send({ error: `units must be a whole number ${MIN_UNITS}–${MAX_UNITS}.` });
      data.units = units;
    }
    if (b.grade !== undefined) {
      const grade = parseGrade(b.grade);
      if (grade === null) return reply.code(400).send({ error: "grade must be A, B, C, D, E or F." });
      data.grade = grade;
    }
    if (!Object.keys(data).length) return reply.code(400).send({ error: "Nothing to update." });
    return prisma.gradeCourse.update({ where: { id }, data });
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
