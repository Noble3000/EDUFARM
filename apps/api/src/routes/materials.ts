// Materials lifecycle (§8.4), hardened:
//   draft → pendingLecturer → pendingReview → published → archived
//   published →(new-version)→ pendingReview → published (new edition) | published (old kept)
// Rules: lecturer ownership attestation before review; platform review gates
// every publish; editions are rows (never mutated once live); version flips
// only on approval; rejects restore prior state; everything audited.
// Types (§8.1, fixed set): lecture-notes | course-pack | revision-guide |
// practice-questions | exam-prep | study-guide.

import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { audit, ownsCourse, sessionUser as currentUser } from "../authz.js";
import { assertGrant } from "../hierarchy-guard.js";

const MIN_KOBO = 10000; // ₦100
const MAX_KOBO = 200000; // ₦2,000

export const MATERIAL_TYPES = [
  "lecture-notes",
  "course-pack",
  "revision-guide",
  "practice-questions",
  "exam-prep",
  "study-guide",
] as const;

async function lecturerOf(userId: string) {
  return prisma.lecturerProfile.findUnique({ where: { userId } });
}

export async function materialRoutes(app: FastifyInstance) {
  // lecturer's own materials across courses (all statuses, for lifecycle management)
  app.get("/lecturer/materials", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const lecturer = await lecturerOf(user.id);
    if (!lecturer) return reply.code(403).send({ error: "forbidden:lecturer-profile-required" });
    return prisma.material.findMany({
      where: { lecturerId: lecturer.id },
      include: { course: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  // entitled material search: titles/descriptions/type ONLY for materials the
  // caller may access (enrolled students: free + purchased; lecturers: own
  // course incl. drafts; staff: all). fileKey/checksum never leave the server.
  app.get("/courses/:id/materials/search", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const q = req.query as { q?: string; type?: string };
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return reply.code(404).send({ error: "not-found:course" });
    const text = (q.q ?? "").trim();
    const match = text
      ? { OR: [{ title: { contains: text, mode: "insensitive" as const } }, { description: { contains: text, mode: "insensitive" as const } }] }
      : {};
    const typeFilter = q.type ? { type: q.type } : {};
    const select = { id: true, title: true, type: true, version: true, priceKobo: true, isFree: true, status: true, accessDurationDays: true };
    if (user.role === "student") {
      if (!user.studentProfile) return reply.code(403).send({ error: "forbidden:role:student" });
      const enrollment = await prisma.enrollment.findUnique({
        where: { courseId_studentId: { courseId: id, studentId: user.studentProfile.id } },
      });
      if (!enrollment || enrollment.status !== "approved")
        return reply.code(403).send({ error: "forbidden:course-access" });
      const owned = await prisma.purchase.findMany({
        where: { studentId: user.studentProfile.id, materialId: { not: null }, status: "completed" },
        select: { materialId: true },
      });
      const ownedIds = new Set(owned.map((p) => p.materialId as string));
      const mats = await prisma.material.findMany({
        where: { courseId: id, status: "published", ...match, ...typeFilter },
        select,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return mats.filter((m) => m.isFree || ownedIds.has(m.id));
    }
    if (!(await ownsCourse(user, course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    return prisma.material.findMany({
      where: { courseId: id, ...match, ...typeFilter },
      select,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  // lecturer uploads → pendingLecturer (awaiting their own ownership approval)
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
    if (!b.title) return reply.code(400).send({ error: "auth-invalid: title required." });
    if (!MATERIAL_TYPES.includes(b.type as never))
      return reply.code(400).send({ error: `auth-invalid: type must be one of ${MATERIAL_TYPES.join(", ")}` });
    if (!b.isFree && b.priceKobo != null && (b.priceKobo < MIN_KOBO || b.priceKobo > MAX_KOBO))
      return reply.code(400).send({ error: `auth-invalid: priceKobo must be ${MIN_KOBO}–${MAX_KOBO} (platform bounds).` });
    if (b.accessDurationDays != null && (!Number.isInteger(b.accessDurationDays) || b.accessDurationDays < 1 || b.accessDurationDays > 730))
      return reply.code(400).send({ error: "auth-invalid: accessDurationDays must be 1–730." });
    const material = await prisma.material.create({
      data: {
        courseId: id, lecturerId: lecturer.id, title: b.title, type: b.type,
        description: b.description, priceKobo: b.isFree ? 0 : (b.priceKobo ?? 0),
        isFree: b.isFree ?? true, accessDurationDays: b.accessDurationDays ?? null,
        status: "pendingLecturer", version: 0,
      },
    });
    if (b.fileKey) {
      await prisma.materialVersion.create({
        data: { materialId: material.id, version: 1, fileKey: b.fileKey, checksum: b.checksum ?? "dev-mock", pageCount: 10 },
      });
      await prisma.material.update({ where: { id: material.id }, data: { pendingVersion: 1 } });
    }
    await audit(user.id, "material.uploaded", "Material", material.id, `${b.type} v1-staged`);
    return material;
  });

  // lecturer ownership approval → pendingReview (explicit attestation, audited).
  // Also serves as the legacy /submit path.
  app.post("/materials/:id/approve", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { attest?: boolean };
    if (b.attest !== true)
      return reply.code(400).send({ error: "auth-invalid: attest:true required — confirm you own and authorize this material." });
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    if (mat.status !== "draft" && mat.status !== "pendingLecturer")
      return reply.code(400).send({ error: `auth-invalid: cannot approve from ${mat.status}.` });
    const updated = await prisma.material.update({ where: { id }, data: { status: "pendingReview" } });
    await audit(user.id, "material.approved", "Material", id, "ownership-attested");
    return updated;
  });

  app.post("/materials/:id/submit", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { attest?: boolean };
    if (b.attest !== true)
      return reply.code(400).send({ error: "auth-invalid: attest:true required — confirm you own and authorize this material." });
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    if (mat.status !== "draft" && mat.status !== "pendingLecturer")
      return reply.code(400).send({ error: `auth-invalid: cannot submit from ${mat.status}.` });
    const updated = await prisma.material.update({ where: { id }, data: { status: "pendingReview" } });
    await audit(user.id, "material.submitted", "Material", id, "ownership-attested");
    return updated;
  });

  // new edition of a PUBLISHED material → staged row + back to review.
  // Live edition untouched until approval (never silently replaced).
  app.post("/materials/:id/new-version", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const b = (req.body ?? {}) as { fileKey?: string; checksum?: string; pageCount?: number };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    if (mat.status !== "published")
      return reply.code(400).send({ error: `auth-invalid: new versions branch from published (now ${mat.status}).` });
    if (!b.fileKey) return reply.code(400).send({ error: "auth-invalid: fileKey required (R2 key after upload-url step)." });
    const next = mat.version + 1;
    await prisma.materialVersion.create({
      data: { materialId: id, version: next, fileKey: b.fileKey, checksum: b.checksum ?? "dev-mock", pageCount: b.pageCount ?? 10 },
    });
    const updated = await prisma.material.update({
      where: { id }, data: { pendingVersion: next, status: "pendingReview" },
    });
    await audit(user.id, "material.version.staged", "Material", id, `v${next}-staged`);
    return updated;
  });

  // platform review queue
  app.get("/reviews/queue", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:reviewer" });
    const q = req.query as { q?: string };
    return prisma.material.findMany({
      where: {
        status: "pendingReview",
        ...(q.q?.trim() ? { title: { contains: q.q.trim(), mode: "insensitive" } } : {}),
      },
      include: { course: true },
      orderBy: { createdAt: "asc" },
    });
  });

  // approve → published (flip staged edition live) | reject → prior state, staged row dropped
  app.post("/materials/:id/review", async (req, reply) => {
    const user = await currentUser(req);
    if (!user || !["platformAdmin", "institutionAdmin"].includes(user.role))
      return reply.code(403).send({ error: "forbidden:role:reviewer" });
    const { id } = req.params as { id: string };
    const b = req.body as { decision: "approve" | "reject"; reason?: string };
    if (!["approve", "reject"].includes(b?.decision))
      return reply.code(400).send({ error: "auth-invalid: decision must be approve|reject." });
    const mat = await prisma.material.findUnique({ where: { id } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (mat.status !== "pendingReview")
      return reply.code(400).send({ error: `auth-invalid: nothing under review (now ${mat.status}).` });
    if (b.decision === "approve") {
      const staged = mat.pendingVersion ?? mat.version + 1;
      const updated = await prisma.material.update({
        where: { id }, data: { status: "published", version: staged, pendingVersion: null },
      });
      await audit(user.id, "material.review.approved", "Material", id, `v${staged}-live`);
      const { indexMaterial } = await import("./ai.js");
      await indexMaterial(id);
      const { notify } = await import("../notify/center.js");
      const isRevision = staged > 1;
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId: updated.courseId, status: "approved" },
        select: { student: { select: { userId: true } } },
      });
      for (const e of enrollments) {
        await notify({
          userId: e.student.userId,
          type: isRevision ? "material-revision" : "new-material",
          title: isRevision ? `Updated edition: ${updated.title}` : `New material: ${updated.title}`,
          body: isRevision
            ? `Edition v${staged} is live — your access continues on the latest edition.`
            : `Official v${staged} now available.`,
          link: `/materials/${id}`,
          dedupKey: `publish:${id}:v${staged}`,
          email: { kind: isRevision ? "material-revision" : "material" },
        });
      }
      return updated;
    }
    // reject: drop staged row, restore prior live state (published stays live; new items go to draft)
    if (mat.pendingVersion != null) {
      await prisma.materialVersion.deleteMany({ where: { materialId: id, version: mat.pendingVersion } });
    }
    const restoreTo = mat.version > 0 ? "published" : "draft";
    const updated = await prisma.material.update({
      where: { id }, data: { status: restoreTo, pendingVersion: null },
    });
    await audit(user.id, "material.review.rejected", "Material", id, b.reason ?? null);
    return updated;
  });

  // archive (own course only, audited; purchases retained, reading blocked)
  app.post("/materials/:id/archive", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat) return reply.code(404).send({ error: "not-found:material" });
    if (!(await ownsCourse(user, mat.course))) return reply.code(403).send({ error: "forbidden:course-ownership" });
    if (mat.status === "archived") return reply.code(400).send({ error: "auth-invalid: already archived." });
    await audit(user.id, "material.archived", "Material", id, `was:${mat.status}`);
    return prisma.material.update({ where: { id }, data: { status: "archived", pendingVersion: null } });
  });

  // material detail with ownership/trust block (never leaks fileKey)
  app.get("/materials/:id", async (req, reply) => {
    const user = await currentUser(req);
    const { id } = req.params as { id: string };
    const mat = await prisma.material.findUnique({
      where: { id },
      include: {
        versions: { select: { version: true, pageCount: true, createdAt: true }, orderBy: { version: "desc" } },
        course: true,
        lecturer: { include: { user: { select: { name: true } } } },
      },
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
    const { lecturer, ...rest } = mat as typeof mat & { lecturer: { user: { name: string | null } } };
    return {
      ...rest,
      trust: {
        lecturerName: lecturer?.user?.name ?? "Unknown",
        lecturerVerified: true,
        official: mat.status === "published",
        edition: `v${mat.version}`,
        access: mat.isFree
          ? "Free official material"
          : `₦${(mat.priceKobo / 100).toFixed(2)} · ${mat.accessDurationDays ?? "ongoing"}-day access`,
      },
    };
  });

  // protected page token (entitlement + expiry enforced; resolves via /pages/:token)
  app.get("/materials/:id/pages/:n/url", async (req, reply) => {
    const user = await currentUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const { id, n } = req.params as { id: string; n: string };
    const mat = await prisma.material.findUnique({ where: { id }, include: { course: true } });
    if (!mat || mat.status !== "published") return reply.code(403).send({ error: "forbidden:not-published" });
    if (user.role === "student") {
      if (!user.studentProfile) return reply.code(403).send({ error: "forbidden:role:student" });
      const grant = await assertGrant(user.studentProfile.id, mat);
      if (!grant.ok) {
        const res = reply.code(grant.code).send({ error: grant.error, ...(grant.priceKobo != null ? { priceKobo: grant.priceKobo } : {}) });
        return res;
      }
    } else if (!(await ownsCourse(user, mat.course))) {
      return reply.code(403).send({ error: "forbidden:course-ownership" });
    }
    const page = Number(n);
    if (!Number.isInteger(page) || page < 1) return reply.code(400).send({ error: "auth-invalid: page must be ≥ 1." });
    if (user?.role === "student") {
      await prisma.studyEvent.create({
        data: { studentId: user.studentProfile!.id, courseId: mat.courseId, materialId: id, type: "page-view", page },
      });
    }
    const { mintPageToken } = await import("./storage.js");
    const { token, expiresAt } = mintPageToken(id, mat.version, page);
    return {
      page, materialId: id, version: mat.version,
      url: `/api/v1/pages/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  });
}
