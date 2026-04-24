import Anthropic from "@anthropic-ai/sdk";

/**
 * Model router — picks the right Claude model for the job.
 *
 * Rationale (see HANDOFF §2 and ROADMAP §3 Sprint 5-6):
 * - content: default carousel / caption / long-form text generation
 * - refine:  slow but better — use for creative refinement, complex edits
 * - extract: fast + cheap — transcription parsing, task extraction, classification
 */
export type ModelKind = "content" | "refine" | "extract";

export const MODELS = {
  content: "claude-sonnet-4-6",
  refine: "claude-opus-4-7",
  extract: "claude-haiku-4-5",
} as const satisfies Record<ModelKind, string>;

export function modelFor(kind: ModelKind): string {
  return MODELS[kind];
}

// ───────────────────────────────────────────────────────────────────────────
// Client singleton
// ───────────────────────────────────────────────────────────────────────────

let cachedClient: Anthropic | null = null;

function client(): Anthropic {
  if (!cachedClient) {
    // Explicitly pass apiKey — the SDK's auto-detect occasionally misses it
    // in Next.js dev server reloads, surfacing as a confusing
    // "Could not resolve authentication method" at the first call site.
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
      );
    }
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

// ───────────────────────────────────────────────────────────────────────────
// System prompt helpers (prompt caching)
// ───────────────────────────────────────────────────────────────────────────

export type SystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

/**
 * Build a system prompt that caches the brand-specific portion.
 *
 * Render order is tools → system → messages. Putting the stable brand
 * context as a single cached block means repeated carousel generations
 * for the same client read from cache (~0.1× cost) instead of re-processing
 * the full brand kit every time.
 *
 * Cache breakpoints: single `cache_control: ephemeral` on this block.
 * The next cacheable block is typically the last user message.
 */
export function systemWithCachedBrand(
  baseSystemText: string,
  brandContextText: string,
): SystemBlock[] {
  return [
    {
      type: "text",
      text: `${baseSystemText}\n\n<brand_context>\n${brandContextText}\n</brand_context>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

// ───────────────────────────────────────────────────────────────────────────
// generate() — the one function everything else will call
// ───────────────────────────────────────────────────────────────────────────

export type GenerateParams = {
  kind: ModelKind;
  system: string | SystemBlock[];
  messages: Anthropic.MessageParam[];
  /** Default: 16_000 (non-streaming) or 64_000 (streaming). */
  maxTokens?: number;
  /** Adaptive thinking (sonnet/opus only; ignored on haiku). Default: false. */
  thinking?: boolean;
  /** Stream + await finalMessage() — required for `maxTokens` > 16k. Default: false. */
  stream?: boolean;
};

export type GenerateResult = {
  text: string;
  stopReason: Anthropic.Message["stop_reason"];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
};

export async function generate(
  params: GenerateParams,
): Promise<GenerateResult> {
  const {
    kind,
    system,
    messages,
    thinking = false,
    stream = false,
  } = params;
  const maxTokens = params.maxTokens ?? (stream ? 64_000 : 16_000);

  const model = modelFor(kind);
  const systemBlocks: SystemBlock[] =
    typeof system === "string" ? [{ type: "text", text: system }] : system;

  // Adaptive thinking is unsupported on haiku — gate by model kind.
  const useThinking = thinking && kind !== "extract";

  const baseParams: Anthropic.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    system: systemBlocks,
    messages,
    ...(useThinking ? { thinking: { type: "adaptive" as const } } : {}),
  };

  if (stream) {
    const streaming = client().messages.stream(baseParams);
    return formatResult(await streaming.finalMessage());
  }
  const response = await client().messages.create(baseParams);
  return formatResult(response as Anthropic.Message);
}

function formatResult(message: Anthropic.Message): GenerateResult {
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return {
    text,
    stopReason: message.stop_reason,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
