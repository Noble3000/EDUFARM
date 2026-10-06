// AI Phase 3 (§11): course-grounded assistant (RAG-lite) + lecturer insights.
// Retrieval: entitlement-scoped Postgres full-text search over MaterialChunk
// (pgvector upgrade path open; this Postgres Pro build lacks the extension).
// Source hierarchy enforced: authorized chunks first with [Title vN] citations;
// general knowledge is a clearly labeled fallback and NEVER presented as lecturer position.
// Ingestion: chunks rebuilt from title+description on publish (PDF text extraction
// lands with the R2 reader spike); POST /ai/backfill re-indexes a course.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { canControlCourse } from "../hierarchy-guard.js";

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
  // Pipeline: entitlement firewall → refusal screen → retrieval →
  // provider → forbidden-claim filter → labeled response + usage log.
  app.post("/ai/ask", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const t0 = Date.now();
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "auth-required" });
    const b = req.body as { courseId: string; question: string; materialId?: string };
    if (!b.courseId || !b.question || !b.question.trim())
      return reply.code(400).send({ error: "auth-invalid: courseId + question required." });
    if (b.question.length > 2000)
      return reply.code(400).send({ error: "auth-invalid: question too long (2000 chars)." });
    const { resolveEntitlement } = await import("../ai/entitlement.js");
    const { classifyRefusal } = await import("../ai/refusal.js");
    const { retrieve } = await import("../ai/retrieval.js");
    const { activeProvider } = await import("../ai/provider.js");
    const { buildSystemPrompt, findForbiddenClaim } = await import("../ai/policy.js");
    const { formatCitations } = await import("../ai/citations.js");
    const { logQuery, overBudget } = await import("../ai/usage.js");
    const studentId = user.studentProfile.id;

    const finish = async (out: Record<string, unknown>, grounded: boolean, refusalCode: string | null, citationsCount: number, provider: string) => {
      await logQuery({
        studentId, courseId: b.courseId, question: b.question, grounded,
        refusalCode, citationsCount, latencyMs: Date.now() - t0, provider,
      });
      await prisma.studyEvent.create({
        data: { studentId, courseId: b.courseId, materialId: b.materialId ?? null, type: "ai-session", durationSec: 0 },
      }).catch(() => {});
      return out;
    };

    // Daily budget gate (before any work).
    if (await overBudget(studentId)) {
      return finish({
        grounded: false, label: "general", refusalCode: "RATE_LIMITED",
        answer: "You've reached today's AI study budget. Come back tomorrow — your courses, library, and Q&A are still here.",
        citations: [], additionalContext: null,
      }, false, "RATE_LIMITED", 0, "none");
    }

    const ent = await resolveEntitlement(b.courseId, studentId, b.materialId);
    // Screen 1: restricted patterns + entitlement, BEFORE retrieval, so no
    // unauthorized content is ever fetched, let alone cited.
    const preRefusal = classifyRefusal(b.question, ent.ok, true);
    if (preRefusal && preRefusal.code !== "INSUFFICIENT") {
      return finish({
        grounded: false, label: "general", refusalCode: preRefusal.code,
        answer: preRefusal.message, citations: [], additionalContext: null,
      }, false, preRefusal.code, 0, "none");
    }
    if (!ent.ok) {
      const r = classifyRefusal(b.question, false, false)!;
      return finish({
        grounded: false, label: "general", refusalCode: r.code,
        answer: r.message, citations: [], additionalContext: null,
      }, false, r.code, 0, "none");
    }

    const hits = await retrieve(b.question, ent.entitlement.materialIds, b.courseId);
    if (!hits.length) {
      const r = classifyRefusal(b.question, true, false)!;
      return finish({
        grounded: false, label: "general", refusalCode: r.code,
        answer: r.message,
        citations: [],
        additionalContext: "General study tip (Additional Academic Context — not lecturer material): break the topic into terms, definitions, and one worked example, then test yourself.",
      }, false, r.code, 0, "none");
    }

    const course = await prisma.course.findUnique({ where: { id: b.courseId }, select: { code: true, title: true } });
    const provider = activeProvider();
    const generated = await provider.generate(
      buildSystemPrompt(course?.code ?? "", course?.title ?? ""),
      b.question,
      hits,
    );
    // Post-filter applies to every provider: forbidden lecturer/policy claims
    // are rewritten into a refusal, never shipped.
    const violation = findForbiddenClaim(generated.text);
    if (violation) {
      return finish({
        grounded: false, label: "general", refusalCode: "RESTRICTED",
        answer: "I can't present that as your lecturer's position — it isn't grounded in an authorized lecturer source. Ask in Course Q&A instead.",
        citations: [], additionalContext: null,
      }, false, "RESTRICTED", 0, provider.name);
    }
    const citations = formatCitations(generated.citations.length ? generated.citations : hits.map((h) => ({
      materialTitle: h.title, edition: `v${h.version}`, chunkNo: h.chunkNo, sourceType: h.sourceType,
    })));
    return finish({
      grounded: true,
      label: "course-material",
      labelText: "Course Material Answer",
      answer: generated.text,
      citations,
      additionalContext: null,
      additionalContextLabel: "Additional Academic Context",
    }, true, null, citations.length, provider.name);
  });

  // lecturer insights: aggregated academic signals ONLY — counts, rates, trends
  // and class-visible Q&A titles. Never per-student rows, never names/emails/
  // matric numbers, never CGPA/grades tables. Rates are suppressed entirely
  // when the cohort is under 3 enrolled (k-anonymity). Only lecturers assigned
  // to THIS course (or staff) may read them.
  app.get("/courses/:id/insights", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !LECTURER_ROLES.includes(user.role))
      return reply.code(403).send({ error: "Lecturer/staff only." });
    const { id } = req.params as { id: string };
    if (!(await canControlCourse(user.id, user.role, id)))
      return reply.code(403).send({ error: "Only the course lecturer (or staff) may view insights." });
    const q = req.query as { days?: string };
    const days = Number(q.days ?? 14);
    if (![7, 14, 30].includes(days))
      return reply.code(400).send({ error: "days must be 7, 14 or 30." });
    const now = Date.now();
    const cur0 = new Date(now - days * 86400_000);
    const prev0 = new Date(now - 2 * days * 86400_000);

    const enrolled = await prisma.enrollment.count({ where: { courseId: id, status: "approved" } });
    const limited = enrolled < 3;

    // --- engagement: active students + dwell volume, current vs previous window ---
    const [curEvts, prevEvts, newEnr] = await Promise.all([
      prisma.studyEvent.findMany({
        where: { courseId: id, createdAt: { gte: cur0 } },
        select: { studentId: true, durationSec: true },
      }),
      prisma.studyEvent.findMany({
        where: { courseId: id, createdAt: { gte: prev0, lt: cur0 } },
        select: { studentId: true, durationSec: true },
      }),
      prisma.enrollment.count({ where: { courseId: id, status: "approved", createdAt: { gte: cur0 } } }),
    ]);
    const uniq = (rows: { studentId: string }[]) => new Set(rows.map((r) => r.studentId)).size;
    const sum = (rows: { durationSec: number }[]) => rows.reduce((s, r) => s + r.durationSec, 0);
    const active = uniq(curEvts);
    const activePrev = uniq(prevEvts);
    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100));
    const engagement = {
      enrolled,
      newEnrollments: newEnr,
      activeStudents: limited ? null : active,
      activeStudentsPrev: limited ? null : activePrev,
      activeChangePct: limited ? null : pct(active, activePrev),
      dwellEvents: curEvts.length,
      dwellEventsPrev: prevEvts.length,
      dwellChangePct: pct(curEvts.length, prevEvts.length),
      studyMinutes: Math.round(sum(curEvts) / 60),
    };

    // --- completion per material: readers, rate, trend, strong/weak signals ---
    const mats = await prisma.material.findMany({
      where: { courseId: id, status: "published" },
      select: { id: true, title: true, version: true },
    });
    const completion = await Promise.all(mats.map(async (m) => {
      const [all, cur, prev] = await Promise.all([
        prisma.studyEvent.findMany({ where: { materialId: m.id, type: "page-dwell", durationSec: { gte: 8 } }, select: { studentId: true, durationSec: true, createdAt: true } }),
        prisma.studyEvent.findMany({ where: { materialId: m.id, type: "page-dwell", durationSec: { gte: 8 }, createdAt: { gte: cur0 } }, select: { studentId: true } }),
        prisma.studyEvent.findMany({ where: { materialId: m.id, type: "page-dwell", durationSec: { gte: 8 }, createdAt: { gte: prev0, lt: cur0 } }, select: { studentId: true } }),
      ]);
      const readers = uniq(all);
      const rate = enrolled > 0 ? Math.round((readers / enrolled) * 100) : 0;
      const avgDwell = all.length ? Math.round(all.reduce((s, r) => s + r.durationSec, 0) / all.length) : 0;
      const t = uniq(cur) - uniq(prev);
      return {
        materialId: m.id, title: m.title, version: m.version,
        readers: limited ? null : readers,
        readersPct: limited ? null : rate,
        avgDwellSec: all.length ? avgDwell : null,
        trend: t > 0 ? "up" : t < 0 ? "down" : "flat",
        signal: rate >= 70 ? "strong" : rate < 30 && enrolled > 0 ? "weak" : "normal",
      };
    }));
    const weak = completion.filter((c) => c.signal === "weak");
    const strong = completion.filter((c) => c.signal === "strong");

    // --- frequently asked topics: keyword clusters over class Q&A ---
    const questions = await prisma.question.findMany({
      where: { courseId: id },
      select: { id: true, title: true, body: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" }, take: 100,
    });
    const STOP = new Set(("what,why,how,when,which,that,this,with,from,have,has,are,was,were,will,would,there,their,about,into,does,doing,please,explain,mean,means,doesnt,don't,can't,could,should,the,and,for,are,you,your,with,from,they,them,then,than,also,just,like,more,most,very,can,will,its,it's,not,but,are,was,were,been,being,have,has,had,having,will,would,shall,should,may,might,must,ought,need,needs,dare,used,does,did,doing,done,such,than,too,very,will,just,don,should,now,cours,lectur,studen,materi,quest,ask,answer").split(","));
    const terms = new Map<string, { count: number; questionIds: string[] }>();
    for (const qu of questions) {
      const words = `${qu.title} ${qu.body}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
      for (const w of new Set(words)) {
        const t = terms.get(w) ?? { count: 0, questionIds: [] };
        t.count += 1;
        if (t.questionIds.length < 3) t.questionIds.push(qu.id);
        terms.set(w, t);
      }
    }
    const topics = [...terms.entries()]
      .filter(([, t]) => t.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([term, t]) => ({ term, mentions: t.count, questionIds: t.questionIds }));

    // --- unresolved: unanswered + answered-but-open, with ages ---
    const unanswered = await prisma.question.findMany({
      where: { courseId: id, status: "unanswered" },
      orderBy: { createdAt: "desc" }, take: 8,
      select: { id: true, title: true, createdAt: true },
    });
    const openCount = await prisma.question.count({ where: { courseId: id, status: { in: ["unanswered", "answered"] } } });
    const unresolved = {
      unanswered: unanswered.map((u) => ({
        id: u.id, title: u.title,
        ageDays: Math.floor((now - u.createdAt.getTime()) / 86400_000),
      })),
      openCount,
    };

    // --- difficulty: MCQ correct rates + low-average assessments (class-level only) ---
    const mcqAnswers = await prisma.assessmentAnswer.findMany({
      where: { question: { kind: "mcq", assessment: { courseId: id } } },
      select: { isCorrect: true, questionId: true, question: { select: { text: true, assessmentId: true } } },
    });
    const byQ = new Map<string, { text: string; assessmentId: string; n: number; ok: number }>();
    for (const a of mcqAnswers) {
      const b = byQ.get(a.questionId) ?? { text: a.question.text, assessmentId: a.question.assessmentId, n: 0, ok: 0 };
      b.n += 1;
      if (a.isCorrect) b.ok += 1;
      byQ.set(a.questionId, b);
    }
    const difficulty = [...byQ.entries()]
      .filter(([, b]) => b.n >= 3)
      .map(([questionId, b]) => ({
        questionId, assessmentId: b.assessmentId,
        text: b.text.slice(0, 120), responses: b.n,
        correctPct: limited ? null : Math.round((b.ok / b.n) * 100),
      }))
      .sort((a, b) => (a.correctPct ?? 100) - (b.correctPct ?? 100))
      .slice(0, 5);
    const assessments = await prisma.assessment.findMany({
      where: { courseId: id, status: { in: ["published", "closed"] } },
      include: { attempts: { where: { status: "graded" }, select: { score: true } }, questions: { select: { marks: true } } },
    });
    const assessmentStats = assessments.map((a) => {
      const scores = a.attempts.map((t) => t.score ?? 0);
      const max = a.questions.reduce((s, q) => s + q.marks, 0);
      const avg = scores.length ? +(scores.reduce((s, x) => s + x, 0) / scores.length).toFixed(1) : null;
      return { id: a.id, title: a.title, attempts: a.attempts.length, avgScore: avg, maxScore: max };
    });
    const lowAvg = assessmentStats.filter((a) => a.avgScore != null && a.maxScore > 0 && a.avgScore / a.maxScore < 0.5);

    // --- plain-language suggestions, each pinned to a measurable metric + entity ---
    type Sugg = { text: string; metric: string; ref: { type: "course" | "assessment" | "material" | "question"; id: string; label: string } };
    const suggestions: Sugg[] = [];
    if (unresolved.unanswered.length) {
      const u = unresolved.unanswered[0];
      suggestions.push({
        text: `Publish a clarification for "${u.title}" — it has waited ${u.ageDays} day${u.ageDays === 1 ? "" : "s"} with ${unresolved.openCount} question${unresolved.openCount === 1 ? "" : "s"} still open.`,
        metric: `${unresolved.unanswered.length} unanswered shown, ${unresolved.openCount} open total`,
        ref: { type: "question", id: u.id, label: u.title },
      });
    }
    if (lowAvg.length) {
      const l = lowAvg[0];
      suggestions.push({
        text: `Class average on "${l.title}" is below 50% — consider a revision pack or in-class reteach.`,
        metric: `avg ${l.avgScore}/${l.maxScore} over ${l.attempts} graded attempts`,
        ref: { type: "assessment", id: l.id, label: l.title },
      });
    }
    if (difficulty.length && (difficulty[0].correctPct ?? 100) < 50) {
      const d = difficulty[0];
      suggestions.push({
        text: `One question trips most students ("${d.text}…") — clarify the underlying concept.`,
        metric: `${d.correctPct}% correct over ${d.responses} responses`,
        ref: { type: "assessment", id: d.assessmentId, label: "assessment" },
      });
    }
    if (weak.length) {
      const w = weak[0];
      suggestions.push({
        text: `"${w.title}" is read by few enrolled students — check difficulty, length, or announce it.`,
        metric: limited ? "cohort too small for rates" : `${w.readersPct}% completion`,
        ref: { type: "material", id: w.materialId, label: w.title },
      });
    }
    if (topics.length) {
      const t = topics[0];
      suggestions.push({
        text: `"${t.term}" keeps coming up (${t.mentions} questions) — a pinned explainer would serve the class.`,
        metric: `${t.mentions} mentions across class Q&A`,
        ref: { type: "course", id, label: "course Q&A" },
      });
    }
    if (engagement.dwellChangePct < -20 && engagement.dwellEventsPrev > 0) {
      suggestions.push({
        text: `Study activity dipped ${-engagement.dwellChangePct}% this period — an announcement or deadline usually lifts it.`,
        metric: `${engagement.dwellEvents} vs ${engagement.dwellEventsPrev} study events`,
        ref: { type: "course", id, label: "course" },
      });
    }

    // --- one-paragraph summary in plain language ---
    const bits: string[] = [`${enrolled} enrolled${engagement.newEnrollments ? ` (+${engagement.newEnrollments} new)` : ""}`];
    if (!limited) bits.push(`study activity ${engagement.dwellChangePct >= 0 ? "up" : "down"} ${Math.abs(engagement.dwellChangePct)}%`);
    if (strong.length) bits.push(`${strong.length} material${strong.length === 1 ? "" : "s"} completing strongly`);
    if (weak.length) bits.push(`${weak.length} weak`);
    if (unresolved.openCount) bits.push(`${unresolved.openCount} Q&A open`);
    if (lowAvg.length) bits.push(`${lowAvg.length} assessment${lowAvg.length === 1 ? "" : "s"} under 50% average`);
    const summary = bits.length > 1
      ? `This period: ${bits.join(" · ")}. Details and suggested actions follow, each linked to its metric.`
      : `Early days — ${bits[0]}. Signals appear once students study, ask, and attempt.`;

    return {
      windowDays: days, enrolled, limited,
      engagement, completion,
      topics, unresolved, difficulty, assessmentStats,
      suggestions, summary,
    };
  });
}
