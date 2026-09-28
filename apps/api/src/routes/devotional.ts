// Devotional Phase 4 (§14): same daily Word for every student (Africa/Lagos day boundary).
// Content: authorized source only (seed placeholders until license proof — see PRD §21).
// Archive browsable. Academic reflection served separately in UI (not mixed with devotional).
// Onboarding: public institution request → unverified university → platform approve.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

// Lagos (UTC+1, no DST) calendar day as UTC range
export function lagosDayRange(now = new Date()): { start: Date; end: Date; key: string } {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  const y = lagos.getUTCFullYear();
  const m = String(lagos.getUTCMonth() + 1).padStart(2, "0");
  const d = String(lagos.getUTCDate()).padStart(2, "0");
  const start = new Date(`${y}-${m}-${d}T00:00:00.000+01:00`);
  const end = new Date(start.getTime() + 86400_000);
  return { start, end, key: `${y}-${m}-${d}` };
}

export async function devotionalRoutes(app: FastifyInstance) {
  // today's Word — identical for every student
  app.get("/devotional/today", async () => {
    const { start, end } = lagosDayRange();
    const entry =
      (await prisma.devotional.findFirst({ where: { date: { gte: start, lt: end } } })) ??
      (await prisma.devotional.findFirst({ orderBy: { date: "desc" } }));
    if (!entry) return { empty: true };
    return entry;
  });

  app.get("/devotional/archive", async () => {
    return prisma.devotional.findMany({ orderBy: { date: "desc" }, take: 30 });
  });

  // platform admin curates devotionals
  app.post("/devotionals", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const b = req.body as { date: string; title: string; verse: string; body: string; sourceRef?: string };
    if (!b.date || !b.title || !b.verse || !b.body)
      return reply.code(400).send({ error: "date + title + verse + body required." });
    return prisma.devotional.upsert({
      where: { date: new Date(b.date) },
      update: { title: b.title, verse: b.verse, body: b.body, sourceRef: b.sourceRef },
      create: { date: new Date(b.date), title: b.title, verse: b.verse, body: b.body, sourceRef: b.sourceRef },
    });
  });

  // public institution onboarding request → unverified university + audit
  app.post("/onboarding/institution", async (req, reply) => {
    const b = req.body as { name: string; slug: string; contactEmail?: string };
    if (!b.name || !b.slug) return reply.code(400).send({ error: "name + slug required." });
    const existing = await prisma.university.findUnique({ where: { slug: b.slug } });
    if (existing) return reply.code(400).send({ error: "slug taken." });
    const uni = await prisma.university.create({ data: { name: b.name, slug: b.slug, verified: false } });
    await prisma.auditLog.create({
      data: {
        actorId: "public", action: "institution.onboarding.requested",
        targetType: "University", targetId: uni.id, meta: b.contactEmail ?? null,
      },
    });
    return { ...uni, note: "Pending platform approval." };
  });

  app.get("/onboarding/pending", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    return prisma.university.findMany({ where: { verified: false }, orderBy: { slug: "asc" } });
  });

  app.post("/onboarding/:id/approve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const { id } = req.params as { id: string };
    const uni = await prisma.university.update({ where: { id }, data: { verified: true } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "institution.onboarding.approved", targetType: "University", targetId: id },
    });
    return uni;
  });
}
