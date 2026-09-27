// Verification: student + lecturer request/approve flows (§5.1).
// Student: POST /verifications/student {universityId, facultyId, departmentId, levelId, matricNo}
//   → creates/updates StudentProfile (pending) → staff approve → verified.
// Lecturer: POST /verifications/lecturer {departmentId, staffId, bio}
//   → LecturerProfile (pending) → platform approve → verified.
// Queues: GET /verifications/pending?type=student|lecturer (staff only).
// Audit: every decision appended to AuditLog.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser, requireRole } from "../auth-dev.js";

const STAFF = ["deptAdmin", "institutionAdmin", "platformAdmin"];

export async function verificationRoutes(app: FastifyInstance) {
  // --- student request (any signed-in student user) ---
  app.post("/verifications/student", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = req.body as {
      universityId: string; facultyId: string; departmentId: string; levelId: string; matricNo: string;
    };
    if (!b.universityId || !b.matricNo) return reply.code(400).send({ error: "universityId + matricNo required." });
    const profile = await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        universityId: b.universityId, facultyId: b.facultyId, departmentId: b.departmentId,
        levelId: b.levelId, matricNo: b.matricNo, verificationStatus: "pending", verifiedAt: null,
      },
      create: {
        userId: user.id, universityId: b.universityId, facultyId: b.facultyId,
        departmentId: b.departmentId, levelId: b.levelId, matricNo: b.matricNo,
        verificationStatus: "pending",
      },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "student.verification.requested", targetType: "StudentProfile", targetId: profile.id },
    });
    return profile;
  });

  // --- lecturer request ---
  app.post("/verifications/lecturer", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = req.body as { departmentId: string; staffId: string; bio?: string };
    if (!b.departmentId || !b.staffId) return reply.code(400).send({ error: "departmentId + staffId required." });
    const profile = await prisma.lecturerProfile.upsert({
      where: { userId: user.id },
      update: { departmentId: b.departmentId, staffId: b.staffId, bio: b.bio, verificationStatus: "pending", verifiedAt: null },
      create: { userId: user.id, departmentId: b.departmentId, staffId: b.staffId, bio: b.bio, verificationStatus: "pending" },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "lecturer.verification.requested", targetType: "LecturerProfile", targetId: profile.id },
    });
    return profile;
  });

  // --- pending queues (staff) ---
  app.get("/verifications/pending", { preHandler: requireRole(...STAFF) }, async (req) => {
    const q = req.query as { type?: string };
    if (q.type === "lecturer") {
      return prisma.lecturerProfile.findMany({
        where: { verificationStatus: "pending" },
        include: { user: true, department: true },
        orderBy: { userId: "asc" },
      });
    }
    return prisma.studentProfile.findMany({
      where: { verificationStatus: "pending" },
      include: { user: true, university: true },
      orderBy: { userId: "asc" },
    });
  });

  // --- decide (staff): approve | reject ---
  app.post("/verifications/student/:id/decide", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await currentUser(req);
    const b = req.body as { decision: "approve" | "reject" };
    if (!["approve", "reject"].includes(b.decision)) return reply.code(400).send({ error: "decision must be approve|reject." });
    const profile = await prisma.studentProfile.update({
      where: { id },
      data: b.decision === "approve"
        ? { verificationStatus: "verified", verifiedAt: new Date() }
        : { verificationStatus: "rejected" },
    });
    await prisma.auditLog.create({
      data: { actorId: user!.id, action: `student.verification.${b.decision}d`, targetType: "StudentProfile", targetId: id },
    });
    return profile;
  });

  app.post("/verifications/lecturer/:id/decide", { preHandler: requireRole("platformAdmin", "institutionAdmin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await currentUser(req);
    const b = req.body as { decision: "approve" | "reject" };
    if (!["approve", "reject"].includes(b.decision)) return reply.code(400).send({ error: "decision must be approve|reject." });
    const profile = await prisma.lecturerProfile.update({
      where: { id },
      data: b.decision === "approve"
        ? { verificationStatus: "verified", verifiedAt: new Date() }
        : { verificationStatus: "rejected" },
    });
    await prisma.auditLog.create({
      data: { actorId: user!.id, action: `lecturer.verification.${b.decision}d`, targetType: "LecturerProfile", targetId: id },
    });
    return profile;
  });

  // --- me: my verification state ---
  app.get("/verifications/me", async (req) => {
    const user = await currentUser(req);
    if (!user) return { signedIn: false };
    return {
      signedIn: true, role: user.role,
      student: user.studentProfile ?? null,
      lecturer: user.lecturerProfile ?? null,
    };
  });
}
