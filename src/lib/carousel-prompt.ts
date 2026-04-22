// Pure helpers for the "generate carousels from transcript" flow.
//
// Keeping these isolated + unit-tested is the only sane way to verify the
// LLM pipeline without paying for real Claude calls in tests.

import type { BrandColor, BrandTypography } from "@/types/database";

export type SlideDraft = {
  headline: string;
  body: string;
};

export type CarouselDraft = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: SlideDraft[];
};

export type DraftsPayload = {
  drafts: CarouselDraft[];
};

export type BrandSummary = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
  voiceTone: string | null;
  doList: string[];
  dontList: string[];
};

export type RecentDraft = {
  title: string;
  pillar: string | null;
};

// ───────────────────────────────────────────────────────────────────────────
// Prompt builders
// ───────────────────────────────────────────────────────────────────────────

export function buildBrandContext(brand: BrandSummary | null): string {
  if (!brand) return "<no brand kit configured>";
  const lines: string[] = [`Brand: ${brand.name}`];
  if (brand.palette.length > 0) {
    lines.push(
      `Palette: ${brand.palette
        .map((c) => `${c.name} (${c.hex})`)
        .join(", ")}`,
    );
  }
  if (brand.typography?.headings || brand.typography?.body) {
    lines.push(
      `Typography: headings=${brand.typography.headings || "—"}, body=${brand.typography.body || "—"}`,
    );
  }
  if (brand.voiceTone) lines.push(`Voice & tone: ${brand.voiceTone}`);
  if (brand.doList.length > 0) {
    lines.push(`Do:\n${brand.doList.map((x) => `  - ${x}`).join("\n")}`);
  }
  if (brand.dontList.length > 0) {
    lines.push(`Don't:\n${brand.dontList.map((x) => `  - ${x}`).join("\n")}`);
  }
  return lines.join("\n");
}

export function buildSystem(brand: BrandSummary | null, language: string): string {
  const lang = languageLabel(language);
  return `You are a senior content strategist for a Brazilian Instagram carousel agency.
You produce carousel drafts from client meeting transcripts, respecting the brand's
voice, do/don't rules, and visual identity.

Language of output: ${lang}. Write naturally in that language.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "drafts": [
    {
      "title": "string — internal label for this draft (max 80 chars)",
      "pillar": "string | null — content pillar, e.g. 'Educação financeira'",
      "hook": "string | null — opening hook, max 12 words",
      "caption": "string | null — Instagram caption incl. CTA, up to 2200 chars",
      "hashtags": ["#tag1", "#tag2", ...],   // 8-15 items, each starts with #
      "slides": [
        { "headline": "string — slide title, max 10 words", "body": "string — slide body, max 60 words" }
      ]
    }
  ]
}

Rules:
- 3-8 drafts per response. Each draft: 5-8 slides.
- Never include markdown fences (\`\`\`) in your output.
- If a field is unknown or not applicable, use null (for strings) or [] (for arrays).
- Respect the brand's do/don't lists and voice/tone exactly.
- Avoid repeating themes from the "Recent drafts" list (if provided).

Brand context:

${buildBrandContext(brand)}`;
}

export function buildUser(
  transcript: string,
  recent: RecentDraft[],
  language: string,
): string {
  const recentBlock =
    recent.length === 0
      ? "(none — this is the first batch for this client)"
      : recent
          .map(
            (r) =>
              `- ${r.title}${r.pillar ? ` · ${r.pillar}` : ""}`,
          )
          .join("\n");
  const lang = languageLabel(language);
  return `Language: ${lang}.

<transcript>
${transcript.trim()}
</transcript>

<recent_drafts>
${recentBlock}
</recent_drafts>

Return the JSON drafts now.`;
}

function languageLabel(code: string): string {
  const lower = code.toLowerCase();
  if (lower.startsWith("pt")) return "Portuguese (Brazil)";
  if (lower.startsWith("en")) return "English";
  return code;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class DraftsParseError extends Error {}

export function parseDraftsPayload(raw: string): DraftsPayload {
  const stripped = stripFences(raw).trim();
  if (!stripped) throw new DraftsParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new DraftsParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new DraftsParseError("top level must be an object");
  }

  const drafts = (parsed as Record<string, unknown>).drafts;
  if (!Array.isArray(drafts)) {
    throw new DraftsParseError("`drafts` must be an array");
  }

  const out: CarouselDraft[] = [];
  for (const d of drafts) {
    if (!d || typeof d !== "object") continue;
    const row = d as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!title) continue;

    const slidesRaw = Array.isArray(row.slides) ? row.slides : [];
    const slides: SlideDraft[] = [];
    for (const s of slidesRaw) {
      if (!s || typeof s !== "object") continue;
      const srow = s as Record<string, unknown>;
      const headline =
        typeof srow.headline === "string" ? srow.headline.trim() : "";
      const body = typeof srow.body === "string" ? srow.body.trim() : "";
      if (!headline && !body) continue;
      slides.push({ headline, body });
    }
    if (slides.length === 0) continue;

    const hashtagsRaw = Array.isArray(row.hashtags) ? row.hashtags : [];
    const hashtags = hashtagsRaw
      .filter((t): t is string => typeof t === "string")
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    out.push({
      title,
      pillar: readString(row.pillar),
      hook: readString(row.hook),
      caption: readString(row.caption),
      hashtags,
      slides,
    });
  }

  if (out.length === 0) {
    throw new DraftsParseError("no usable drafts in payload");
  }
  return { drafts: out };
}

function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n");
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
