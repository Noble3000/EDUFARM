// EDUFARM API application factory (no listen here — see main.ts).
// Importable by matrix tests via fastify.inject against the test database.
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { prisma } from "./db.js";
import { issueSession } from "./authz.js";
import { hierarchyRoutes } from "./routes/hierarchy.js";
import { verificationRoutes } from "./routes/verification.js";
import { enrollmentRoutes } from "./routes/enrollments.js";
import { announcementRoutes } from "./routes/announcements.js";
import { qaRoutes } from "./routes/qa.js";
import { materialRoutes } from "./routes/materials.js";
import { purchaseRoutes } from "./routes/purchases.js";
import { progressRoutes } from "./routes/progress.js";
import { assessmentRoutes } from "./routes/assessments.js";
import { pointsRoutes } from "./routes/points.js";
import { settlementRoutes } from "./routes/settlement.js";
import { reviewRoutes } from "./routes/reviews.js";
import { emailRoutes } from "./routes/email.js";
import { aiRoutes } from "./routes/ai.js";
import { devotionalRoutes } from "./routes/devotional.js";
import { authLocalRoutes } from "./routes/auth-local.js";
import { gradesRoutes } from "./routes/grades.js";
import { storageRoutes } from "./routes/storage.js";

const demoOpen = () => process.env.ALLOW_DEMO_LOGIN === "true";

function publicUser(u: Record<string, unknown>) {
  const { passwordHash: _drop, ...safe } = u as { passwordHash?: string };
  return safe;
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/],
    credentials: true,
  });
  // Global: generous (local dev + tunnels). Auth/AI get strict budgets below.
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  // Sanitized errors: never leak ORM internals; log server-side with an id.
  app.setErrorHandler((error, _req, reply) => {
    const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (status >= 500) {
      const id = `err-${Date.now().toString(36)}`;
      app.log.error({ id, err: error }, "unhandled");
      reply.code(500).send({ error: "internal", id });
      return;
    }
    reply.code(status).send({ error: error.message ?? "bad-request" });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "edufarm-api",
    auth: "session (better-auth tables)",
    demo: demoOpen() ? "open" : "closed",
  }));

  // Demo login: passwordless convenience for LOCAL demos only.
  // Closed unless ALLOW_DEMO_LOGIN=true. Issues a real revocable session
  // (same as password login) — never exposes raw user ids.
  app.post(
    "/api/v1/demo/login",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!demoOpen()) return reply.code(403).send({ error: "forbidden:demo-closed" });
      const b = (req.body ?? {}) as { email?: string };
      if (!b.email) return reply.code(400).send({ error: "auth-invalid: email required." });
      const user = await prisma.user.findUnique({
        where: { email: b.email },
        include: { studentProfile: true, lecturerProfile: true },
      });
      if (!user || user.suspended) return reply.code(404).send({ error: "auth-invalid: unknown email." });
      const { token, expiresAt } = await issueSession(user.id);
      reply.header("Set-Cookie", `edufarm_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`);
      return { ...publicUser(user as unknown as Record<string, unknown>), sessionToken: token, sessionExpiresAt: expiresAt };
    },
  );

  app.get("/api/v1/demo/users", async (_req, reply) => {
    if (!demoOpen()) return reply.code(403).send({ error: "forbidden:demo-closed" });
    const users = await prisma.user.findMany({ select: { email: true, name: true, role: true } });
    return users;
  });

  await app.register(hierarchyRoutes, { prefix: "/api/v1" });
  await app.register(verificationRoutes, { prefix: "/api/v1" });
  await app.register(enrollmentRoutes, { prefix: "/api/v1" });
  await app.register(announcementRoutes, { prefix: "/api/v1" });
  await app.register(qaRoutes, { prefix: "/api/v1" });
  await app.register(materialRoutes, { prefix: "/api/v1" });
  await app.register(purchaseRoutes, { prefix: "/api/v1" });
  await app.register(progressRoutes, { prefix: "/api/v1" });
  await app.register(assessmentRoutes, { prefix: "/api/v1" });
  await app.register(pointsRoutes, { prefix: "/api/v1" });
  await app.register(settlementRoutes, { prefix: "/api/v1" });
  await app.register(reviewRoutes, { prefix: "/api/v1" });
  await app.register(emailRoutes, { prefix: "/api/v1" });
  await app.register(aiRoutes, { prefix: "/api/v1" });
  await app.register(devotionalRoutes, { prefix: "/api/v1" });
  await app.register(authLocalRoutes, { prefix: "/api/v1" });
  await app.register(gradesRoutes, { prefix: "/api/v1" });
  await app.register(storageRoutes, { prefix: "/api/v1" });

  return app;
}
