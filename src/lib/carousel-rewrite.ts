// Pure helpers for the "refine an existing draft" flow.
//
// Unlike the carousel-prompt.ts helpers (which generate drafts from a
// transcript), these take an already-existing draft and a user instruction
// and ask Claude for a revised version of the SAME draft.

import type { BrandColor, BrandTypography } from "@/types/database";

export type SlideInput = {
  position: number;
  headline: string | null;
  body: string | null;
};

export type DraftSnapshot = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: SlideInput[];
};

export type RewriteBrand = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
  voiceTone: string | null;
  doList: string[];
  dontList: string[];
};

export type RewriteResult = {
  slides: Array<{ headline: string; body: string }>;
  hook: string | null;
  caption: string | null;
  notes: string | null;
};

const LANG_LABEL = (code: string) =>
  code.toLowerCase().startsWith("pt")
    ? "Portuguese (Brazil)"
    : code.toLowerCase().startsWith("en")
      ? "English"
      : code;

function renderBrand(brand: RewriteBrand | null): string {
  if (!brand) return "<no brand kit configured>";
  const lines = [`Brand: ${brand.name}`];
  if (brand.palette.length > 0) {
    lines.push(
      `Palette: ${brand.palette.map((c) => `${c.name} (${c.hex})`).join(", ")}`,
    );
  }
  if (brand.typography?.headings || brand.typography?.body) {
    lines.push(
      `Typography: headings=${brand.typography.headings || "—"}, body=${brand.typography.body || "—"}`,
    );
  }
  if (brand.voiceTone) lines.push(`Voice & tone: ${brand.voiceTone}`);
  if (brand.doList.length > 0)
    lines.push(`Do:\n${brand.doList.map((x) => `  - ${x}`).join("\n")}`);
  if (brand.dontList.length > 0)
    lines.push(`Don't:\n${brand.dontList.map((x) => `  - ${x}`).join("\n")}`);
  return lines.join("\n");
}

export function buildRewriteSystem(
  brand: RewriteBrand | null,
  language: string,
): string {
  const lang = LANG_LABEL(language);
  return `You are a senior content strategist refining an existing Instagram carousel draft.

Language of output: ${lang}. Write naturally in that language — keep the language the draft already uses.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "slides": [
    { "headline": "revised slide headline — max 10 words", "body": "revised slide body — max 60 words" }
  ],
  "hook": "string | null — revised opening hook",
  "caption": "string | null — revised Instagram caption",
  "notes": "string | null — one short sentence summarizing what changed (<= 140 chars)"
}

Rules:
- Return the SAME number of slides as the input, in the SAME order. Don't add or drop slides unless the user's instruction explicitly asks for it.
- Preserve the draft's voice/tone + brand constraints below.
- Only change what the user asked for. Leave everything else as-is.
- Never include markdown fences (\`\`\`) in your output.

Brand context:

${renderBrand(brand)}`;
}

export function buildRewriteUser(
  draft: DraftSnapshot,
  instruction: string,
  language: string,
): string {
  const lang = LANG_LABEL(language);
  const slidesText = draft.slides
    .map(
      (s) =>
        `Slide ${s.position}:\n  headline: ${s.headline ?? ""}\n  body: ${s.body ?? ""}`,
    )
    .join("\n");
  return `Language: ${lang}.

<current_draft>
title: ${draft.title}
pillar: ${draft.pillar ?? ""}
hook: ${draft.hook ?? ""}
caption: ${draft.caption ?? ""}
hashtags: ${draft.hashtags.join(" ")}

${slidesText}
</current_draft>

<user_instruction>
${instruction.trim()}
</user_instruction>

Return the revised JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class RewriteParseError extends Error {}

export function parseRewritePayload(
  raw: string,
  expectedSlides: number,
): RewriteResult {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) throw new RewriteParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new RewriteParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RewriteParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;
  const slidesRaw = root.slides;
  if (!Array.isArray(slidesRaw)) {
    throw new RewriteParseError("`slides` must be an array");
  }
  if (slidesRaw.length !== expectedSlides) {
    throw new RewriteParseError(
      `expected ${expectedSlides} slides, got ${slidesRaw.length}`,
    );
  }

  const slides: Array<{ headline: string; body: string }> = [];
  for (const s of slidesRaw) {
    if (!s || typeof s !== "object") {
      throw new RewriteParseError("slide entry must be an object");
    }
    const row = s as Record<string, unknown>;
    const headline =
      typeof row.headline === "string" ? row.headline.trim() : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!headline && !body) {
      throw new RewriteParseError("slide must have headline or body");
    }
    slides.push({ headline, body });
  }

  const readNullable = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  return {
    slides,
    hook: readNullable(root.hook),
    caption: readNullable(root.caption),
    notes: readNullable(root.notes),
  };
}
