// Centralized authorization (auth hardening, Better Auth architecture unchanged).
// Sessions: opaque tokens issued at login/signup/demo-login, SHA-256 hashed in
// the Better Auth-compatible Session table, 30-day sliding expiry.
// Clients send the token as `Authorization: Bearer <token>` (preferred),
// `x-session-token` header, or `edufarm_session` cookie. Raw user ids are
// NEVER accepted (fixes header spoofing). Roles always come from the DB row,
// never from browser input.
// Standard responses: 401 {error:"auth-required"} (missing/invalid/expired),
// 403 {error:"forbidden:<reason>"} (valid session, insufficient rights).

import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";

export const SESSION_TTL_MS = 30 * 86400_000;
export const SESSION_REFRESH_MS = 7 * 86400_000;

export type AuthUser = NonNullable<Awaited<ReturnType<typeof loadUser>>>;

async function loadUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true, lecturerProfile: true },
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenFrom(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h && typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7).trim() || null;
  const x = req.headers["x-session-token"];
  if (x && typeof x === "string" && x) return x;
  const cookie = req.headers.cookie;
  if (cookie && typeof cookie === "string") {
    const m = cookie.match(/(?:^|;\s*)edufarm_session=([^;]+)/);
    if (m) return decodeURIComponent(m[1].trim()) || null;
  }
  return null;
}

// Issue a session for a user id. Returns the PLAINTEXT token (show once).
export async function issueSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { userId, token: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

// Validate token → user (null when missing/invalid/expired/suspended).
// Sliding refresh: extends expiry when <7d remain.
export async function sessionUser(req: FastifyRequest): Promise<AuthUser | null> {
  const token = tokenFrom(req);
  if (!token) return null;
  const row = await prisma.session.findFirst({
    where: { token: hashToken(token) },
    include: { user: { include: { studentProfile: true, lecturerProfile: true } } },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) await prisma.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (row.user.suspended) return null;
  if (row.expiresAt.getTime() - Date.now() < SESSION_TTL_MS - SESSION_REFRESH_MS) {
    await prisma.session.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    }).catch(() => {});
  }
  return row.user as AuthUser;
}

// Invalidate one session (logout) or all of a user's sessions (password change, suspend).
export async function revokeSession(req: FastifyRequest): Promise<boolean> {
  const token = tokenFrom(req);
  if (!token) return false;
  const r = await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  return r.count > 0;
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const r = await prisma.session.deleteMany({ where: { userId } });
  return r.count;
}

function deny(reply: FastifyReply, code: 401 | 403, reason: string) {
  reply.code(code).send({ error: code === 401 ? "auth-required" : `forbidden:${reason}` });
}

// Guards (use as preHandler). On success sets req.authUser.
declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

async function load(req: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> {
  const user = await sessionUser(req);
  if (!user) {
    deny(reply, 401, "signed-in");
    return null;
  }
  req.authUser = user;
  return user;
}

export function requireAuth() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await load(req, reply);
  };
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await load(req, reply);
    if (!user) return;
    if (!roles.includes(user.role)) {
      deny(reply, 403, `role:${roles.join("|")}`);
      return;
    }
  };
}

export function requireVerifiedStudent() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await load(req, reply);
    if (!user) return;
    if (user.role !== "student" || !user.studentProfile) {
      deny(reply, 403, "role:student");
      return;
    }
    if (user.studentProfile.verificationStatus !== "verified") {
      deny(reply, 403, "student-unverified");
      return;
    }
  };
}

export function requireVerifiedLecturer() {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await load(req, reply);
    if (!user) return;
    if (user.role !== "lecturer" || !user.lecturerProfile) {
      deny(reply, 403, "role:lecturer");
      return;
    }
    if (user.lecturerProfile.verificationStatus !== "verified") {
      deny(reply, 403, "lecturer-unverified");
      return;
    }
  };
}

export const STAFF_ROLES: AuthUser["role"][] = ["deptAdmin", "institutionAdmin", "platformAdmin"];
export const LECTURER_ROLES: AuthUser["role"][] = ["lecturer", ...STAFF_ROLES];

// Lecturer (or staff) acting inside their own department's course.
// Platform admins bypass scoping. Returns the course or denies.
// Here :id is the COURSE id (list-style routes, insights).
export async function requireCourseLecturer(req: FastifyRequest, reply: FastifyReply) {
  const user = await load(req, reply);
  if (!user) return null;
  const { id } = req.params as { id: string };
  if (user.role === "platformAdmin") {
    return prisma.course.findUnique({ where: { id } });
  }
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    reply.code(404).send({ error: "not-found:course" });
    return null;
  }
  if (await ownsCourse(user, course)) {
    req.authUser = user;
    return course;
  }
  deny(reply, 403, "course-ownership");
  return null;
}

// Boolean version for routes whose :id is NOT the course (material,
// enrollment, attempt…). Caller loads the course itself first.
// Grants: explicit CourseLecturer assignment, same-department verified
// lecturer, institution/platform admin. Everyone else (incl. deptAdmin
// until staff scoping lands) is denied — fail closed.
export async function ownsCourse(
  user: AuthUser,
  course: { id: string; departmentId: string } | null,
): Promise<boolean> {
  if (!course) return false;
  if (user.role === "platformAdmin" || user.role === "institutionAdmin") return true;
  if (user.role === "lecturer" && user.lecturerProfile) {
    if (user.lecturerProfile.verificationStatus !== "verified") return false;
    const link = await prisma.courseLecturer.findUnique({
      where: { courseId_lecturerId: { courseId: course.id, lecturerId: user.lecturerProfile.id } },
    }).catch(() => null);
    if (link) return true;
    return course.departmentId === user.lecturerProfile.departmentId;
  }
  return false;
}

export async function audit(actorId: string, action: string, targetType: string, targetId: string, meta?: string | null) {
  await prisma.auditLog.create({
    data: { actorId, action, targetType, targetId, meta: meta ?? null },
  }).catch(() => {});
}
