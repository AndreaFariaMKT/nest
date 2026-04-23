// Input sanitization helpers for user-submitted text.
//
// Nest stores raw user input (approval comments, draft fields, task
// descriptions) in Postgres text columns. All rendering uses React, so XSS
// via `<script>` insertion is already blocked by React's auto-escaping.
// These helpers defend against the *other* failure modes we actually see:
//   1. Invisible / control characters (NULL, RTL override, zero-width joiners)
//      that break display and log searching.
//   2. Oversized pastes that bloat the DB and Claude prompts.
//   3. Repeated-whitespace spam that inflates token counts.
//
// These are PURE — no network, no file IO. Keep them that way.

/** Strip NULL bytes, C0 control chars (except \n \r \t), and BOMs. */
export function stripControlChars(input: string): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      // BOM + common zero-width / bidi-override characters that show up in
      // copy-paste from PDFs and malicious inputs.
      .replace(/[\uFEFF\u200B-\u200F\u202A-\u202E]/g, "")
  );
}

/** Collapse runs of whitespace (spaces, tabs) to a single space per line. */
export function collapseInlineWhitespace(input: string): string {
  return input
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s+$/, ""))
    .join("\n");
}

/** Limit consecutive blank lines to at most `max` (default 2). */
export function limitBlankLines(input: string, max = 2): string {
  const pattern = new RegExp(`\\n{${max + 1},}`, "g");
  return input.replace(pattern, "\n".repeat(max + 1));
}

export type CleanTextOptions = {
  /** Trim leading/trailing whitespace. Default true. */
  trim?: boolean;
  /** Max total length (characters). Extra is dropped. Default: no limit. */
  maxLength?: number;
  /** Max consecutive blank lines. Default 2. */
  maxBlankLines?: number;
};

/**
 * Pipeline: strip control chars → collapse whitespace → limit blank lines →
 * optional trim + truncate.
 */
export function cleanText(
  input: string,
  opts: CleanTextOptions = {},
): string {
  let out = stripControlChars(input);
  out = collapseInlineWhitespace(out);
  out = limitBlankLines(out, opts.maxBlankLines ?? 2);
  if (opts.trim !== false) out = out.trim();
  if (opts.maxLength && out.length > opts.maxLength) {
    out = out.slice(0, opts.maxLength);
  }
  return out;
}

/**
 * Stricter variant for single-line inputs (titles, hashtags). Drops \n and \r
 * and collapses any remaining whitespace to single spaces.
 */
export function cleanLine(input: string, maxLength?: number): string {
  const stripped = stripControlChars(input).replace(/[\r\n]+/g, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (maxLength && collapsed.length > maxLength) {
    return collapsed.slice(0, maxLength);
  }
  return collapsed;
}
