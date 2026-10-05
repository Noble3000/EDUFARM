// Hierarchy guards + verification notifications (shared by hierarchy/verification/
// enrollments/auth-local/devotional routes). Chain rule:
// University → Faculty → Department → Level must each belong to its parent;
// Course must sit under a level of its own department; profiles must link the
// full chain (no "" placeholders); lecturer course control requires a
// CourseLecturer assignment (staff roles bypass).

import { prisma } from "./db.js";

export type Chain = { universityId: string; facultyId: string; departmentId: string; levelId: string };

export async function assertChain(c: Chain): Promise<{ ok: true } | { ok: false; error: string }> {
  const uni = await prisma.university.findUnique({ where: { id: c.universityId } });
  if (!uni) return { ok: false, error: "University not found." };
  const fac = await prisma.faculty.findUnique({ where: { id: c.facultyId } });
  if (!fac) return { ok: false, error: "Faculty not found." };
  if (fac.universityId !== c.universityId)
    return { ok: false, error: "Faculty does not belong to this university." };
  const dept = await prisma.department.findUnique({ where: { id: c.departmentId } });
  if (!dept) return { ok: false, error: "Department not found." };
  if (dept.facultyId !== c.facultyId)
    return { ok: false, error: "Department does not belong to this faculty." };
  const level = await prisma.level.findUnique({ where: { id: c.levelId } });
  if (!level) return { ok: false, error: "Level not found." };
  if (level.departmentId !== c.departmentId)
    return { ok: false, error: "Level does not belong to this department." };
  return { ok: true };
}

export async function assertCoursePlacement(
  departmentId: string,
  levelId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dept = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!dept) return { ok: false, error: "Department not found." };
  const level = await prisma.level.findUnique({ where: { id: levelId } });
  if (!level) return { ok: false, error: "Level not found." };
  if (level.departmentId !== departmentId)
    return { ok: false, error: "Level does not belong to this department — course would be orphaned." };
  return { ok: true };
}

// Lecturer course control: assigned lecturer of THIS course, or staff.
// Two-tier model (documented in PRD): enrollment decisions (access control) need a
// CourseLecturer assignment; content writes (announcements/materials) accept any
// verified same-department lecturer via ownsCourse in authz.ts. Bootstrap fallback:
// a course with zero assignments still accepts verified same-department lecturers
// so legacy courses never lock out (assign the owner right after).
export async function canControlCourse(userId: string, role: string, courseId: string): Promise<boolean> {
  if (["deptAdmin", "institutionAdmin", "platformAdmin"].includes(role)) return true;
  if (role !== "lecturer") return false;
  const lect = await prisma.lecturerProfile.findUnique({ where: { userId } });
  if (!lect || lect.verificationStatus !== "verified") return false;
  const links = await prisma.courseLecturer.findMany({ where: { courseId } });
  if (links.length === 0) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    return !!course && course.departmentId === lect.departmentId;
  }
  return links.some((l: { lecturerId: string }) => l.lecturerId === lect.id);
}

export async function notifyUser(userId: string, type: string, title: string, body: string) {
  if (!userId || userId === "public") return;
  await prisma.notification.create({ data: { userId, type, title, body } });
}

export async function audit(actorId: string, action: string, targetType: string, targetId: string, meta?: string) {
  await prisma.auditLog.create({ data: { actorId, action, targetType, targetId, meta: meta ?? null } });
}
