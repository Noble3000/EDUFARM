// Notification center routes: preferences, read state, deadline reminders.
// In-app is primary; email preferences live here too. Reminder runner is
// idempotent (dedup keys) — safe to invoke on a schedule.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser as currentUser } from "../authz.js";
import { notify } from "../notify/center.js";

const EMAIL_KINDS = [
  "announcement", "material", "purchase", "assessment", "deadline",
  "enrollment", "verification", "dispute", "institution", "grant",
];

export async function notificationRoutes(app: FastifyInstance) {
  app.get("/notifications/preferences", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const row = await prisma.notificationPref.findUnique({ where: { userId: user.id } });
    return {
      emailEnabled: row?.emailEnabled ?? true,
      mutedTypes: row?.mutedTypes ?? [],
      kinds: EMAIL_KINDS,
    };
  });

  app.patch("/notifications/preferences", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const b = (req.body ?? {}) as { emailEnabled?: boolean; mutedTypes?: string[] };
    if (b.emailEnabled !== undefined && typeof b.emailEnabled !== "boolean")
      return reply.code(400).send({ error: "emailEnabled must be boolean." });
    const muted = Array.isArray(b.mutedTypes)
      ? [...new Set(b.mutedTypes.filter((t) => EMAIL_KINDS.includes(t)))]
      : undefined;
    return prisma.notificationPref.upsert({
      where: { userId: user.id },
      update: { ...(b.emailEnabled !== undefined ? { emailEnabled: b.emailEnabled } : {}), ...(muted ? { mutedTypes: muted } : {}) },
      create: { userId: user.id, emailEnabled: b.emailEnabled ?? true, mutedTypes: muted ?? [] },
    });
  });

  app.get("/notifications/unread-count", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const count = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return { unread: count };
  });

  app.patch("/notifications/:id/read", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const { id } = req.params as { id: string };
    const n = await prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== user.id) return reply.code(404).send({ error: "Not found." });
    return prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  });

  app.post("/notifications/read-all", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "Sign-in required." });
    const r = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null }, data: { readAt: new Date() },
    });
    return { read: r.count };
  });

  // deadline reminders: published assessments due within 48h, approved students
  // without a submitted attempt. Dedup-keyed — reruns never duplicate.
  app.post("/notifications/reminders/run", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Staff only." });
    const horizon = new Date(Date.now() + 48 * 3600_000);
    const due = await prisma.assessment.findMany({
      where: { status: "published", dueAt: { lte: horizon, gte: new Date() } },
      select: { id: true, title: true, courseId: true, dueAt: true, course: { select: { code: true } } },
    });
    let created = 0, skipped = 0;
    for (const a of due) {
      const enrolled = await prisma.enrollment.findMany({
        where: { courseId: a.courseId, status: "approved" },
        select: { student: { select: { userId: true, id: true } } },
      });
      for (const e of enrolled) {
        const attempted = await prisma.assessmentAttempt.findFirst({
          where: { assessmentId: a.id, studentId: e.student.id, status: { in: ["submitted", "graded"] } },
        });
        if (attempted) {
          skipped += 1;
          continue;
        }
        const r = await notify({
          userId: e.student.userId, type: "deadline",
          title: `Due soon: ${a.title}`,
          body: `${a.course.code} — due ${a.dueAt!.toLocaleString()}. Attempts without submission don't count.`,
          link: `/assessments/${a.id}`,
          dedupKey: `deadline:${a.id}:${e.student.id}`,
          email: { kind: "deadline" },
        });
        if (r.created) created += 1;
        else skipped += 1;
      }
    }
    return { assessed: due.length, created, skipped };
  });
}
