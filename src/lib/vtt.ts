// Pure WebVTT parser — extracts spoken text and drops cue metadata.
// Handles:
//   - WEBVTT header
//   - NOTE blocks
//   - numeric cue identifiers
//   - timing lines (HH:MM:SS.mmm --> HH:MM:SS.mmm, optional comma decimal)
//   - voice tags <v Speaker>text</v> (speaker label kept inline)
//   - plain .txt pass-through (no WEBVTT header → input returned almost as-is)

const TIMING_LINE =
  /^\s*\d{1,2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[.,]\d{3}.*$/;

export function parseVtt(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  let skippingNote = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (skippingNote) {
      // NOTE blocks end with a blank line.
      if (line === "") skippingNote = false;
      continue;
    }

    if (line === "" || line === "WEBVTT" || /^WEBVTT\b/.test(line)) continue;
    if (/^NOTE(\b|$)/.test(line)) {
      skippingNote = true;
      continue;
    }
    if (TIMING_LINE.test(line)) continue;
    // A bare numeric or kebab cue identifier line right before a timing line.
    if (
      /^[0-9a-z][0-9a-z_-]*$/i.test(line) &&
      i + 1 < lines.length &&
      TIMING_LINE.test(lines[i + 1])
    ) {
      continue;
    }

    out.push(stripVoiceTags(line));
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripVoiceTags(line: string): string {
  // <v Speaker>text</v> — keep "Speaker: text"
  let result = line.replace(
    /<v\s+([^>]+)>([\s\S]*?)<\/v>/g,
    (_match, speaker: string, text: string) => `${speaker.trim()}: ${text}`,
  );
  // Self-closing or dangling <v Name> — keep just the name as a speaker cue.
  result = result.replace(
    /<v\s+([^>]+)>/g,
    (_match, speaker: string) => `${speaker.trim()}: `,
  );
  // Strip any remaining inline tags (<c.color1>, <00:00:01.000>, etc.)
  result = result.replace(/<[^>]+>/g, "");
  return result;
}

export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}
