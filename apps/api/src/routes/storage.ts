// Storage boundary (§8.5): server-controlled page access.
// Two backends behind one contract:
//   - R2 (Cloudflare private buckets) when R2_* env is present: short-lived
//     presigned GETs for rendered page objects. Raw keys never leave the server.
//   - Local mock otherwise: pages resolve to a signed token URL only (the shell
//     renders placeholders until the render worker lands).
// Page tokens: HMAC-SHA256(materialId, version, page, exp) — 60s validity,
// re-validated (entitlement + expiry) on every resolve. No raw storage URLs
// are ever exposed to clients in either mode.
// Boundary (documented, not promised): photos of screens by external devices
// cannot be prevented; the platform blocks its own download/offline/export/
// capture pathways and deters with watermark + identity.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { sessionUser } from "../authz.js";

const PAGE_TTL_MS = 60_000;

function pageSecret(): string {
  const s = process.env.PAGE_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "dev-only-page-secret";
  if (!process.env.PAGE_TOKEN_SECRET && process.env.NODE_ENV === "production") {
    console.warn("[storage] PAGE_TOKEN_SECRET unset — using fallback (set it before shared use).");
  }
  return s;
}

export function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

export function mintPageToken(materialId: string, version: number, page: number): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + PAGE_TTL_MS);
  const payload = `${materialId}.${version}.${page}.${expiresAt.getTime()}`;
  const sig = createHmac("sha256", pageSecret()).update(payload).digest("hex");
  const token = Buffer.from(`${payload}.${sig}`).toString("base64url");
  return { token, expiresAt };
}

export function verifyPageToken(token: string): { materialId: string; version: number; page: number } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const [materialId, version, page, exp, sig] = raw.split(".");
    if (!materialId || !version || !page || !exp || !sig) return null;
    if (Number(exp) < Date.now()) return null;
    const expect = createHmac("sha256", pageSecret()).update(`${materialId}.${version}.${page}.${exp}`).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expect, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { materialId, version: Number(version), page: Number(page) };
  } catch {
    return null;
  }
}

async function r2PresignedGet(key: string, seconds = 60): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_PAGES ?? "edufarm-pages", Key: key }),
    { expiresIn: seconds },
  );
}

export async function storageRoutes(app: FastifyInstance) {
  // Resolve a page token → 302 to R2 presigned URL (when configured),
  // else 410 with the honest mock message. Entitlement re-checked here,
  // so a leaked token is useless past 60s and useless without entitlement.
  app.get("/pages/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    const claim = verifyPageToken(token);
    if (!claim) return reply.code(403).send({ error: "forbidden:page-token" });
    const user = await sessionUser(req);
    if (!user) return reply.code(401).send({ error: "auth-required" });
    const mat = await prisma.material.findUnique({ where: { id: claim.materialId } });
    if (!mat || mat.status !== "published" || mat.version !== claim.version)
      return reply.code(403).send({ error: "forbidden:not-published" });
    if (user.role === "student") {
      if (!user.studentProfile) return reply.code(403).send({ error: "forbidden:role:student" });
      const enrollment = await prisma.enrollment.findUnique({
        where: { courseId_studentId: { courseId: mat.courseId, studentId: user.studentProfile.id } },
      });
      if (!enrollment || enrollment.status !== "approved")
        return reply.code(403).send({ error: "forbidden:course-access" });
      if (!mat.isFree) {
        const purchase = await prisma.purchase.findFirst({
          where: { studentId: user.studentProfile.id, materialId: mat.id, status: "completed" },
          orderBy: { createdAt: "desc" },
        });
        if (!purchase) return reply.code(402).send({ error: "Purchase required.", priceKobo: mat.priceKobo });
        if (purchase.accessExpiresAt && purchase.accessExpiresAt.getTime() < Date.now())
          return reply.code(402).send({ error: "Access expired. Renew to continue reading.", priceKobo: mat.priceKobo });
      }
    }
    if (r2Configured()) {
      const url = await r2PresignedGet(`${mat.id}/v${claim.version}/p${claim.page}.webp`);
      return reply.redirect(url);
    }
    return reply.code(410).send({
      error: "render-pending",
      message: "Page rendering lands with the R2 worker; the reader shell shows placeholders meanwhile. No download/export path exists by design.",
      fingerprint: createHash("sha256").update(token).digest("hex").slice(0, 12),
    });
  });
}
