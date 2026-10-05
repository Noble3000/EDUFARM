// Local email+password auth, hardened (Better Auth architecture unchanged:
// same Session/User tables, same scrypt passwords; cookies/sessions now real).
// Every successful auth issues an opaque session token (client stores it, sends as
// `Authorization: Bearer`, `x-session-token`, or `edufarm_session` cookie).
// Raw user ids are never accepted anywhere (see authz.ts).
// Sensitive actions audited: signup, login success/failure, logout, suspend,
// unsuspend, password change, staff creation.

import type { FastifyInstance } from "fastify";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";
import { assertChain } from "../hierarchy-guard.js";
import {
  audit,
  issueSession,
  requireAuth,
  requireRole,
  revokeAllSessions,
  revokeSession,
  sessionUser,
} from "../authz.js";

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

async function withSession(userId: string) {
  const full = await prisma.user.findUnique({
    where: { id: userId }, include: { studentProfile: true, lecturerProfile: true },
  });
  const { token, expiresAt } = await issueSession(userId);
  return { ...publicUser(full as unknown as Record<string, unknown>), sessionToken: token, sessionExpiresAt: expiresAt };
}

export async function authLocalRoutes(app: FastifyInstance) {
  // --- sign up (student | lecturer) ---
  // Brute-force budget is env-tunable (default 10/min); tests raise it.
  app.post("/auth/signup", { config: { rateLimit: { max: Number(process.env.AUTH_LOGIN_MAX ?? 10), timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = req.body as {
      name: string; email: string; password: string; role: string;
      universityId?: string; facultyId?: string; departmentId?: string; levelId?: string; matricNo?: string;
      staffId?: string; bio?: string;
    };
    if (!b.name || !b.email || !b.password || !["student", "lecturer"].includes(b.role))
      return reply.code(400).send({ error: "auth-invalid: name + email + password + role(student|lecturer) required." });
    if (b.password.length < 8) return reply.code(400).send({ error: "auth-invalid: password must be 8+ characters." });
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) return reply.code(400).send({ error: "auth-taken: email already registered. Sign in instead." });
    if (b.role === "student" && (!b.universityId || !b.matricNo))
      return reply.code(400).send({ error: "auth-invalid: students choose institution + matric number (verification)." });
    if (b.role === "lecturer" && (!b.departmentId || !b.staffId))
      return reply.code(400).send({ error: "auth-invalid: lecturers choose department + staff ID (verification)." });
    // full chain enforced at signup — no placeholder links allowed
    if (b.role === "student") {
      if (!b.facultyId || !b.departmentId || !b.levelId)
        return reply.code(400).send({ error: "auth-invalid: students choose faculty + department + level (verification)." });
      const chain = await assertChain({
        universityId: b.universityId!, facultyId: b.facultyId,
        departmentId: b.departmentId!, levelId: b.levelId,
      });
      if (!chain.ok) return reply.code(400).send({ error: `auth-invalid: ${chain.error}` });
      const clash = await prisma.studentProfile.findFirst({
        where: { universityId: b.universityId!, matricNo: b.matricNo! },
      });
      if (clash) return reply.code(400).send({ error: "auth-taken: matric number already registered at this university." });
    } else {
      const dept = await prisma.department.findUnique({ where: { id: b.departmentId! } });
      if (!dept) return reply.code(400).send({ error: "auth-invalid: department not found." });
      const clash = await prisma.lecturerProfile.findFirst({
        where: { departmentId: b.departmentId!, staffId: b.staffId! },
      });
      if (clash) return reply.code(400).send({ error: "auth-taken: staff ID already registered in this department." });
    }

    const user = await prisma.user.create({
      data: { name: b.name, email: b.email, passwordHash: hash(b.password), role: b.role as never },
    });
    if (b.role === "student") {
      const profile = await prisma.studentProfile.create({
        data: {
          userId: user.id, universityId: b.universityId!, facultyId: b.facultyId!,
          departmentId: b.departmentId!, levelId: b.levelId!,
          matricNo: b.matricNo!, verificationStatus: "pending",
        },
      });
      await prisma.verificationRecord.create({
        data: { profileType: "student", studentProfileId: profile.id, status: "pending" },
      });
    } else {
      const profile = await prisma.lecturerProfile.create({
        data: {
          userId: user.id, departmentId: b.departmentId!, staffId: b.staffId!,
          bio: b.bio, verificationStatus: "pending",
        },
      });
      await prisma.verificationRecord.create({
        data: { profileType: "lecturer", lecturerProfileId: profile.id, status: "pending" },
      });
    }
    await audit(user.id, `${b.role}.signup`, "User", user.id);
    const out = await withSession(user.id);
    reply.header("Set-Cookie", `edufarm_session=${out.sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return out;
  });

  // --- sign in ---
  app.post("/auth/login", { config: { rateLimit: { max: Number(process.env.AUTH_LOGIN_MAX ?? 10), timeWindow: "1 minute" } } }, async (req, reply) => {
    const b = (req.body ?? {}) as { email?: string; password?: string };
    if (!b.email || !b.password) return reply.code(400).send({ error: "auth-invalid: email + password required." });
    const user = await prisma.user.findUnique({
      where: { email: b.email }, include: { studentProfile: true, lecturerProfile: true },
    });
    if (!user || !verify(b.password, user.passwordHash)) {
      // Audit failures without storing passwords; actorId is the account when it exists.
      await audit(user?.id ?? "unknown", "auth.login.failed", "User", user?.id ?? b.email);
      return reply.code(401).send({ error: "auth-required" });
    }
    if (user.suspended) {
      await audit(user.id, "auth.login.blocked-suspended", "User", user.id);
      return reply.code(403).send({ error: "forbidden:account-suspended" });
    }
    await audit(user.id, "auth.login", "User", user.id);
    const out = await withSession(user.id);
    reply.header("Set-Cookie", `edufarm_session=${out.sessionToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return out;
  });

  // --- sign out (invalidates this session) ---
  app.post("/auth/logout", async (req, reply) => {
    const user = await sessionUser(req);
    const ok = await revokeSession(req);
    if (user) await audit(user.id, "auth.logout", "User", user.id);
    reply.header("Set-Cookie", "edufarm_session=; HttpOnly; Path=/; Max-Age=0");
    return { ok };
  });

  // --- current session (refreshes sliding expiry) ---
  app.get("/auth/session", async (req, reply) => {
    const user = await sessionUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    return publicUser(user as unknown as Record<string, unknown>);
  });

  // --- change password (revokes all other sessions) ---
  app.post("/auth/password", { preHandler: requireAuth() }, async (req, reply) => {
    const user = req.authUser!;
    const b = req.body as { currentPassword?: string; newPassword?: string };
    if (!b.currentPassword || !b.newPassword || b.newPassword.length < 8)
      return reply.code(400).send({ error: "auth-invalid: current + new (8+) password required." });
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row || !verify(b.currentPassword, row.passwordHash))
      return reply.code(401).send({ error: "auth-required" });
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash(b.newPassword) } });
    // Revoke every session (including this one) and issue a fresh token.
    await revokeAllSessions(user.id);
    const { token, expiresAt } = await issueSession(user.id);
    await audit(user.id, "auth.password.changed", "User", user.id);
    reply.header("Set-Cookie", `edufarm_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
    return { ok: true, sessionToken: token, sessionExpiresAt: expiresAt };
  });

  // --- suspend / unsuspend (platformAdmin only; suspend kills sessions immediately) ---
  app.post("/admin/users/:id/suspend", { preHandler: requireRole("platformAdmin") }, async (req, reply) => {
    const admin = req.authUser!;
    const { id } = req.params as { id: string };
    if (id === admin.id) return reply.code(400).send({ error: "auth-invalid: cannot suspend yourself." });
    await prisma.user.update({ where: { id }, data: { suspended: true } });
    const killed = await revokeAllSessions(id);
    await audit(admin.id, "admin.user.suspended", "User", id, `sessions=${killed}`);
    return { ok: true, sessionsRevoked: killed };
  });

  app.post("/admin/users/:id/unsuspend", { preHandler: requireRole("platformAdmin") }, async (req, reply) => {
    const admin = req.authUser!;
    const { id } = req.params as { id: string };
    await prisma.user.update({ where: { id }, data: { suspended: false } });
    await audit(admin.id, "admin.user.unsuspended", "User", id);
    return { ok: true };
  });

  // --- admin access request (reviewed in disputes queue as AccessRequest) ---
  app.post("/access-requests", async (req, reply) => {
    const b = req.body as { name: string; email: string; role: string; reason: string };
    if (!b.name || !b.email || !b.reason)
      return reply.code(400).send({ error: "auth-invalid: name + email + reason required." });
    const dispute = await prisma.dispute.create({
      data: {
        reporterId: "public", targetType: "AccessRequest", targetId: `${b.role ?? "staff"}:${b.email}`,
        reason: `${b.name} — ${b.reason}`, status: "open",
      },
    });
    return { ...dispute, note: "A platform admin will review your request." };
  });

  // --- platform admin creates staff accounts directly ---
  app.post("/admin/users", { preHandler: requireRole("platformAdmin") }, async (req, reply) => {
    const admin = req.authUser!;
    const b = req.body as { name: string; email: string; password: string; role: string };
    if (!b.name || !b.email || !b.password || !["deptAdmin", "institutionAdmin", "platformAdmin", "lecturer", "student"].includes(b.role))
      return reply.code(400).send({ error: "auth-invalid: name + email + password + valid role required." });
    if (b.password.length < 8) return reply.code(400).send({ error: "auth-invalid: password must be 8+ characters." });
    const existing = await prisma.user.findUnique({ where: { email: b.email } });
    if (existing) return reply.code(400).send({ error: "auth-taken: email already registered." });
    const created = await prisma.user.create({
      data: { name: b.name, email: b.email, passwordHash: hash(b.password), role: b.role as never },
    });
    await audit(admin.id, "admin.user.created", "User", created.id, b.role);
    return publicUser(created as unknown as Record<string, unknown>);
  });
}
