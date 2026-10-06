// Reviews + disputes (§15–16): trust without takedowns.
// Reviews: only eligible students (usable paid grant — revoked/suspended don't
// count — or ≥3 meaningful dwells) on published/archived materials; one review
// per student per material (edit it); lecturer replies; staff hide (never auto).
// Disputes: report → notify staff → assign → under-review → resolve/dismiss →
// appeal → closed. A report NEVER unpublishes material. Reporter identity stays
// inside the staff queue; reported parties and the public never see it.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { audit, canControlCourse, notifyUser } from "../hierarchy-guard.js";

const STAFF = ["deptAdmin", "institutionAdmin", "platformAdmin"];
const REVIEWERS = ["institutionAdmin", "platformAdmin"];
const SLA_HOURS = 72;
const APPEAL_WINDOW_DAYS = 7;
const MAX_BODY = 2000;

const TRANSITIONS: Record<string, string[]> = {
  open: ["under-review", "resolved", "dismissed"],
  "under-review": ["resolved", "dismissed"],
  resolved: ["appealed"],
  dismissed: ["appealed"],
  appealed: ["closed", "resolved"],
  closed: [],
};

async function hasMeaningfulAccess(studentId: string, materialId: string): Promise<boolean> {
  const grant = await prisma.purchase.findFirst({
    where: { studentId, materialId, status: "completed" },
  });
  // revoked/suspended grants were never legitimate access — expired ones were
  if (grant) return true;
  const dwells = await prisma.studyEvent.count({
    where: { studentId, materialId, type: "page-dwell", durationSec: { gte: 8 } },
  });
  return dwells >= 3;
}

async function eligibleMaterial(id: string) {
  return prisma.material.findFirst({ where: { id, status: { in: ["published", "archived"] } } });
}

async function notifyStaff(type: string, title: string, body: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: REVIEWERS as ("institutionAdmin" | "platformAdmin")[] } }, select: { id: true },
  });
  for (const s of staff) await notifyUser(s.id, type, title, body);
}

async function recordAction(disputeId: string, actorId: string, action: string, note?: string | null) {
  await prisma.disputeAction.create({ data: { disputeId, actorId, action, note: note ?? null } });
  await audit(actorId, `dispute.${action}`, "Dispute", disputeId, note ?? undefined);
}

function slaOf(d: { status: string; slaDueAt: Date | null }) {
  if (!d.slaDueAt) return { dueAt: null, overdue: false, hoursLeft: null as number | null };
  const ms = d.slaDueAt.getTime() - Date.now();
  const open = ["open", "under-review", "appealed"].includes(d.status);
  return { dueAt: d.slaDueAt, overdue: open && ms < 0, hoursLeft: open ? Math.round(ms / 3600000) : null };
}

export async function reviewRoutes(app: FastifyInstance) {
  // --- write a review (eligible students only, one per material) ---
  app.post("/materials/:id/reviews", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const mat = await eligibleMaterial(id);
    if (!mat) return reply.code(404).send({ error: "Material not available for review." });
    const b = (req.body ?? {}) as { rating?: number; body?: string };
    if (!Number.isInteger(b.rating) || (b.rating as number) < 1 || (b.rating as number) > 5)
      return reply.code(400).send({ error: "rating must be a whole number 1–5." });
    const body = String(b.body ?? "").trim().slice(0, MAX_BODY) || null;
    if (!(await hasMeaningfulAccess(user.studentProfile.id, id)))
      return reply.code(403).send({ error: "Meaningful access required before reviewing (completed grant or sustained study)." });
    const dup = await prisma.review.findFirst({ where: { materialId: id, studentId: user.studentProfile.id } });
    if (dup) return reply.code(400).send({ error: "You already reviewed this material — edit your review instead." });
    return prisma.review.create({
      data: { materialId: id, studentId: user.studentProfile.id, rating: b.rating as number, body },
    });
  });

  // --- public review feed (visible only; ownership computed server-side, no ids leak) ---
  app.get("/materials/:id/reviews", async (req) => {
    const { id } = req.params as { id: string };
    const user = await currentUser(req).catch(() => null);
    const mineId = user?.studentProfile?.id ?? null;
    const rows = await prisma.review.findMany({
      where: { materialId: id, status: "visible" },
      include: { replies: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id, rating: r.rating, body: r.body, status: r.status,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
      mine: mineId != null && r.studentId === mineId,
      replies: r.replies,
    }));
  });

  // --- edit own review ---
  app.patch("/reviews/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user?.studentProfile) return reply.code(401).send({ error: "Student sign-in required." });
    const { id } = req.params as { id: string };
    const r = await prisma.review.findUnique({ where: { id } });
    if (!r || r.studentId !== user.studentProfile.id) return reply.code(404).send({ error: "Review not found." });
    const b = (req.body ?? {}) as { rating?: number; body?: string | null };
    const data: { rating?: number; body?: string | null } = {};
    if (b.rating !== undefined) {
      if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5)
        return reply.code(400).send({ error: "rating must be a whole number 1–5." });
      data.rating = b.rating;
    }
    if (b.body !== undefined) data.body = String(b.body ?? "").trim().slice(0, MAX_BODY) || null;
    if (!Object.keys(data).length) return reply.code(400).send({ error: "Nothing to update." });
    return prisma.review.update({ where: { id }, data });
  });

  // --- delete own review (author) ---
  app.delete("/reviews/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const r = await prisma.review.findUnique({ where: { id } });
    if (!r) return reply.code(404).send({ error: "Review not found." });
    const own = user.studentProfile && r.studentId === user.studentProfile.id;
    const staff = STAFF.includes(user.role);
    if (!own && !staff) return reply.code(404).send({ error: "Review not found." });
    await prisma.review.delete({ where: { id } });
    await audit(user.id, "review.deleted", "Review", id, own ? "author" : `staff:${user.role}`);
    return { deleted: true };
  });

  // --- moderate: hide / show (staff only; hiding never deletes, never auto-fires) ---
  app.post("/reviews/:id/hide", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { reason?: string };
    const r = await prisma.review.findUnique({ where: { id } });
    if (!r) return reply.code(404).send({ error: "Review not found." });
    const updated = await prisma.review.update({ where: { id }, data: { status: "hidden" } });
    await audit(user.id, "review.hidden", "Review", id, b.reason ?? undefined);
    return updated;
  });

  app.post("/reviews/:id/show", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const r = await prisma.review.findUnique({ where: { id } });
    if (!r) return reply.code(404).send({ error: "Review not found." });
    return prisma.review.update({ where: { id }, data: { status: "visible" } });
  });

  // --- replies: course lecturer (assigned) or staff; author can edit/delete own ---
  app.post("/reviews/:id/reply", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { body?: string };
    const body = String(b.body ?? "").trim().slice(0, MAX_BODY);
    if (!body) return reply.code(400).send({ error: "body required." });
    const review = await prisma.review.findUnique({ where: { id }, include: { replies: false } });
    if (!review) return reply.code(404).send({ error: "Review not found." });
    const mat = await prisma.material.findUnique({ where: { id: review.materialId } });
    if (!mat) return reply.code(404).send({ error: "Material gone." });
    if (user.role === "lecturer" && !(await canControlCourse(user.id, user.role, mat.courseId)))
      return reply.code(403).send({ error: "Only the course lecturer may reply as lecturer." });
    if (user.role === "student") return reply.code(403).send({ error: "Students reply by editing their review." });
    const isLecturer = user.role === "lecturer" || STAFF.includes(user.role);
    return prisma.reviewReply.create({ data: { reviewId: id, authorId: user.id, isLecturer, body } });
  });

  app.patch("/reviews/replies/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const r = await prisma.reviewReply.findUnique({ where: { id } });
    if (!r || r.authorId !== user.id) return reply.code(404).send({ error: "Reply not found." });
    const b = (req.body ?? {}) as { body?: string };
    const body = String(b.body ?? "").trim().slice(0, MAX_BODY);
    if (!body) return reply.code(400).send({ error: "body required." });
    return prisma.reviewReply.update({ where: { id }, data: { body } });
  });

  app.delete("/reviews/replies/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const r = await prisma.reviewReply.findUnique({ where: { id } });
    if (!r) return reply.code(404).send({ error: "Reply not found." });
    if (r.authorId !== user.id && !STAFF.includes(user.role))
      return reply.code(404).send({ error: "Reply not found." });
    await prisma.reviewReply.delete({ where: { id } });
    return { deleted: true };
  });

  // --- report a review (→ dispute; material stays exactly as it is) ---
  app.post("/reviews/:id/report", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return reply.code(404).send({ error: "Review not found." });
    const b = (req.body ?? {}) as { reason?: string; evidence?: string };
    if (!b.reason?.trim()) return reply.code(400).send({ error: "reason required." });
    return openDispute(user.id, "Review", id, b.reason.trim().slice(0, 1000), (b.evidence ?? "").trim().slice(0, 2000) || null);
  });

  // --- generic content report (material / course / question / user) ---
  app.post("/reports", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = (req.body ?? {}) as { targetType?: string; targetId?: string; reason?: string; evidence?: string };
    if (!b.targetType || !b.targetId || !b.reason?.trim())
      return reply.code(400).send({ error: "targetType + targetId + reason required." });
    if (!["Material", "Review", "User", "Course", "Question"].includes(b.targetType))
      return reply.code(400).send({ error: "Unknown targetType." });
    const exists = await targetExists(b.targetType, b.targetId);
    if (!exists) return reply.code(404).send({ error: "Report target not found." });
    return openDispute(user.id, b.targetType, b.targetId, b.reason.trim().slice(0, 1000), (b.evidence ?? "").trim().slice(0, 2000) || null);
  });

  async function openDispute(reporterId: string, targetType: string, targetId: string, reason: string, evidence: string | null) {
    const dispute = await prisma.dispute.create({
      data: {
        reporterId, targetType, targetId, reason, evidence, status: "open",
        slaDueAt: new Date(Date.now() + SLA_HOURS * 3600_000),
      },
    });
    await recordAction(dispute.id, reporterId, "opened", reason);
    await notifyUser(reporterId, "dispute.received", "Report received",
      `Your report is in the review queue (ref ${dispute.id.slice(0, 8)}). Nothing is removed automatically.`);
    await notifyStaff("dispute.opened", `New report: ${targetType}`,
      `${reason.slice(0, 140)} — ref ${dispute.id.slice(0, 8)}. SLA ${SLA_HOURS}h.`);
    return dispute;
  }

  async function targetExists(t: string, id: string): Promise<boolean> {
    if (t === "Material") return !!(await prisma.material.findUnique({ where: { id } }));
    if (t === "Review") return !!(await prisma.review.findUnique({ where: { id } }));
    if (t === "User") return !!(await prisma.user.findUnique({ where: { id } }));
    if (t === "Course") return !!(await prisma.course.findUnique({ where: { id } }));
    if (t === "Question") return !!(await prisma.question.findUnique({ where: { id } }));
    return false;
  }

  // --- reporter's own reports (no reviewer internals, no other reporters) ---
  app.get("/disputes/mine", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const rows = await prisma.dispute.findMany({
      where: { reporterId: user.id }, orderBy: { createdAt: "desc" }, take: 50,
      include: { actions: { orderBy: { createdAt: "asc" } } },
    });
    return rows.map((d) => ({
      ...d,
      reporterId: undefined,
      sla: slaOf(d),
      actions: d.actions.map((a) => ({ ...a, actorId: undefined })),
    }));
  });

  // --- admin queue: filters + SLA indicators (reporter contact visible to staff only) ---
  app.get("/disputes", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const q = req.query as { status?: string; assignee?: string; overdue?: string; targetType?: string };
    const where: Record<string, unknown> = {};
    if (q.status && q.status !== "all") where.status = q.status;
    if (q.targetType) where.targetType = q.targetType;
    if (q.assignee === "me") where.assignedTo = user.id;
    else if (q.assignee === "unassigned") where.assignedTo = null;
    else if (q.assignee) where.assignedTo = q.assignee;
    const rows = await prisma.dispute.findMany({
      where, orderBy: { createdAt: "desc" }, take: 100,
      include: { actions: { orderBy: { createdAt: "asc" } } },
    });
    const reporters = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.reporterId))] } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(reporters.map((u) => [u.id, u]));
    let out = rows.map((d) => ({
      ...d,
      reporter: byId.get(d.reporterId) ?? null,
      sla: slaOf(d),
    }));
    if (q.overdue === "true") out = out.filter((d) => d.sla.overdue);
    return out;
  });

  // --- dispute detail (staff only — reporter identity never leaves this room) ---
  app.get("/disputes/:id", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const d = await prisma.dispute.findUnique({ where: { id }, include: { actions: { orderBy: { createdAt: "asc" } } } });
    if (!d) return reply.code(404).send({ error: "Dispute not found." });
    const reporter = await prisma.user.findUnique({ where: { id: d.reporterId }, select: { id: true, email: true, name: true } });
    return { ...d, reporter, sla: slaOf(d) };
  });

  // --- assign reviewer (staff; notifies assignee, never the reporter) ---
  app.post("/disputes/:id/assign", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { assigneeId?: string };
    const d = await prisma.dispute.findUnique({ where: { id } });
    if (!d) return reply.code(404).send({ error: "Dispute not found." });
    const assignee = b.assigneeId
      ? await prisma.user.findUnique({ where: { id: b.assigneeId } })
      : null;
    if (b.assigneeId && (!assignee || !REVIEWERS.includes(assignee.role)))
      return reply.code(400).send({ error: "Assignee must be a reviewer (institution/platform admin)." });
    const updated = await prisma.dispute.update({ where: { id }, data: { assignedTo: b.assigneeId ?? null } });
    await recordAction(id, user.id, b.assigneeId ? "assigned" : "unassigned", b.assigneeId ?? undefined);
    if (b.assigneeId) await notifyUser(b.assigneeId, "dispute.assigned", "Dispute assigned to you", `Ref ${id.slice(0, 8)} — ${d.reason.slice(0, 120)}`);
    return updated;
  });

  // --- take into review (open → under-review; self-assigns when unassigned) ---
  app.post("/disputes/:id/start", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const d = await prisma.dispute.findUnique({ where: { id } });
    if (!d) return reply.code(404).send({ error: "Dispute not found." });
    if (!TRANSITIONS[d.status]?.includes("under-review"))
      return reply.code(400).send({ error: `Cannot review a ${d.status} dispute.` });
    const updated = await prisma.dispute.update({
      where: { id }, data: { status: "under-review", assignedTo: d.assignedTo ?? user.id },
    });
    await recordAction(id, user.id, "review-started");
    return updated;
  });

  // --- resolve / dismiss (explicit action; material NEVER auto-touched) ---
  app.post("/disputes/:id/resolve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { decision?: string; resolution?: string; hideReviewId?: string };
    const decision = b.decision ?? "resolve";
    if (!["resolve", "dismiss"].includes(decision))
      return reply.code(400).send({ error: "decision must be resolve|dismiss." });
    if (!b.resolution?.trim()) return reply.code(400).send({ error: "resolution required — record what was decided and why." });
    const d = await prisma.dispute.findUnique({ where: { id } });
    if (!d) return reply.code(404).send({ error: "Dispute not found." });
    const to = decision === "resolve" ? "resolved" : "dismissed";
    if (!TRANSITIONS[d.status]?.includes(to))
      return reply.code(400).send({ error: `Cannot ${decision} a ${d.status} dispute.` });
    // optional explicit enforcement: hide ONE named review (never a material, never implicit)
    if (b.hideReviewId) {
      const target = await prisma.review.findUnique({ where: { id: b.hideReviewId } });
      if (!target) return reply.code(400).send({ error: "hideReviewId not found." });
      await prisma.review.update({ where: { id: b.hideReviewId }, data: { status: "hidden" } });
      await audit(user.id, "review.hidden", "Review", b.hideReviewId, `dispute:${id}`);
    }
    const updated = await prisma.dispute.update({
      where: { id }, data: { status: to, resolution: b.resolution.trim().slice(0, 2000), resolvedAt: new Date() },
    });
    await recordAction(id, user.id, decision === "resolve" ? "resolved" : "dismissed", b.resolution);
    await notifyUser(d.reporterId, `dispute.${to}`, `Your report was ${to}`,
      `${b.resolution.trim().slice(0, 300)}${to === "dismissed" ? " You can appeal within 7 days." : ""}`);
    return updated;
  });

  // --- appeal (reporter only, 7-day window on resolved/dismissed) ---
  app.post("/disputes/:id/appeal", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { reason?: string };
    if (!b.reason?.trim()) return reply.code(400).send({ error: "Appeal reason required." });
    const d = await prisma.dispute.findUnique({ where: { id } });
    if (!d || d.reporterId !== user.id) return reply.code(404).send({ error: "Dispute not found." });
    if (!["resolved", "dismissed"].includes(d.status))
      return reply.code(400).send({ error: `Only resolved/dismissed disputes can be appealed (now ${d.status}).` });
    if (!d.resolvedAt || Date.now() - d.resolvedAt.getTime() > APPEAL_WINDOW_DAYS * 86400_000)
      return reply.code(400).send({ error: "Appeal window (7 days) has closed." });
    const updated = await prisma.dispute.update({
      where: { id }, data: { status: "appealed", appealStatus: "pending", appealReason: b.reason.trim().slice(0, 2000) },
    });
    await recordAction(id, user.id, "appealed", b.reason);
    await notifyStaff("dispute.appealed", "Dispute appealed", `Ref ${id.slice(0, 8)} is back for review.`);
    return updated;
  });

  // --- appeal decision (staff; uphold closes, overturn re-resolves) ---
  app.post("/disputes/:id/appeal-decide", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !REVIEWERS.includes(user.role)) return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { decision?: string; note?: string };
    if (!["uphold", "overturn"].includes(b.decision ?? ""))
      return reply.code(400).send({ error: "decision must be uphold|overturn." });
    const d = await prisma.dispute.findUnique({ where: { id } });
    if (!d) return reply.code(404).send({ error: "Dispute not found." });
    if (d.status !== "appealed") return reply.code(400).send({ error: `Dispute is ${d.status}, not appealed.` });
    const updated = await prisma.dispute.update({
      where: { id },
      data: b.decision === "uphold"
        ? { status: "closed", appealStatus: "upheld", resolution: b.note?.trim().slice(0, 2000) || d.resolution }
        : { status: "resolved", appealStatus: "overturned", resolution: b.note?.trim().slice(0, 2000) || d.resolution, resolvedAt: new Date() },
    });
    await recordAction(id, user.id, `appeal-${b.decision}d`, b.note);
    await notifyUser(d.reporterId, "dispute.appeal-decided",
      `Your appeal was ${b.decision === "uphold" ? "upheld — the case is closed" : "overturned — the decision was revised"}`,
      (b.note ?? "").slice(0, 300));
    return updated;
  });
}
