// Local email+password auth — Step 1 of hardening (Better Auth cookies land in Step 2).
// Signup is role-aware per PRD §5.1:
//   student  → User(role=student) + StudentProfile(pending) — institution verifies.
//   lecturer → User(role=lecturer) + LecturerProfile(pending) — platform verifies.
//   admin    → NOT self-service: use POST /access-requests (reviewed in disputes queue)
//              or POST /admin/users (existing platformAdmin creates staff).
// Passwords: node:crypto scrypt (salted, no new deps). Clients keep sending
// x-user-id until Step 2 swaps it for Better Auth session cookies (no UI change needed).

import type { FastifyInstance } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";

function hash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const dk = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${dk}`;
}

function verify(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [algo, salt, dk] = stored.split("$");
  if (algo !== "scrypt" || !salt || !dk) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(dk, "hex");
  return check.length === expected.length && timingSafeEqual(check, expected);
}

function publicUser(u: Record<string, unknown>) {
  const { passwordHash: _drop, ...safe } = u as { passwordHash?: string };
  return safe;
}

export async function authLocalRoutes(app: FastifyInstance) {
  // --- sign up (student | lecturer) ---
  app.post("/auth/signup", async (req, reply) => {
    const b = req.body as {
      name: string; email: string; password: string; role: string;
      universityId?: string; facultyId?: string; departmentId?: string; levelId?: string; matricNo?: string;
      staffId?: string; bio?: string;
    };
    if (!b.name || !b.email || !b.password || !["student", "lecturer"].includes(b.role))
      return reply.code(400).send({ error: "name + email + password + role(student|lecturer) required." });
    if (b.password.length < 8) return reply.code(400).send({ error: "Password must be 8+ characters." });
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) return reply.code(400).send({ error: "Email already registered. Sign in instead." });
    if (b.role === "student" && (!b.universityId || !b.matricNo))
      return reply.code(400).send({ error: "Students: choose institution + matric number (verification)." });
    if (b.role === "lecturer" && (!b.departmentId || !b.staffId))
      return reply.code(400).send({ error: "Lecturers: choose department + staff ID (verification)." });

    const user = await prisma.user.create({
      data: { name: b.name, email: b.email, passwordHash: hash(b.password), role: b.role as never },
      include: { studentProfile: true, lecturerProfile: true },
    });
    if (b.role === "student") {
      await prisma.studentProfile.create({
        data: {
          userId: user.id, universityId: b.universityId!, facultyId: b.facultyId ?? "",
          departmentId: b.departmentId ?? "", levelId: b.levelId ?? "",
          matricNo: b.matricNo!, verificationStatus: "pending",
        },
      });
    } else {
      await prisma.lecturerProfile.create({
        data: {
          userId: user.id, departmentId: b.departmentId!, staffId: b.staffId!,
          bio: b.bio, verificationStatus: "pending",
        },
      });
    }
    await prisma.auditLog.create({
      data: { actorId: user.id, action: `${b.role}.signup`, targetType: "User", targetId: user.id },
    });
    const full = await prisma.user.findUnique({
      where: { id: user.id }, include: { studentProfile: true, lecturerProfile: true },
    });
    return publicUser(full as unknown as Record<string, unknown>);
  });

  // --- sign in ---
  app.post("/auth/login", async (req, reply) => {
    const b = (req.body ?? {}) as { email?: string; password?: string };
    if (!b.email || !b.password) return reply.code(400).send({ error: "email + password required." });
    const user = await prisma.user.findUnique({
      where: { email: b.email }, include: { studentProfile: true, lecturerProfile: true },
    });
    if (!user || !verify(b.password, user.passwordHash))
      return reply.code(401).send({ error: "Invalid email or password." });
    return publicUser(user as unknown as Record<string, unknown>);
  });

  // --- admin access request (reviewed in disputes queue as AccessRequest) ---
  app.post("/access-requests", async (req, reply) => {
    const b = req.body as { name: string; email: string; role: string; reason: string };
    if (!b.name || !b.email || !b.reason)
      return reply.code(400).send({ error: "name + email + reason required." });
    const dispute = await prisma.dispute.create({
      data: {
        reporterId: "public", targetType: "AccessRequest", targetId: `${b.role ?? "staff"}:${b.email}`,
        reason: `${b.name} — ${b.reason}`, status: "open",
      },
    });
    return { ...dispute, note: "A platform admin will review your request." };
  });

  // --- platform admin creates staff accounts directly ---
  app.post("/admin/users", async (req, reply) => {
    const { currentUser } = await import("../auth-dev.js");
    const admin = await currentUser(req);
    if (!admin || admin.role !== "platformAdmin")
      return reply.code(403).send({ error: "Platform admin only." });
    const b = req.body as { name: string; email: string; password: string; role: string };
    if (!b.name || !b.email || !b.password || !["deptAdmin", "institutionAdmin", "platformAdmin", "lecturer", "student"].includes(b.role))
      return reply.code(400).send({ error: "name + email + password + valid role required." });
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) return reply.code(400).send({ error: "Email already registered." });
    const created = await prisma.user.create({
      data: { name: b.name, email: b.email, passwordHash: hash(b.password), role: b.role as never },
    });
    await prisma.auditLog.create({
      data: { actorId: admin.id, action: "admin.user.created", targetType: "User", targetId: created.id, meta: b.role },
    });
    return publicUser(created as unknown as Record<string, unknown>);
  });
}
