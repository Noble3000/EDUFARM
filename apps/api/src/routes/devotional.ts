// Devotional Phase 4 (§14): same daily Word for every student (Africa/Lagos day boundary).
// Content: authorized source only (seed placeholders until license proof — see PRD §21).
// Archive browsable. Academic reflection served separately in UI (not mixed with devotional).
// Onboarding: public institution request → unverified university → platform approve.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { audit } from "../authz.js";
import { clearWordCache, resolveToday } from "../word/service.js";
import { feedConfigured } from "../word/source.js";
import { cacheInvalidate } from "../lib/cache.js";

export async function devotionalRoutes(app: FastifyInstance) {
  // today's Word — canonical per Lagos day, identical for every student.
  // Served from day cache → DB → authorized source → last-authorized fallback.
  // Never fabricated: empty database yields { empty: true }.
  app.get("/devotional/today", async () => resolveToday());

  app.get("/devotional/archive", async () => {
    return prisma.devotional.findMany({ orderBy: { date: "desc" }, take: 30 });
  });

  app.get("/devotional/source-status", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || user.role !== "platformAdmin")
      return reply.code(403).send({ error: "forbidden:role:platformAdmin" });
    return { configured: feedConfigured(), note: "Set WORD_FEED_URL + WORD_FEED_KEY to enable server-side pulls." };
  });

  // platform admin curates devotionals (manual fallback channel, audited)
  app.post("/devotionals", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:platformAdmin" });
    const b = req.body as { date: string; title: string; verse: string; body: string; sourceRef?: string; rightsNote?: string };
    if (!b.date || !b.title || !b.verse || !b.body)
      return reply.code(400).send({ error: "auth-invalid: date + title + verse + body required." });
    const row = await prisma.devotional.upsert({
      where: { date: new Date(b.date) },
      update: { title: b.title, verse: b.verse, body: b.body, sourceRef: b.sourceRef, rightsNote: b.rightsNote, origin: "manual" },
      create: { date: new Date(b.date), title: b.title, verse: b.verse, body: b.body, sourceRef: b.sourceRef, rightsNote: b.rightsNote, origin: "manual" },
    });
    clearWordCache();
    await audit(user.id, "devotional.published", "Devotional", row.id, `${b.date} manual`);
    return row;
  });

  // force a source pull now (admin; no-op + report when unconfigured)
  app.post("/devotional/refresh", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:platformAdmin" });
    if (!feedConfigured()) return { refreshed: false, reason: "source-unconfigured" };
    clearWordCache();
    const out = await resolveToday();
    await audit(user.id, "devotional.refreshed", "Devotional", out.id ?? "none", `origin=${out.origin ?? "?"}`);
    return { refreshed: !out.empty, origin: out.origin ?? null };
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
    const q = req.query as { status?: string };
    const status = (q.status ?? "pending").toLowerCase();
    if (status === "suspended")
      return prisma.university.findMany({ where: { verified: true, suspended: true }, orderBy: { slug: "asc" } });
    if (status === "verified")
      return prisma.university.findMany({ where: { verified: true, suspended: false }, orderBy: { slug: "asc" } });
    return prisma.university.findMany({ where: { verified: false }, orderBy: { slug: "asc" } });
  });

  app.post("/onboarding/:id/approve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const { id } = req.params as { id: string };
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) return reply.code(404).send({ error: "Institution not found." });
    if (uni.verified) return reply.code(400).send({ error: "Already approved." });
    const updated = await prisma.university.update({ where: { id }, data: { verified: true } });
    cacheInvalidate("hier:universities");
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "institution.onboarding.approved", targetType: "University", targetId: id },
    });
    await notifyContact(uni.id, "institution.approved", "Institution approved",
      `${uni.name} is now a verified EDUFARM institution. Faculties, departments, levels and courses can be created.`);
    return updated;
  });

  // reject an unverified request (removes it; slug freed) or suspend/reinstate a verified one
  app.post("/onboarding/:id/decide", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Platform admin only." });
    const { id } = req.params as { id: string };
    const b = req.body as { decision: "reject" | "suspend" | "reinstate"; note?: string };
    if (!["reject", "suspend", "reinstate"].includes(b.decision))
      return reply.code(400).send({ error: "decision must be reject|suspend|reinstate." });
    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) return reply.code(404).send({ error: "Institution not found." });
    if (b.decision === "reject") {
      if (uni.verified) return reply.code(400).send({ error: "Cannot reject a verified institution — suspend instead." });
      const kids = await prisma.faculty.count({ where: { universityId: id } });
      if (kids > 0) return reply.code(400).send({ error: "Institution already has faculties — suspend instead." });
      await prisma.university.delete({ where: { id } });
      await prisma.auditLog.create({
        data: { actorId: user.id, action: "institution.onboarding.rejected", targetType: "University", targetId: id, meta: b.note ?? null },
      });
      return { rejected: true, note: "Request removed. The institution may re-apply with corrections." };
    }
    if (b.decision === "suspend") {
      if (!uni.verified) return reply.code(400).send({ error: "Only verified institutions can be suspended — reject instead." });
      const updated = await prisma.university.update({ where: { id }, data: { suspended: true } });
      await prisma.auditLog.create({
        data: { actorId: user.id, action: "institution.suspended", targetType: "University", targetId: id, meta: b.note ?? null },
      });
      await notifyContact(id, "institution.suspended", "Institution suspended",
        `${uni.name} is suspended pending review.${b.note ? ` Note: ${b.note}` : ""} New verifications and courses pause; existing access continues.`);
      return updated;
    }
    if (!uni.suspended) return reply.code(400).send({ error: "Institution is not suspended." });
    const updated = await prisma.university.update({ where: { id }, data: { suspended: false } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "institution.reinstated", targetType: "University", targetId: id },
    });
    await notifyContact(id, "institution.reinstated", "Institution reinstated", `${uni.name} is active again.`);
    return updated;
  });
}

// Notify institution contacts: any users whose profiles link this university.
async function notifyContact(universityId: string, type: string, title: string, body: string) {
  const students = await prisma.studentProfile.findMany({
    where: { universityId }, select: { userId: true },
  });
  const { notify } = await import("../notify/center.js");
  for (const s of students) {
    await notify({
      userId: s.userId, type, title, body,
      dedupKey: `${type}:${universityId}:${title}`.slice(0, 120),
      email: { kind: "institution" },
    });
  }
}
