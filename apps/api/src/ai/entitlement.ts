// Entitlement firewall (§11): the single gate between a student and content.
// NOTHING reaches retrieval, prompts, or citations without passing here.
// Rules: approved enrollment in the course; per-material grant (free, or
// completed purchase); optional single-material scoping (Ask This Material).

import { prisma } from "../db.js";

export interface Entitlement {
  courseId: string;
  studentId: string;
  materialIds: string[];
}

export async function resolveEntitlement(
  courseId: string,
  studentId: string,
  materialId?: string,
): Promise<{ ok: true; entitlement: Entitlement } | { ok: false; reason: string }> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { courseId_studentId: { courseId, studentId } },
  });
  if (!enrollment || enrollment.status !== "approved")
    return { ok: false, reason: "course-access" };
  const mats = await prisma.material.findMany({ where: { courseId, status: "published" }, select: { id: true, isFree: true } });
  const purchases = await prisma.purchase.findMany({
    where: { studentId, status: "completed", materialId: { not: null } },
    select: { materialId: true },
  });
  const owned = new Set(purchases.map((p) => p.materialId as string));
  let ids = mats.filter((m) => m.isFree || owned.has(m.id)).map((m) => m.id);
  if (materialId) {
    if (!ids.includes(materialId)) return { ok: false, reason: "material-access" };
    ids = [materialId];
  }
  return { ok: true, entitlement: { courseId, studentId, materialIds: ids } };
}
