// Dev auth (temporary): clients send x-user-id header; server loads User.
// Better Auth session-cookie wiring lands next (see auth.ts); this keeps
// Phase 1 visible in browser now with identical role checks.
// Usage: asPreHandler requireRole('lecturer' | 'platformAdmin' | ...)

import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";

export async function currentUser(req: FastifyRequest) {
  const id = req.headers["x-user-id"];
  if (!id || typeof id !== "string") return null;
  return prisma.user.findUnique({
    where: { id },
    include: { studentProfile: true, lecturerProfile: true },
  });
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await currentUser(req);
    if (!user) {
      reply.code(401).send({ error: "Missing x-user-id (dev auth). Sign in first." });
      return;
    }
    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: `Requires role: ${roles.join("|")}` });
      return;
    }
    (req as unknown as { authUser: typeof user }).authUser = user;
  };
}

export async function requireVerifiedStudent(req: FastifyRequest, reply: FastifyReply) {
  const user = await currentUser(req);
  if (!user || user.role !== "student") {
    reply.code(401).send({ error: "Student sign-in required." });
    return;
  }
  if (user.studentProfile?.verificationStatus !== "verified") {
    reply.code(403).send({ error: "Student verification required." });
    return;
  }
  (req as unknown as { authUser: typeof user }).authUser = user;
}
