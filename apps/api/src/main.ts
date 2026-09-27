// EDUFARM API entry (Fastify + Prisma + Better Auth) — Phase 0 scaffold.
// Run after installs: pnpm --filter @edufarm/api dev (port 4000).
// Full modules (verification/materials/payments) land in Phase 1.

import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "edufarm-api",
  db: "local-postgres",
  auth: "better-auth",
  storage: "cloudflare-r2",
}));

const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" });
