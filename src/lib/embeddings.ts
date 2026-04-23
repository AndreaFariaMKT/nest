// Voyage AI embeddings wrapper for semantic memory.
//
// When VOYAGE_API_KEY is unset, all calls fall back to no-op (`null`) so the
// feature degrades gracefully — the content engine just skips the retrieval
// augmentation and uses the chronological "last N titles" strategy instead.
//
// Voyage was chosen because Anthropic officially recommends it (see
// https://docs.claude.com/en/docs/build-with-claude/embeddings) and because
// voyage-3.5 outperforms OpenAI's text-embedding-3-small at the same dim.

export const EMBEDDING_MODEL = "voyage-3.5";
export const EMBEDDING_DIMS = 1024;
const API_URL = "https://api.voyageai.com/v1/embeddings";

// ───────────────────────────────────────────────────────────────────────────
// Env guard
// ───────────────────────────────────────────────────────────────────────────

export function hasEmbeddingsProvider(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return ((env.VOYAGE_API_KEY ?? "").trim()).length > 0;
}

// ───────────────────────────────────────────────────────────────────────────
// Embedding — returns null when provider unconfigured (graceful no-op)
// ───────────────────────────────────────────────────────────────────────────

export type EmbedResult = {
  vector: number[];
  tokensUsed: number;
};

export async function embedText(text: string): Promise<EmbedResult | null> {
  const key = (process.env.VOYAGE_API_KEY ?? "").trim();
  if (!key) return null;
  const result = await embedBatch([text]);
  if (!result) return null;
  return {
    vector: result.vectors[0],
    tokensUsed: result.tokensUsed,
  };
}

export async function embedBatch(
  texts: string[],
): Promise<{ vectors: number[][]; tokensUsed: number } | null> {
  const key = (process.env.VOYAGE_API_KEY ?? "").trim();
  if (!key) return null;
  if (texts.length === 0) return { vectors: [], tokensUsed: 0 };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ input: texts, model: EMBEDDING_MODEL }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voyage API ${response.status}: ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage?: { total_tokens?: number };
  };
  return {
    vectors: body.data.map((d) => d.embedding),
    tokensUsed: body.usage?.total_tokens ?? 0,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────────

/** Cosine similarity in [-1, 1]. 1 = identical, 0 = orthogonal, −1 = opposite. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/** pgvector text literal: "[1.2,3.4,…]" — no quoting, just brackets + commas. */
export function vectorToSql(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Parse a pgvector text output back into a number[]. */
export function parseVector(s: string): number[] {
  const trimmed = s.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error("invalid pgvector literal");
  }
  const inner = trimmed.slice(1, -1);
  if (inner.length === 0) return [];
  return inner.split(",").map((part) => {
    const n = Number(part.trim());
    if (!Number.isFinite(n)) throw new Error(`non-numeric component: ${part}`);
    return n;
  });
}

/**
 * Build the composite text we embed for a draft. Includes enough signal to
 * disambiguate themes without blowing up the token count: title + pillar +
 * hook. Hashtags and captions vary too much run-to-run to be good signal.
 */
export function buildDraftEmbedText(draft: {
  title: string;
  pillar: string | null;
  hook: string | null;
}): string {
  return [draft.title, draft.pillar, draft.hook]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" · ");
}
