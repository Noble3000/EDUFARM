// Academic Points Phase 2b (§12): slow, capped, non-cash economy.
// Rules (finalize ratios after modelling — current dev values):
//   assessment-pass: 10 pts when graded score ≥ 50% (once per assessment: capKey pass:{assessmentId}:{studentId})
//   lecturer-recognition: 5 pts, lecturer quota 20/week, same-student 2/week
//   NEVER for opens or purchases. Redemption: 10 kobo/pt, min 5000 pts, max 50% of price.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

export const POINTS_PER_PASS = 10;
export const RECOGNITION_POINTS = 5;
export const RECOGNITION_WEEKLY_QUOTA = 20;
export const RECOGNITION_SAME_STUDENT_WEEKLY = 2;
export const KOBO_PER_POINT = 10;
export const MIN_REDEEM_POINTS = 5000;

export async function balanceOf(studentId: string): Promise<number> {
  const rows = await prisma.pointLedger.findMany({ where: { studentId } });
  return rows.reduce((s, r) => s + r.amount, 0);
}

function weekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

// called from grade route: award pass points once
export async function awardPassPoints(studentId: string, assessmentId: string): Promise<boolean> {
  const capKey = `pass:${assessmentId}:${studentId}`;
  const existing = await prisma.pointLedger.findFirst({ where: { studentId, capKey } });
  if (existing) return false;
  await prisma.pointLedger.create({
    data: { studentId, amount: POINTS_PER_PASS, reason: "assessment-pass", capKey },
  });
  return true;
}

export async function pointsRoutes(app: FastifyInstance) {
  app.get("/points/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const balance = await balanceOf(user.studentProfile.id);
    const history = await prisma.pointLedger.findMany({
      where: { studentId: user.studentProfile.id }, orderBy: { createdAt: "desc" }, take: 30,
    });
    return { balance, tiers: ["early", "intermediate", "advanced", "long-term"], history };
  });

  // lecturer recognition (quota + caps enforced)
  app.post("/points/recognize", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.lecturerProfile) return reply.code(403).send({ error: "Lecturer only." });
    const b = req.body as { studentId: string; reason?: string };
    if (!b.studentId) return reply.code(400).send({ error: "studentId required." });
    const wk = weekKey();
    const weekCount = await prisma.pointLedger.count({
      where: { reason: "lecturer-recognition", capKey: { startsWith: `rec:${wk}:${user.lecturerProfile.id}:` } },
    });
    if (weekCount >= RECOGNITION_WEEKLY_QUOTA)
      return reply.code(429).send({ error: "Weekly recognition quota reached." });
    const sameCount = await prisma.pointLedger.count({
      where: { studentId: b.studentId, reason: "lecturer-recognition", capKey: `rec:${wk}:${user.lecturerProfile.id}:${b.studentId}` },
    });
    if (sameCount >= RECOGNITION_SAME_STUDENT_WEEKLY)
      return reply.code(429).send({ error: "Same-student weekly cap reached." });
    const entry = await prisma.pointLedger.create({
      data: {
        studentId: b.studentId, amount: RECOGNITION_POINTS, reason: "lecturer-recognition",
        capKey: `rec:${wk}:${user.lecturerProfile.id}:${b.studentId}`,
      },
    });
    return entry;
  });
}
