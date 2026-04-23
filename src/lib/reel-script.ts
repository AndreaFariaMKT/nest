// Pure helpers for generating a Reels / short-form video voiceover script
// from an approved carousel.
//
// The output is a single voiceover block (not a list of shots) designed to
// be recorded by the client in one take, with a hook in the first 3 seconds
// and a CTA in the last line.

import type { BrandColor, BrandTypography } from "@/types/database";

export type ReelSourceSlide = {
  position: number;
  headline: string | null;
  body: string | null;
};

export type ReelSourceDraft = {
  title: string;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  slides: ReelSourceSlide[];
};

export type ReelBrand = {
  name: string;
  palette: BrandColor[];
  typography: BrandTypography | null;
  voiceTone: string | null;
  doList: string[];
  dontList: string[];
};

export type ReelScriptResult = {
  title: string;
  hookLine: string;
  script: string; // the full voiceover, newline-delimited shots
  caption: string | null;
  hashtags: string[];
  estimatedDurationSec: number;
};

const LANG_LABEL = (code: string) =>
  code.toLowerCase().startsWith("pt")
    ? "Portuguese (Brazil)"
    : code.toLowerCase().startsWith("en")
      ? "English"
      : code;

function renderBrand(brand: ReelBrand | null): string {
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

export function buildReelSystem(
  brand: ReelBrand | null,
  language: string,
): string {
  const lang = LANG_LABEL(language);
  return `You are a senior content strategist writing a voiceover script for a 30-60 second Instagram Reel.

Language of output: ${lang}. Write naturally in that language — the creator will read this aloud.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "title": "short internal label for this Reel",
  "hook_line": "the exact first sentence — must grab attention in under 3 seconds",
  "script": "full voiceover, one shot per line, 30-60 seconds when read at natural pace",
  "caption": "string | null — caption to post alongside the Reel",
  "hashtags": ["#tag1", "#tag2"],
  "estimated_duration_sec": 45
}

Rules:
- The hook_line is the FIRST line of the script. Repeat it there verbatim — don't rewrite it.
- Aim for 90-150 words in the script total (that maps to 30-60 seconds at natural pace).
- One shot per line. Each line should feel visually distinct (camera angle change, b-roll shift, text overlay cue).
- Close with a clear, single CTA — save, follow, comment, visit bio.
- Preserve the source carousel's core message and pillar.
- Respect the brand voice/tone below.
- Never include markdown fences (\`\`\`) in your output.

Brand context:

${renderBrand(brand)}`;
}

export function buildReelUser(
  draft: ReelSourceDraft,
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

<source_carousel>
title: ${draft.title}
pillar: ${draft.pillar ?? ""}
hook: ${draft.hook ?? ""}
caption: ${draft.caption ?? ""}
hashtags: ${draft.hashtags.join(" ")}

${slidesText}
</source_carousel>

Write the Reel script JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class ReelParseError extends Error {}

export function parseReelPayload(raw: string): ReelScriptResult {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) throw new ReelParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new ReelParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ReelParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;

  const title = typeof root.title === "string" ? root.title.trim() : "";
  if (!title) throw new ReelParseError("missing title");

  const hookLine =
    typeof root.hook_line === "string" ? root.hook_line.trim() : "";
  if (!hookLine) throw new ReelParseError("missing hook_line");

  const script = typeof root.script === "string" ? root.script.trim() : "";
  if (script.length < 40) {
    throw new ReelParseError("script too short");
  }

  const caption =
    typeof root.caption === "string" && root.caption.trim().length > 0
      ? root.caption.trim()
      : null;

  let hashtags: string[] = [];
  if (Array.isArray(root.hashtags)) {
    hashtags = (root.hashtags as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));
  }

  let estimated = 45;
  if (
    typeof root.estimated_duration_sec === "number" &&
    Number.isFinite(root.estimated_duration_sec)
  ) {
    estimated = Math.round(root.estimated_duration_sec);
    if (estimated < 10) estimated = 10;
    if (estimated > 120) estimated = 120;
  }

  return {
    title,
    hookLine,
    script,
    caption,
    hashtags,
    estimatedDurationSec: estimated,
  };
}
