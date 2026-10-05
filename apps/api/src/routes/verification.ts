// Verification journeys (§5.1): student + lecturer onboarding with a real state machine.
// States: unverified → pending → approved(=verified) | rejected | needsCorrection | suspended.
// needsCorrection/rejected → pending (resubmit with corrections). suspended → pending (reinstate).
// Verification NEVER grants course access: enrollment is a separate lecturer decision
// (see enrollments.ts). Every transition writes VerificationRecord + AuditLog + Notification.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser, requireRole } from "../authz.js";
import { assertChain, audit, notifyUser } from "../hierarchy-guard.js";

const STAFF = ["deptAdmin", "institutionAdmin", "platformAdmin"];
const DECISIONS = ["approve", "reject", "needsCorrection", "suspend", "reinstate"] as const;

function toProfileStatus(d: string): "verified" | "rejected" | "needsCorrection" | "suspended" | "pending" {
  if (d === "approve") return "verified";
  if (d === "reinstate") return "pending";
  if (d === "suspend") return "suspended";
  if (d === "reject") return "rejected";
  if (d === "needsCorrection") return "needsCorrection";
  throw Object.assign(new Error(`Unknown decision: ${d}.`), { statusCode: 400 });
}

function toRecordStatus(d: string): "approved" | "rejected" | "needsCorrection" | "suspended" | "pending" {
  if (d === "approve") return "approved";
  if (d === "reinstate") return "pending";
  if (d === "suspend") return "suspended";
  if (d === "reject") return "rejected";
  if (d === "needsCorrection") return "needsCorrection";
  throw Object.assign(new Error(`Unknown decision: ${d}.`), { statusCode: 400 });
}

const DECISION_COPY: Record<string, { title: string; body: string }> = {
  approve: { title: "Verification approved", body: "Your EDUFARM identity is verified. You can now request course access from your lecturers." },
  reject: { title: "Verification rejected", body: "Your verification request was rejected. Check the review note, correct your details, and resubmit." },
  needsCorrection: { title: "Verification needs correction", body: "Something in your request needs fixing. See the review note, correct it, and resubmit — your place in the queue is kept." },
  suspend: { title: "Verification suspended", body: "Your verified status is suspended pending review. Contact your institution admin. You keep read access to already-approved courses." },
  reinstate: { title: "Verification reinstated", body: "Your request is back in the review queue." },
};

export async function verificationRoutes(app: FastifyInstance) {
  // --- student request / resubmit (full chain enforced, no "" placeholders) ---
  app.post("/verifications/student", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = req.body as {
      universityId: string; facultyId: string; departmentId: string; levelId: string; matricNo: string;
    };
    if (!b.universityId || !b.facultyId || !b.departmentId || !b.levelId || !b.matricNo)
      return reply.code(400).send({ error: "university + faculty + department + level + matricNo required." });
    const chain = await assertChain(b);
    if (!chain.ok) return reply.code(400).send({ error: chain.error });
    const clash = await prisma.studentProfile.findFirst({
      where: { universityId: b.universityId, matricNo: b.matricNo, NOT: { userId: user.id } },
    });
    if (clash) return reply.code(400).send({ error: "This matric number is already registered at this university." });
    const prev = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    if (prev && !["unverified", "pending", "needsCorrection", "rejected"].includes(prev.verificationStatus))
      return reply.code(400).send({ error: `Cannot resubmit while ${prev.verificationStatus}. Contact your admin.` });
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
    await prisma.verificationRecord.create({
      data: { profileType: "student", studentProfileId: profile.id, status: "pending" },
    });
    await audit(user.id, prev ? "student.verification.resubmitted" : "student.verification.requested", "StudentProfile", profile.id);
    return profile;
  });

  // --- lecturer request / resubmit (must link a real department) ---
  app.post("/verifications/lecturer", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = req.body as { departmentId: string; staffId: string; bio?: string };
    if (!b.departmentId || !b.staffId) return reply.code(400).send({ error: "departmentId + staffId required." });
    const dept = await prisma.department.findUnique({ where: { id: b.departmentId } });
    if (!dept) return reply.code(400).send({ error: "Department not found." });
    const clash = await prisma.lecturerProfile.findFirst({
      where: { departmentId: b.departmentId, staffId: b.staffId, NOT: { userId: user.id } },
    });
    if (clash) return reply.code(400).send({ error: "This staff ID is already registered in this department." });
    const prev = await prisma.lecturerProfile.findUnique({ where: { userId: user.id } });
    if (prev && !["unverified", "pending", "needsCorrection", "rejected"].includes(prev.verificationStatus))
      return reply.code(400).send({ error: `Cannot resubmit while ${prev.verificationStatus}. Contact the platform admin.` });
    const profile = await prisma.lecturerProfile.upsert({
      where: { userId: user.id },
      update: { departmentId: b.departmentId, staffId: b.staffId, bio: b.bio, verificationStatus: "pending", verifiedAt: null },
      create: { userId: user.id, departmentId: b.departmentId, staffId: b.staffId, bio: b.bio, verificationStatus: "pending" },
    });
    await prisma.verificationRecord.create({
      data: { profileType: "lecturer", lecturerProfileId: profile.id, status: "pending" },
    });
    await audit(user.id, prev ? "lecturer.verification.resubmitted" : "lecturer.verification.requested", "LecturerProfile", profile.id);
    return profile;
  });

  // --- queues (staff): filter by state, default pending ---
  app.get("/verifications/pending", { preHandler: requireRole(...STAFF) }, async (req) => {
    const q = req.query as { type?: string; status?: string };
    const raw = (q.status ?? "pending").toLowerCase();
    const status = raw === "all"
      ? undefined
      : (["pending", "needsCorrection", "suspended", "rejected"].includes(raw) ? raw : "pending") as never;
    if (q.type === "lecturer") {
      return prisma.lecturerProfile.findMany({
        where: status ? { verificationStatus: status } : {},
        include: { user: true, department: { include: { faculty: { include: { university: true } } } } },
        orderBy: { userId: "asc" },
      });
    }
    return prisma.studentProfile.findMany({
      where: status ? { verificationStatus: status } : {},
      include: {
        user: true, university: true,
        faculty: true, department: true, level: true,
      },
      orderBy: { userId: "asc" },
    });
  });

  // --- history for one profile (staff + owner) ---
  app.get("/verifications/student/:id/history", async (req, reply) => {
    const user = await currentUser(req);
    const { id } = req.params as { id: string };
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) return reply.code(404).send({ error: "Profile not found." });
    if (!user || (user.id !== profile.userId && !STAFF.includes(user.role)))
      return reply.code(403).send({ error: "Not allowed." });
    return prisma.verificationRecord.findMany({
      where: { studentProfileId: id }, orderBy: { createdAt: "desc" },
    });
  });

  app.get("/verifications/lecturer/:id/history", async (req, reply) => {
    const user = await currentUser(req);
    const { id } = req.params as { id: string };
    const profile = await prisma.lecturerProfile.findUnique({ where: { id } });
    if (!profile) return reply.code(404).send({ error: "Profile not found." });
    if (!user || (user.id !== profile.userId && !["institutionAdmin", "platformAdmin"].includes(user.role)))
      return reply.code(403).send({ error: "Not allowed." });
    return prisma.verificationRecord.findMany({
      where: { lecturerProfileId: id }, orderBy: { createdAt: "desc" },
    });
  });

  // --- decide (staff): approve | reject | needsCorrection | suspend | reinstate ---
  async function decideStudent(id: string, reviewerId: string, decision: string, note?: string) {
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw Object.assign(new Error("Profile not found."), { statusCode: 404 });
    const allowed: Record<string, string[]> = {
      pending: ["approve", "reject", "needsCorrection"],
      needsCorrection: ["approve", "reject", "needsCorrection"],
      rejected: ["reinstate"],
      verified: ["suspend"],
      suspended: ["reinstate"],
    };
    if (!(allowed[profile.verificationStatus] ?? []).includes(decision))
      throw Object.assign(
        new Error(`Cannot ${decision} a ${profile.verificationStatus} request.`), { statusCode: 400 }
      );
    const next = toProfileStatus(decision);
    const updated = await prisma.studentProfile.update({
      where: { id },
      data: decision === "approve"
        ? { verificationStatus: next, verifiedAt: new Date() }
        : { verificationStatus: next, verifiedAt: null },
    });
    await prisma.verificationRecord.create({
      data: {
        profileType: "student", studentProfileId: id, status: toRecordStatus(decision),
        note: note ?? null, decidedBy: reviewerId, decidedAt: new Date(),
      },
    });
    await audit(reviewerId, `student.verification.${decision}d`, "StudentProfile", id, note);
    const copy = DECISION_COPY[decision];
    await notifyUser(profile.userId, `verification.${decision}`, copy.title, `${copy.body}${note ? ` Note: ${note}` : ""}`);
    return updated;
  }

  app.post("/verifications/student/:id/decide", { preHandler: requireRole(...STAFF) }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await currentUser(req);
    const b = req.body as { decision: string; note?: string };
    if (!DECISIONS.includes(b.decision as never))
      return reply.code(400).send({ error: "decision must be approve|reject|needsCorrection|suspend|reinstate." });
    try {
      return await decideStudent(id, user!.id, b.decision, b.note);
    } catch (e) {
      return reply.code((e as { statusCode?: number }).statusCode ?? 500).send({ error: (e as Error).message });
    }
  });

  app.post("/verifications/lecturer/:id/decide", { preHandler: requireRole("platformAdmin", "institutionAdmin") }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await currentUser(req);
    const b = req.body as { decision: string; note?: string };
    if (!DECISIONS.includes(b.decision as never))
      return reply.code(400).send({ error: "decision must be approve|reject|needsCorrection|suspend|reinstate." });
    const profile = await prisma.lecturerProfile.findUnique({ where: { id } });
    if (!profile) return reply.code(404).send({ error: "Profile not found." });
    const allowed: Record<string, string[]> = {
      pending: ["approve", "reject", "needsCorrection"],
      needsCorrection: ["approve", "reject", "needsCorrection"],
      rejected: ["reinstate"],
      verified: ["suspend"],
      suspended: ["reinstate"],
    };
    if (!(allowed[profile.verificationStatus] ?? []).includes(b.decision))
      return reply.code(400).send({ error: `Cannot ${b.decision} a ${profile.verificationStatus} request.` });
    const next = toProfileStatus(b.decision);
    const updated = await prisma.lecturerProfile.update({
      where: { id },
      data: b.decision === "approve"
        ? { verificationStatus: next, verifiedAt: new Date() }
        : { verificationStatus: next, verifiedAt: null },
    });
    await prisma.verificationRecord.create({
      data: {
        profileType: "lecturer", lecturerProfileId: id, status: toRecordStatus(b.decision),
        note: b.note ?? null, decidedBy: user!.id, decidedAt: new Date(),
      },
    });
    await audit(user!.id, `lecturer.verification.${b.decision}d`, "LecturerProfile", id, b.note);
    const copy = DECISION_COPY[b.decision];
    await notifyUser(profile.userId, `verification.${b.decision}`, copy.title, `${copy.body}${b.note ? ` Note: ${b.note}` : ""}`);
    return updated;
  });

  // --- me: my verification state (student/lecturer + studentProfile/lecturerProfile aliases) ---
  app.get("/verifications/me", async (req) => {
    const user = await currentUser(req);
    if (!user) return { signedIn: false };
    return {
      signedIn: true, role: user.role,
      student: user.studentProfile ?? null,
      lecturer: user.lecturerProfile ?? null,
      studentProfile: user.studentProfile ?? null,
      lecturerProfile: user.lecturerProfile ?? null,
    };
  });
}
