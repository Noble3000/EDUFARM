// Retrieval service (§11): entitlement-scoped full-text search ONLY.
// Inputs are always post-firewall material ids. Sources:
//   1. lecturer-material chunks (MaterialChunk, primary)
//   2. lecturer answers in course Q&A (secondary, labeled as such)
// Student-authored content is never retrieved. Answer keys, grades, and
// unpublished materials are unreachable by construction (not queried).

import { prisma } from "../db.js";
import type { AiCitation } from "./provider.js";

export interface RetrievedChunk {
  text: string;
  title: string;
  version: number;
  chunkNo: number;
  sourceType: AiCitation["sourceType"];
  rank: number;
}

export async function retrieve(
  question: string,
  materialIds: string[],
  courseId: string,
  limit = 5,
): Promise<RetrievedChunk[]> {
  if (!materialIds.length) return [];
  const chunks = await prisma.$queryRaw<{ text: string; title: string; version: number; chunkNo: number; rank: number }[]>`
    SELECT c."text", m."title", m."version", c."chunkNo",
           ts_rank(to_tsvector('english', c."text"), plainto_tsquery('english', ${question})) AS rank
    FROM "MaterialChunk" c JOIN "Material" m ON m."id" = c."materialId"
    WHERE c."materialId" = ANY(${materialIds})
      AND m."status" = 'published'
      AND to_tsvector('english', c."text") @@ plainto_tsquery('english', ${question})
    ORDER BY rank DESC LIMIT ${limit}`;
  const out: RetrievedChunk[] = chunks.map((c) => ({ ...c, sourceType: "lecturer-material" as const }));
  if (out.length < limit) {
    const answers = await prisma.$queryRaw<{ body: string; rank: number }[]>`
      SELECT a."body", ts_rank(to_tsvector('english', a."body"), plainto_tsquery('english', ${question})) AS rank
      FROM "Answer" a JOIN "Question" q ON q."id" = a."questionId"
      WHERE q."courseId" = ${courseId} AND a."isLecturer" = true
        AND to_tsvector('english', a."body") @@ plainto_tsquery('english', ${question})
      ORDER BY rank DESC LIMIT ${limit - out.length}`;
    for (const a of answers) {
      out.push({ text: a.body, title: "Lecturer Q&A answer", version: 0, chunkNo: 0, sourceType: "lecturer-answer", rank: a.rank });
    }
  }
  return out;
}
