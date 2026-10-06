// Refusal policy (§11): explicit, coded, testable. The assistant refuses or
// redirects (never fabricates) when:
//   UNAUTHORIZED — content exists but the student may not access it
//   INSUFFICIENT — nothing authorized covers the question
//   RESTRICTED   — the request targets private/restricted content
//                  (answer keys, other students' work, exams) or smuggles
//                  instructions (prompt injection).

export type RefusalCode = "UNAUTHORIZED" | "INSUFFICIENT" | "RESTRICTED";

export interface Refusal {
  code: RefusalCode;
  message: string;
}

const RESTRICTED_PATTERNS = [
  /answer\s*key/i,
  /correct\s*answer/i,
  /exam\s*(questions?|paper|leak)/i,
  /other students?('|s)?\s*(work|answer|grade|score)/i,
  /ignore\s+(previous|prior|all)\s+instructions?/i,
  /disregard.*(rules|instructions)/i,
  /you are now/i,
  /system\s*prompt/i,
];

export function classifyRefusal(question: string, hasEntitlement: boolean, hasHits: boolean): Refusal | null {
  for (const re of RESTRICTED_PATTERNS) {
    if (re.test(question)) {
      return {
        code: "RESTRICTED",
        message:
          "I can't help with that — it asks for restricted content (answer keys, other students' work, or exam material) or contains instructions I'm required to ignore. Ask your lecturer in Course Q&A instead.",
      };
    }
  }
  if (!hasEntitlement) {
    return {
      code: "UNAUTHORIZED",
      message:
        "That material isn't in your authorized courses. Enroll in the course (lecturer approval required) or purchase access first — I can only use materials you're entitled to.",
    };
  }
  if (!hasHits) {
    return {
      code: "INSUFFICIENT",
      message:
        "No authorized course material covers this yet. I won't guess — ask your lecturer in Course Q&A, where the whole class benefits from the answer.",
    };
  }
  return null;
}
