// Citation formatter (§11): every grounded claim carries structured provenance.
// Shape: material title · edition/version · chunk identifier · source type.
// The formatter is the ONLY place citation strings are built, so the UI
// contract cannot drift between providers.

import type { AiCitation } from "./provider.js";

export interface FormattedCitation {
  materialTitle: string;
  edition: string;
  chunk: string;
  sourceType: AiCitation["sourceType"];
  label: string;
}

export function formatCitations(citations: AiCitation[]): FormattedCitation[] {
  return citations.map((c) => ({
    materialTitle: c.materialTitle,
    edition: c.edition,
    chunk: c.sourceType === "lecturer-material" ? `chunk ${c.chunkNo}` : "Q&A answer",
    sourceType: c.sourceType,
    label: `[${c.materialTitle} ${c.edition}]`,
  }));
}
