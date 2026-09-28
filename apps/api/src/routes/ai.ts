// AI Phase 3 (§11): course-grounded assistant (RAG-lite) + lecturer insights.
// Retrieval: entitlement-scoped Postgres full-text search over MaterialChunk
// (pgvector upgrade path open; this Postgres Pro build lacks the extension).
// Source hierarchy enforced: authorized chunks first with [Title vN] citations;
// general knowledge is a clearly labeled fallback and NEVER presented as lecturer position.
// Ingestion: chunks rebuilt from title+description on publish (PDF text extraction
// lands with the R2 reader spike); POST /ai/backfill re-indexes a course.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { currentUser } from "../auth-dev.js";

const LECTURER_ROLES = ["lecturer", "deptAdmin", "institutionAdmin", "platformAdmin"];

function chunkText(text: string, maxLen = 400): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > maxLen && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur = (cur + " " + s).trim();
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

export async function indexMaterial(materialId: string): Promise<number> {
  const mat = await prisma.material.findUnique({ where: { id: materialId } });
  if (!mat) return 0;
  const source = `${mat.title}. (${mat.type}.) ${mat.description ?? "No description yet."}`;
  const chunks = chunkText(source);
  await prisma.materialChunk.deleteMany({ where: { materialId, version: mat.version } });
  await prisma.materialChunk.createMany({
    data: chunks.map((text, i) => ({ materialId, version: mat.version, chunkNo: i, text })),
  });
  return chunks.length;
}

async function entitledMaterialIds(courseId: string, studentId: string): Promise<string[]> {
  const mats = await prisma.material.findMany({ where: { courseId, status: "published" } });
  const purchases = await prisma.purchase.findMany({
    where: { studentId, status: "completed", materialId: { not: null } },
    select: { materialId: true },
  });
  const owned = new Set(purchases.map((p) => p.materialId as string));
  return mats.filter((m) => m.isFree || owned.has(m.id)).map((m) => m.id);
}

export async function aiRoutes(app: FastifyInstance) {
  app.post("/ai/backfill", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const b = (req.body ?? {}) as { courseId?: string };
    const mats = await prisma.material.findMany({
      where: { status: "published", ...(b.courseId ? { courseId: b.courseId } : {}) },
      select: { id: true },
    });
    let chunks = 0;
    for (const m of mats) chunks += await indexMaterial(m.id);
    return { materials: mats.length, chunks };
  });

  // student ask (optionally scoped to one material: Ask This Material)
  app.post("/ai/ask", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const b = req.body as { courseId: string; question: string; materialId?: string };
    if (!b.courseId || !b.question) return reply.code(400).send({ error: "courseId + question required." });
    const enrollment = await prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: b.courseId, studentId: user.studentProfile.id } },
    });
    if (!enrollment || enrollment.status !== "approved")
      return reply.code(403).send({ error: "Course access required." });
    let ids = await entitledMaterialIds(b.courseId, user.studentProfile.id);
    if (b.materialId) {
      if (!ids.includes(b.materialId)) return reply.code(403).send({ error: "Material access required." });
      ids = [b.materialId];
    }
    let hits: { text: string; title: string; version: number; rank: number }[] = [];
    if (ids.length) {
      hits = await prisma.$queryRaw`
        SELECT c."text", m."title", m."version",
               ts_rank(to_tsvector('english', c."text"), plainto_tsquery('english', ${b.question})) AS rank
        FROM "MaterialChunk" c JOIN "Material" m ON m."id" = c."materialId"
        WHERE c."materialId" = ANY(${ids})
          AND to_tsvector('english', c."text") @@ plainto_tsquery('english', ${b.question})
        ORDER BY rank DESC LIMIT 5`;
    }
    await prisma.studyEvent.create({
      data: {
        studentId: user.studentProfile.id, courseId: b.courseId,
        materialId: b.materialId ?? null, type: "ai-session", durationSec: 0,
      },
    });
    if (!hits.length) {
      return {
        grounded: false,
        answer: "No authorized course material covers this yet. Ask your lecturer in Course Q&A — this keeps the lecturer as the academic authority.",
        citations: [],
        additionalContext: "General study tip (not lecturer material): break the topic into terms, definitions, and one worked example, then test yourself.",
      };
    }
    return {
      grounded: true,
      answer: `From your authorized materials: ${hits.map((h) => h.text).join(" ")}`,
      citations: hits.map((h) => ({ title: h.title, version: h.version })),
      additionalContext: null,
    };
  });

  // lecturer insights: engagement, unresolved topics, weak completion, suggestions
  app.get("/courses/:id/insights", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    const assessments = await prisma.assessment.findMany({
      where: { courseId: id, status: { in: ["published", "closed"] } },
      include: { attempts: { where: { status: "graded" } }, questions: true },
    });
    const assessmentStats = assessments.map((a) => {
      const scores = a.attempts.map((t) => t.score ?? 0);
      const max = a.questions.reduce((s, q) => s + q.marks, 0);
      return {
        id: a.id, title: a.title, attempts: a.attempts.length,
        avgScore: scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : null,
        maxScore: max,
      };
    });
    const unanswered = await prisma.question.findMany({
      where: { courseId: id, status: "unanswered" },
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, title: true, createdAt: true },
    });
    const enrolled = await prisma.enrollment.count({ where: { courseId: id, status: "approved" } });
    const mats = await prisma.material.findMany({ where: { courseId: id, status: "published" }, select: { id: true, title: true } });
    const weak: { materialId: string; title: string; readers: number }[] = [];
    for (const m of mats) {
      const readers = await prisma.studyEvent.groupBy({
        by: ["studentId"], where: { materialId: m.id, type: "page-dwell", durationSec: { gte: 8 } },
      }).then((g) => g.length);
      if (enrolled > 0 && readers / enrolled < 0.3) weak.push({ materialId: m.id, title: m.title, readers });
    }
    const suggestions: string[] = [];
    if (unanswered.length) suggestions.push(`Publish a clarification for: "${unanswered[0].title}" (${unanswered.length} unanswered).`);
    const lowAvg = assessmentStats.find((a) => a.avgScore != null && a.maxScore > 0 && a.avgScore / a.maxScore < 0.5);
    if (lowAvg) suggestions.push(`Class average on "${lowAvg.title}" is below 50% — consider a revision pack.`);
    if (weak.length) suggestions.push(`Low completion on "${weak[0].title}" — check difficulty or announce it.`);
    return { assessmentStats, unanswered, weakCompletion: weak, enrolled, suggestions };
  });
}
