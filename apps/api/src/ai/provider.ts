// AI provider adapter (§11): one interface, swappable backends.
// - MockProvider (default): extractive answers from retrieved chunks. Used for
//   local tests and whenever no LLM key is configured. Deterministic.
// - OpenAICompatibleProvider: activated ONLY when LLM_API_KEY (+ optional
//   LLM_BASE_URL / LLM_MODEL) is set. Server-side fetch; keys never leave the
//   server and are NEVER exposed to browser code (no NEXT_PUBLIC_*, no client
//   bundle references — grep to verify).

export interface AiCitation {
  materialTitle: string;
  edition: string;
  chunkNo: number;
  sourceType: "lecturer-material" | "lecturer-answer";
}

export interface AiAnswer {
  /** Course Material Answer (grounded) or Additional Academic Context (general). */
  label: "course-material" | "general";
  text: string;
  citations: AiCitation[];
}

export interface AiProvider {
  name: string;
  generate(system: string, question: string, chunks: { text: string; title: string; version: number; chunkNo: number; sourceType: AiCitation["sourceType"] }[]): Promise<AiAnswer>;
}

export class MockProvider implements AiProvider {
  name = "mock";
  async generate(
    _system: string,
    _question: string,
    chunks: { text: string; title: string; version: number; chunkNo: number; sourceType: AiCitation["sourceType"] }[],
  ): Promise<AiAnswer> {
    return {
      label: "course-material",
      text: `From your authorized materials: ${chunks.map((c) => c.text).join(" ")}`,
      citations: chunks.map((c) => ({
        materialTitle: c.title, edition: `v${c.version}`, chunkNo: c.chunkNo, sourceType: c.sourceType,
      })),
    };
  }
}

export class OpenAICompatibleProvider implements AiProvider {
  name = "openai-compatible";
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  constructor() {
    const key = process.env.LLM_API_KEY;
    if (!key) throw new Error("LLM_API_KEY is not configured.");
    this.apiKey = key;
    this.baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    // TODO(DECISION): confirm model + spend caps with the team before enabling.
    this.model = process.env.LLM_MODEL ?? "gpt-4o-mini";
  }
  async generate(
    system: string,
    question: string,
    chunks: { text: string; title: string; version: number; chunkNo: number; sourceType: AiCitation["sourceType"] }[],
  ): Promise<AiAnswer> {
    const context = chunks
      .map((c, i) => `[${i + 1}] ${c.title} v${c.version} (chunk ${c.chunkNo}, ${c.sourceType}): ${c.text}`)
      .join("\n");
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Authorized course context:\n${context}\n\nStudent question: ${question}\n\nAnswer ONLY from the authorized context above. Cite sources as [n]. If the context lacks the answer, say so and do not invent.` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM provider error: ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new Error("LLM provider returned no text.");
    return {
      label: "course-material",
      text,
      citations: chunks.map((c) => ({
        materialTitle: c.title, edition: `v${c.version}`, chunkNo: c.chunkNo, sourceType: c.sourceType,
      })),
    };
  }
}

export function activeProvider(): AiProvider {
  if (process.env.LLM_API_KEY) {
    try {
      return new OpenAICompatibleProvider();
    } catch (e) {
      console.error("[ai] LLM provider misconfigured, falling back to mock:", (e as Error).message);
    }
  }
  return new MockProvider();
}
