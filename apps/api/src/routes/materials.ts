// Materials lifecycle (§8.4): draft → pendingLecturer → pendingReview → published → archived.
// Phase 1: metadata + state machine + version rows (file bytes → R2 in spike follow-up;
// fileKey stored as provided, pages endpoint serves mock page shells until render lands).
// Pricing bounds enforced: paid materials within platform rules (defaults: ₦100–₦2,000,
// bundles ≤ ₦5,000 — finalize per §21).

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { ownsCourse, sessionUser as currentUser } from "../authz.js";

const MIN_KOBO = 10000; // ₦100
const MAX_KOBO = 200000; // ₦2,000

async function lecturerOf(userId: string) {
  return prisma.lecturerProfile.findUnique({ where: { userId } });
}

export async function materialRoutes(app: FastifyInstance) {
  // lecturer creates draft (in own department's course only)
  app.post("/courses/:id/materials", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return reply.code(404).send({ error: "not-found:course" });
    if (!(await ownsCourse(user, course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    const lecturer = await lecturerOf(user.id);
    if (!lecturer) return reply.code(403).send({ error: "forbidden:lecturer-profile-required" });
    const b = req.body as {
      title: string; type: string; description?: string; priceKobo?: number;
      isFree?: boolean; accessDurationDays?: number; fileKey?: string; checksum?: string;
    };
    if (!b.title || !b.type) return reply.code(400).send({ error: "title + type required." });
    if (!b.isFree && b.priceKobo != null && (b.priceKobo < MIN_KOBO || b.priceKobo > MAX_KOBO))
      return reply.code(400).send({ error: `priceKobo must be ${MIN_KOBO}–${MAX_KOBO} (platform bounds).` });
    const material = await prisma.material.create({
      data: {
        courseId: id, lecturerId: lecturer.id, title: b.title, type: b.type,
        description: b.description, priceKobo: b.isFree ? 0 : (b.priceKobo ?? 0),
        isFree: b.isFree ?? true, accessDurationDays: b.accessDurationDays ?? null,
        status: "draft", version: 1,
      },
    });
    if (b.fileKey) {
      await prisma.materialVersion.create({
        data: { materialId: material.id, version: 1, fileKey: b.fileKey, checksum: b.checksum ?? "dev-mock", pageCount: 10 },
      });
    }
    return material;
  });

  // lecturer confirms ownership → pendingReview (own course only)
  app.post("/materials/:id/submit", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    if (mat.status !== "draft") return reply.code(400).send({ error: `Cannot submit from ${mat.status}.` });
    const updated = await prisma.material.update({ where: { id }, data: { status: "pendingReview" } });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "material.submitted", targetType: "Material", targetId: id },
    });
    return updated;
  });

  // platform review queue
  app.get("/reviews/queue", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Reviewers only." });
    return prisma.material.findMany({
      where: { status: "pendingReview" },
      include: { course: true },
      orderBy: { createdAt: "asc" },
    });
  });

  // approve → published | reject → draft
  app.post("/materials/:id/review", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "Reviewers only." });
    const { id } = req.params as { id: string };
    const b = req.body as { decision: "approve" | "reject"; reason?: string };
    const updated = await prisma.material.update({
      where: { id },
      data: { status: b.decision === "approve" ? "published" : "draft" },
    });
    await prisma.auditLog.create({
      data: {
        actorId: user.id, action: `material.review.${b.decision}d`,
        targetType: "Material", targetId: id, meta: b.reason ?? null,
      },
    });
    // notify approved enrollments of new official material
    if (b.decision === "approve") {
      const { indexMaterial } = await import("./ai.js");
      await indexMaterial(id);
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: updated.courseId, status: "approved" },
        select: { student: { select: { userId: true } } },
      });
      if (enrollments.length) {
        await prisma.notification.createMany({
          data: enrollments.map((e) => ({
            userId: e.student.userId, type: "new-material",
            title: `New material: ${updated.title}`, body: `Official v${updated.version} now available.`,
          })),
        });
      }
    }
    return updated;
  });

  // archive (own course only)
  app.post("/materials/:id/archive", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    await prisma.auditLog.create({
      data: { actorId: user.id, action: "material.archived", targetType: "Material", targetId: id },
    });
    return prisma.material.update({ where: { id }, data: { status: "archived" } });
  });

  // material detail (entitlement-aware: unpublished visible to lecturer/staff only)
  app.get("/materials/:id", async (req, reply) => {
    const user = await currentUser(req);
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({
      where: { id }, include: { versions: { orderBy: { version: "desc" } }, course: true },
    });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (mat.status !== "published") {
      const ok =
        !!user &&
        ((await ownsCourse(user, mat.course)) ||
          (mat.status === "pendingReview" &&
            (user.role === "institutionAdmin" || user.role === "platformAdmin")));
      if (!ok) return reply.code(403).send({ error: "forbidden:not-published" });
    }
    return mat;
  });

  // protected page URL (entitlement + expiry enforced; R2 presigned URLs in reader spike)
  app.get("/materials/:id/pages/:n/url", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id, n } = req.params as { id: string; n: string };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat || mat.status !== "published") return reply.code(403).send({ error: "forbidden:not-published" });
    if (user.role === "student") {
      if (!user.studentProfile) return reply.code(403).send({ error: "forbidden:role:student" });
      const enrollment = await prisma.enrollment.findUnique({
        where: { courseId_studentId: { courseId: mat.courseId, studentId: user.studentProfile.id } },
      });
      if (!enrollment || enrollment.status !== "approved")
        return reply.code(403).send({ error: "forbidden:course-access" });
      if (!mat.isFree) {
        const purchase = await prisma.purchase.findFirst({
          where: { studentId: user.studentProfile.id, materialId: id, status: "completed" },
          orderBy: { createdAt: "desc" },
        });
        if (!purchase) return reply.code(402).send({ error: "Purchase required.", priceKobo: mat.priceKobo });
        if (purchase.accessExpiresAt && purchase.accessExpiresAt.getTime() < Date.now())
          return reply.code(402).send({ error: "Access expired. Renew to continue reading.", priceKobo: mat.priceKobo });
      }
    } else if (!(await ownsCourse(user, mat.course))) {
      return reply.code(403).send({ error: "forbidden:course-ownership" });
    }
    const page = Number(n);
    // log study event (dwell tracked client-side on next ping)
    if (user?.role === "student") {
      await prisma.studyEvent.create({
        data: { studentId: user.studentProfile!.id, courseId: mat.courseId, materialId: id, type: "page-view", page },
      });
    }
    return {
      page, materialId: id, version: mat.version,
      url: `mock://pages/${id}/v${mat.version}/p${page}`,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      note: "R2 presigned URL lands in reader spike; shell renders styled page + watermark meanwhile.",
    };
  });
}
