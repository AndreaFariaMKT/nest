// Pure helpers for generating Instagram Stories from an approved carousel.
//
// Unlike carousel-adapt (which produces another carousel), this creates
// short-form story slides designed for the 9:16 full-bleed Stories format.
// Output: 3 stories by default, each with a headline + body + an optional
// sticker_cta (e.g., "Swipe up", "Link in bio", "Save this post").

import type { BrandColor, BrandTypography } from "@/types/database";

export type StorySourceSlide = {
  position: number;
  headline: string | null;
  body: string | null;
};

export type StorySourceDraft = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: StorySourceSlide[];
};

export type StoryBrand = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
  voiceTone: string | null;
  doList: string[];
  dontList: string[];
};

export type GeneratedStory = {
  headline: string;
  body: string;
  stickerCta: string | null;
};

export type StoryGenResult = {
  stories: GeneratedStory[];
};

const LANG_LABEL = (code: string) =>
  code.toLowerCase().startsWith("pt")
    ? "Portuguese (Brazil)"
    : code.toLowerCase().startsWith("en")
      ? "English"
      : code;

function renderBrand(brand: StoryBrand | null): string {
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

export function buildStorySystem(
  brand: StoryBrand | null,
  language: string,
  count: number,
): string {
  const lang = LANG_LABEL(language);
  return `You are a senior content strategist producing Instagram Stories that promote a carousel post.

Language of output: ${lang}. Write naturally in that language.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "stories": [
    {
      "headline": "short, bold statement — max 8 words",
      "body": "1-2 sentences expanding the headline — max 25 words",
      "sticker_cta": "string | null — the sticker label, e.g., 'Swipe up', 'Link in bio', 'Save this', 'Read more'"
    }
  ]
}

Rules:
- Produce exactly ${count} stories, ordered as a narrative arc: tease → insight → CTA.
- Each story is standalone; someone who misses story 2 should still get story 3.
- The last story MUST include a sticker_cta that nudges the viewer to the carousel.
- Keep the tone punchy and visual — stories are consumed in under 5 seconds each.
- Don't recycle the carousel's exact sentences; paraphrase and shorten.
- Never include markdown fences (\`\`\`) in your output.

Brand context:

${renderBrand(brand)}`;
}

export function buildStoryUser(
  draft: StorySourceDraft,
  language: string,
  count: number,
): string {
  const lang = LANG_LABEL(language);
  const slidesText = draft.slides
    .map(
      (s) =>
        `Slide ${s.position}:\n  headline: ${s.headline ?? ""}\n  body: ${s.body ?? ""}`,
    )
    .join("\n");
  return `Language: ${lang}.
Generate ${count} Instagram Stories that tease this approved carousel.

<source_carousel>
title: ${draft.title}
pillar: ${draft.pillar ?? ""}
hook: ${draft.hook ?? ""}
caption: ${draft.caption ?? ""}
hashtags: ${draft.hashtags.join(" ")}

${slidesText}
</source_carousel>

Return the JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class StoryParseError extends Error {}

export function parseStoryPayload(
  raw: string,
  expectedCount: number,
): StoryGenResult {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) throw new StoryParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new StoryParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StoryParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;

  const storiesRaw = root.stories;
  if (!Array.isArray(storiesRaw)) {
    throw new StoryParseError("`stories` must be an array");
  }
  if (storiesRaw.length !== expectedCount) {
    throw new StoryParseError(
      `expected ${expectedCount} stories, got ${storiesRaw.length}`,
    );
  }

  const stories: GeneratedStory[] = [];
  for (const s of storiesRaw) {
    if (!s || typeof s !== "object") {
      throw new StoryParseError("story entry must be an object");
    }
    const row = s as Record<string, unknown>;
    const headline =
      typeof row.headline === "string" ? row.headline.trim() : "";
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!headline && !body) {
      throw new StoryParseError("story must have headline or body");
    }
    const stickerRaw = row.sticker_cta;
    const stickerCta =
      typeof stickerRaw === "string" && stickerRaw.trim().length > 0
        ? stickerRaw.trim()
        : null;
    stories.push({ headline, body, stickerCta });
  }

  return { stories };
}
