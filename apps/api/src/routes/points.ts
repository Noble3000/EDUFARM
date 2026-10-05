// Academic Points Phase 2b (§12), hardened as a financial-adjacent subsystem.
// All awardable events live in points-policy.ts — anything not listed there
// CANNOT award. Every award records event, user, amount, source reference,
// timestamp, rule version, and idempotency key; the (studentId, capKey)
// unique constraint makes concurrent duplicates collapse to one row.
// Invariants: non-cash · no withdrawal · slow · high thresholds · capped ·
// never for opens or purchases.

import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { prisma } from "../db.js";
import { audit, sessionUser as currentUser } from "../authz.js";
import {
  POINTS_EVENTS,
  POINTS_QUOTAS,
  POINTS_REDEMPTION,
  POINTS_RULE_VERSION,
} from "../points-policy.js";

export const POINTS_PER_PASS = POINTS_EVENTS["assessment-pass"].amount;
export { POINTS_RULE_VERSION };export const RECOGNITION_POINTS = POINTS_EVENTS["lecturer-recognition"].amount;
export const RECOGNITION_WEEKLY_QUOTA = POINTS_QUOTAS.recognitionWeeklyPerLecturer;
export const RECOGNITION_SAME_STUDENT_WEEKLY = POINTS_QUOTAS.recognitionWeeklyPerLecturerPerStudent;
export const KOBO_PER_POINT = POINTS_REDEMPTION.koboPerPoint;
export const MIN_REDEEM_POINTS = POINTS_REDEMPTION.minRedeemPoints;

export async function balanceOf(studentId: string): Promise<number> {
  const rows = await prisma.pointLedger.findMany({ where: { studentId } });
  return rows.reduce((s, r) => s + r.amount, 0);
}

function weekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export interface AwardInput {
  studentId: string;
  /** Must be a key of POINTS_EVENTS — unknown events are rejected, never minted. */
  event: string;
  /** Stable source reference, e.g. assessment id, attempt id, lecturer id. */
  sourceRef: string;
  /** Caller-built idempotency key (unique per student). */
  capKey: string;
  actorId: string;
}

export async function awardPoints(input: AwardInput): Promise<{ awarded: boolean; duplicate: boolean }> {
  const policy = POINTS_EVENTS[input.event];
  if (!policy) throw new Error(`auth-invalid: unknown points event '${input.event}'.`);
  try {
    await prisma.pointLedger.create({
      data: {
        studentId: input.studentId,
        amount: policy.amount,
        reason: policy.key,
        capKey: input.capKey,
        sourceRef: input.sourceRef,
        ruleVersion: POINTS_RULE_VERSION,
      },
    });
  } catch (e) {
    // P2002 unique violation = an identical award already exists (replay,
    // retry, webhook duplication, or concurrent request). Swallow as duplicate.
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      await audit(input.actorId, "points.duplicate-blocked", "PointLedger", input.capKey, `${policy.key} ${input.sourceRef}`);
      return { awarded: false, duplicate: true };
    }
    throw e;
  }
  await audit(input.actorId, "points.awarded", "PointLedger", input.capKey, `+${policy.amount} ${policy.key} rule=${POINTS_RULE_VERSION}`);
  return { awarded: true, duplicate: false };
}

// called from grade route: award pass points once per assessment
export async function awardPassPoints(studentId: string, assessmentId: string): Promise<boolean> {
  const r = await awardPoints({
    studentId,
    event: "assessment-pass",
    sourceRef: assessmentId,
    capKey: `pass:${assessmentId}:${studentId}`,
    actorId: studentId,
  });
  return r.awarded;
}

export async function pointsRoutes(app: FastifyInstance) {
  app.get("/points/me", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const balance = await balanceOf(user.studentProfile.id);
    const history = await prisma.pointLedger.findMany({
      where: { studentId: user.studentProfile.id }, orderBy: { createdAt: "desc" }, take: 30,
    });
    return { balance, tiers: ["early", "intermediate", "advanced", "long-term"], history, ruleVersion: POINTS_RULE_VERSION };
  });

  // public policy document (inspectable rules; amounts carry TODO markers in code)
  app.get("/points/policy", async () => ({
    ruleVersion: POINTS_RULE_VERSION,
    events: Object.values(POINTS_EVENTS),
    quotas: POINTS_QUOTAS,
    redemption: POINTS_REDEMPTION,
  }));

  // lecturer recognition (quota + caps + idempotency + audit)
  app.post(
    "/points/recognize",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const user = await currentUser(req);
      if (!user?.lecturerProfile) return reply.code(403).send({ error: "forbidden:role:lecturer" });
      const b = req.body as { studentId: string; reason?: string; idempotencyKey?: string };
      if (!b.studentId) return reply.code(400).send({ error: "auth-invalid: studentId required." });
      const wk = weekKey();
      const weekCount = await prisma.pointLedger.count({
        where: { reason: "lecturer-recognition", capKey: { startsWith: `rec:${wk}:${user.lecturerProfile.id}:` } },
      });
      if (weekCount >= RECOGNITION_WEEKLY_QUOTA)
        return reply.code(429).send({ error: "forbidden:quota: weekly recognition quota reached." });
      const sameCount = await prisma.pointLedger.count({
        where: {
          studentId: b.studentId, reason: "lecturer-recognition",
          capKey: { startsWith: `rec:${wk}:${user.lecturerProfile.id}:${b.studentId}:` },
        },
      });
      if (sameCount >= RECOGNITION_SAME_STUDENT_WEEKLY)
        return reply.code(429).send({ error: "forbidden:quota: same-student weekly cap reached." });
      const nonce = (b.idempotencyKey ?? randomBytes(4).toString("hex")).slice(0, 32);
      const r = await awardPoints({
        studentId: b.studentId,
        event: "lecturer-recognition",
        sourceRef: user.lecturerProfile.id,
        capKey: `rec:${wk}:${user.lecturerProfile.id}:${b.studentId}:${nonce}`,
        actorId: user.id,
      });
      if (!r.awarded) return reply.code(409).send({ error: "forbidden:duplicate: recognition already recorded." });
      return { ok: true, amount: RECOGNITION_POINTS, ruleVersion: POINTS_RULE_VERSION };
    },
  );
}
