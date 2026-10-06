// AI usage logging (§11): every call recorded for safety review, budgets,
// and quality eval. Question text is hashed (SHA-256) — full text is never
// persisted. Daily per-student budget enforced here.

import { createHash } from "node:crypto";
import { prisma } from "../db.js";
import { AI_DAILY_BUDGET } from "./policy.js";

export function questionHash(question: string): string {
  return createHash("sha256").update(question.slice(0, 2000)).digest("hex");
}

export async function overBudget(studentId: string): Promise<boolean> {
  const dayAgo = new Date(Date.now() - 86400_000);
  const count = await prisma.aiQueryLog.count({ where: { studentId, createdAt: { gte: dayAgo } } });
  return count >= AI_DAILY_BUDGET;
}

export async function logQuery(input: {
  studentId: string;
  courseId: string;
  question: string;
  grounded: boolean;
  refusalCode?: string | null;
  citationsCount: number;
  latencyMs: number;
  provider: string;
}): Promise<void> {
  await prisma.aiQueryLog.create({
    data: {
      studentId: input.studentId,
      courseId: input.courseId,
      questionHash: questionHash(input.question),
      grounded: input.grounded,
      refusalCode: input.refusalCode ?? null,
      citationsCount: input.citationsCount,
      latencyMs: input.latencyMs,
      provider: input.provider,
    },
  }).catch(() => {});
}
