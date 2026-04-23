// Pure helpers for the "adapt this draft for another platform" flow.
//
// Takes an approved (or in-review) Instagram carousel draft and asks Claude
// to produce a platform-appropriate version: LinkedIn (longer, more
// professional, insight-first) or TikTok (shorter, punchier, hook-first).
//
// Unlike carousel-rewrite, which edits the SAME draft in place, this
// generates a NEW draft that lives alongside the original.

import type { BrandColor, BrandTypography } from "@/types/database";

export type AdaptPlatform = "linkedin" | "tiktok";

export type AdaptSlideInput = {
  position: number;
  headline: string | null;
  body: string | null;
};

export type AdaptDraftSnapshot = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: AdaptSlideInput[];
};

export type AdaptBrand = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
  voiceTone: string | null;
  doList: string[];
  dontList: string[];
};

export type AdaptResult = {
  title: string;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: Array<{ headline: string; body: string }>;
};

const LANG_LABEL = (code: string) =>
  code.toLowerCase().startsWith("pt")
    ? "Portuguese (Brazil)"
    : code.toLowerCase().startsWith("en")
      ? "English"
      : code;

function renderBrand(brand: AdaptBrand | null): string {
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

const PLATFORM_RULES: Record<AdaptPlatform, string> = {
  linkedin: `Target platform: LinkedIn.
- Longer, more analytical tone — written for a business/professional audience.
- Caption up to ~3000 characters; open with an attention-grabbing insight, use short paragraphs, and end with a reflective question or CTA.
- Keep ALL slides from the source but rewrite them as short numbered insights (headline = the insight, body = 1-2 sentences of context).
- Hashtags: 3-5 max, industry-relevant (drop Instagram-only tags).
- Avoid Instagram slang and emojis in headlines; minimal emoji use in caption is OK.`,
  tiktok: `Target platform: TikTok (carousel / slideshow post).
- Short, punchy, conversational — written like a TikTok voiceover script.
- Caption under 300 characters, with a strong verbal hook in the first line.
- Keep the same number of slides but shorten each one aggressively (headline: 6 words max; body: 15 words max).
- Hashtags: 3-6 trending-friendly tags, casual tone.
- Use present tense and informal voice; emojis sparingly for emphasis.`,
};

export function buildAdaptSystem(
  brand: AdaptBrand | null,
  language: string,
  platform: AdaptPlatform,
): string {
  const lang = LANG_LABEL(language);
  return `You are a senior content strategist adapting an Instagram carousel draft for a different social platform.

Language of output: ${lang}. Write naturally in that language.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "title": "new short title for this adapted draft",
  "hook": "string | null — opening hook tailored for the target platform",
  "caption": "string | null — full caption tailored for the target platform",
  "hashtags": ["#tag1", "#tag2"],
  "slides": [
    { "headline": "slide headline", "body": "slide body" }
  ]
}

${PLATFORM_RULES[platform]}

Rules:
- Preserve the core message and pillar from the source draft — this is an adaptation, not a rewrite of the idea.
- Keep the SAME number of slides as the source, in the SAME order.
- Respect the brand constraints below.
- Return every hashtag with a leading "#".
- Never include markdown fences (\`\`\`) in your output.

Brand context:

${renderBrand(brand)}`;
}

export function buildAdaptUser(
  draft: AdaptDraftSnapshot,
  language: string,
  platform: AdaptPlatform,
): string {
  const lang = LANG_LABEL(language);
  const slidesText = draft.slides
    .map(
      (s) =>
        `Slide ${s.position}:\n  headline: ${s.headline ?? ""}\n  body: ${s.body ?? ""}`,
    )
    .join("\n");
  return `Language: ${lang}.
Target platform: ${platform}.

<source_draft>
title: ${draft.title}
pillar: ${draft.pillar ?? ""}
hook: ${draft.hook ?? ""}
caption: ${draft.caption ?? ""}
hashtags: ${draft.hashtags.join(" ")}

${slidesText}
</source_draft>

Return the adapted JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class AdaptParseError extends Error {}

export function parseAdaptPayload(
  raw: string,
  expectedSlides: number,
): AdaptResult {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) throw new AdaptParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new AdaptParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AdaptParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;

  const title = typeof root.title === "string" ? root.title.trim() : "";
  if (!title) throw new AdaptParseError("missing title");

  const slidesRaw = root.slides;
  if (!Array.isArray(slidesRaw)) {
    throw new AdaptParseError("`slides` must be an array");
  }
  if (slidesRaw.length !== expectedSlides) {
    throw new AdaptParseError(
      `expected ${expectedSlides} slides, got ${slidesRaw.length}`,
    );
  }

  const slides: Array<{ headline: string; body: string }> = [];
  for (const s of slidesRaw) {
    if (!s || typeof s !== "object") {
      throw new AdaptParseError("slide entry must be an object");
    }
    const row = s as Record<string, unknown>;
    const headline =
      typeof row.headline === "string" ? row.headline.trim() : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!headline && !body) {
      throw new AdaptParseError("slide must have headline or body");
    }
    slides.push({ headline, body });
  }

  const readNullable = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  let hashtags: string[] = [];
  if (Array.isArray(root.hashtags)) {
    hashtags = (root.hashtags as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
  }

  return {
    title,
    hook: readNullable(root.hook),
    caption: readNullable(root.caption),
    hashtags,
    slides,
  };
}
