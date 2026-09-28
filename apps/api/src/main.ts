// EDUFARM API — Phase 1: trusted academic foundation (local-first).
// Fastify + Prisma (local Postgres) + dev-header auth (Better Auth cookies next).
// Routes: hierarchy, verification, enrollments, announcements, Q&A,
// materials lifecycle, purchases (mock checkout), progress, notifications.
// Demo login: POST /api/v1/demo/login {email} → {user} (use id as x-user-id).

import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./db.js";
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

const app = Fastify({ logger: true });
await app.register(cors, { origin: [/^http:\/\/localhost:300\d$/], credentials: true });

app.get("/health", async () => ({
  ok: true,
  service: "edufarm-api",
  phase: "phase-1",
  db: "local-postgres",
  auth: "dev-header (better-auth next)",
  storage: "cloudflare-r2 (presigned mock)",
}));

// demo login: pick seeded user by email → returns id for x-user-id header
app.post("/api/v1/demo/login", async (req, reply) => {
  const b = (req.body ?? {}) as { email?: string };
  if (!b.email) return reply.code(400).send({ error: "email required." });
  const user = await prisma.user.findUnique({
    where: { email: b.email },
    include: { studentProfile: true, lecturerProfile: true },
  });
  if (!user) return reply.code(404).send({ error: "Unknown email. See seeded demo users." });
  return { id: user.id, email: user.email, name: user.name, role: user.role, studentProfile: user.studentProfile, lecturerProfile: user.lecturerProfile };
});

app.get("/api/v1/demo/users", async () => {
  const users = await prisma.user.findMany({ include: { studentProfile: true, lecturerProfile: true } });
  return users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
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

const port = Number(process.env.API_PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
